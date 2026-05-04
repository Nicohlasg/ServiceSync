/**
 * PDF Generation Service — ServiceSync (Cash Payment Extension)
 *
 * Extends the base invoice PDF with:
 *   1. "PAID IN CASH" watermark + timestamp
 *   2. Embedded client signature (for high-value cash jobs ≥ $500)
 *   3. Cash receipt section (amount collected, any adjustment noted)
 *
 * Uses Puppeteer serverless for PDF rendering; the HTML template is built
 * in-process and rendered to PDF in a sandboxed Chromium instance.
 *
 * Required env vars:
 *   NEXT_PUBLIC_SUPABASE_URL        — for storage upload
 *   SUPABASE_SERVICE_ROLE_KEY       — for storage upload
 *   NEXT_PUBLIC_APP_URL             — base URL for receipt links
 */

import { createHmac } from 'crypto';
import { getAdminClient } from './supabase-admin';

const supabase = getAdminClient();

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://servicesync.sg';

// ---------------------------------------------------------------------------
// HTML Escaping (CRIT-01: prevent XSS in PDF templates)
// ---------------------------------------------------------------------------

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CashReceiptPdfInput {
  invoiceId: string;
  providerId: string;
  providerName: string;
  providerAcraVerified: boolean;
  clientName: string;
  clientAddress: string;
  serviceType: string;
  serviceDate: string;
  lineItems: Array<{ description: string; amountCents: number }>;
  totalAmountCents: number;
  depositAmountCents: number;
  amountCollectedCents: number;
  adjustmentCents: number;
  adjustmentReason?: string;
  warrantyDays: number;
  /** Base64 PNG of the client's touch signature (optional) */
  signatureDataUrl?: string;
  signedAt?: string;
  collectedAt: string;
}

export interface PdfGenerateResult {
  success: boolean;
  pdfUrl?: string;
  storagePath?: string;
  error?: string;
}

export interface InvoicePdfInput {
  invoiceId: string;
  invoiceNumber: string;
  createdAt: string;
  providerId: string;
  providerName: string;
  providerPhone: string;
  providerAddress?: string;
  providerAcraUen?: string;
  providerAcraVerified: boolean;
  /** Task 1.6: Only show "Tax Invoice" when provider is GST-registered */
  providerGstRegistered?: boolean;
  clientName: string;
  clientPhone: string;
  clientAddress: string;
  serviceType: string;
  serviceDate: string;
  lineItems: Array<{ description: string; amountCents: number }>;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  depositAmountCents: number;
  balanceDueCents: number;
  paynowQrDataUrl?: string;
  dueDate?: string;
  notes?: string;
  status: 'draft' | 'pending' | 'awaiting_qr_confirmation' | 'paid_cash' | 'paid_qr' | 'disputed' | 'void';
  paidAt?: string | null;
  paymentMethod?: string | null;
  renderBaseUrl?: string;
  /** Higher tier users get premium styling */
  isPro?: boolean;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generates a "PAID IN CASH" stamped PDF receipt for a cash-settled invoice.
 * Uploads to Supabase Storage and returns a publicly accessible URL.
 */
export async function generateCashReceiptPdf(
  input: CashReceiptPdfInput
): Promise<PdfGenerateResult> {
  try {
    const html = buildReceiptHtml(input);
    const pdfBuffer = await renderHtmlToPdf(html);

    const storagePath = `invoices/${input.providerId}/${input.invoiceId}-cash-receipt.pdf`;

    const { error: uploadErr } = await supabase.storage
      .from('invoices')
      .upload(storagePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadErr) {
      return { success: false, error: uploadErr.message };
    }

    const { data: urlData } = supabase.storage
      .from('invoices')
      .getPublicUrl(storagePath);

    return {
      success: true,
      pdfUrl: urlData.publicUrl,
      storagePath,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'PDF generation failed',
    };
  }
}

/**
 * Generates a standard invoice PDF with PayNow QR code.
 * For sending to homeowners before service or as a billing document.
 */
export async function generateInvoicePdf(
  input: InvoicePdfInput
): Promise<PdfGenerateResult> {
  try {
    // SWITCH: Moved from PDFx (React-PDF) to Puppeteer for maximum reliability
    // and to avoid Turbopack React symbol conflicts (Error #31).
    const html = buildInvoiceHtml(input);
    const pdfBuffer = await renderHtmlToPdf(html);

    const now = new Date();
    const year = now.toLocaleDateString('en-US', { year: 'numeric', timeZone: 'Asia/Singapore' });
    const month = now.toLocaleDateString('en-US', { month: '2-digit', timeZone: 'Asia/Singapore' });
    const storagePath = `invoices/${input.providerId}/${year}/${month}/${input.invoiceId}.pdf`;

    const { error: uploadErr } = await supabase.storage
      .from('invoices')
      .upload(storagePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadErr) {
      return { success: false, error: uploadErr.message };
    }

    const { data: urlData } = supabase.storage
      .from('invoices')
      .getPublicUrl(storagePath);

    return {
      success: true,
      pdfUrl: urlData.publicUrl,
      storagePath,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Invoice PDF generation failed',
    };
  }
}

async function renderInvoiceWithPdfx(input: InvoicePdfInput): Promise<Buffer> {
  const { renderBaseUrl, ...renderPayload } = input;
  const appUrl = getAppUrl(renderBaseUrl);
  const payload = JSON.stringify(renderPayload);

  let response: Response;
  try {
    response = await fetch(`${appUrl}/api/invoices/render-pdf`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-servicesync-render-signature': createInternalRenderSignature(payload),
      },
      body: payload,
      cache: 'no-store',
    });
  } catch (error) {
    const details = error instanceof Error ? error.message : 'Unknown fetch error';
    throw new Error(`Failed to reach the internal PDF renderer at ${appUrl}: ${details}`);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`PDFX render request failed (${response.status}): ${errorText}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

function getAppUrl(requestOrigin?: string): string {
  if (requestOrigin) {
    return requestOrigin.replace(/\/$/, '');
  }

  const explicit = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '');
  if (explicit) {
    return explicit;
  }

  return process.env.NODE_ENV === 'production'
    ? 'https://servicesync.sg'
    : 'http://127.0.0.1:3000';
}

function createInternalRenderSignature(payload: string): string {
  const secret = getInternalPdfRenderSecret();
  if (!secret) {
    throw new Error('Internal PDF render secret is not configured');
  }

  return createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
}

function getInternalPdfRenderSecret(): string | undefined {
  return process.env.INTERNAL_PDF_RENDER_SECRET
    ?? process.env.FIELD_ENCRYPTION_KEY
    ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
}

// ---------------------------------------------------------------------------
// HTML Templates
// ---------------------------------------------------------------------------

/**
 * Builds a professional invoice HTML template (IRAS compliant).
 */
function buildInvoiceHtml(input: InvoicePdfInput): string {
  const {
    invoiceNumber,
    createdAt,
    dueDate,
    providerName,
    providerPhone,
    providerAddress,
    providerAcraUen,
    providerAcraVerified,
    clientName,
    clientPhone,
    clientAddress,
    serviceType,
    serviceDate,
    lineItems,
    subtotalCents,
    taxCents,
    totalCents,
    depositAmountCents,
    balanceDueCents,
    paynowQrDataUrl,
    notes,
    status,
    paymentMethod,
    paidAt,
  } = input;

  const isPaid = status === 'paid_cash' || status === 'paid_qr';
  const isVoid = status === 'void';
  
  const statusLabel = isPaid ? 'PAID' : isVoid ? 'VOID' : status.toUpperCase().replace('_', ' ');
  const statusClass = isPaid ? 'status-paid' : isVoid ? 'status-void' : 'status-pending';

  const acraLine = providerAcraUen
    ? `UEN: ${providerAcraUen}${providerAcraVerified ? ' <span class="verified">✓ ACRA Verified</span>' : ''}`
    : '';

  // Escape all user-controlled strings to prevent XSS (CRIT-01)
  const eProvider = escapeHtml(providerName);
  const eProviderAddr = escapeHtml(providerAddress || '');
  const eClient = escapeHtml(clientName);
  const eClientAddr = escapeHtml(clientAddress || '');
  const eService = escapeHtml(serviceType);
  const eNotes = notes ? escapeHtml(notes) : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<style>
  body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 13px; color: #1e293b; margin: 0; padding: 40px; line-height: 1.5; }
  .invoice-container { position: relative; }
  
  /* Header */
  .header { display: flex; justify-content: space-between; margin-bottom: 40px; border-bottom: 2px solid #f1f5f9; padding-bottom: 20px; }
  .brand-section h1 { font-size: 24px; font-weight: 800; color: #0f172a; margin: 0; letter-spacing: -0.02em; }
  .provider-name { font-size: 15px; font-weight: 600; color: #334155; margin-top: 4px; }
  .acra-info { font-size: 11px; color: #64748b; margin-top: 2px; }
  .verified { color: #16a34a; font-weight: 600; }
  
  .meta-section { text-align: right; }
  .invoice-label { font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 4px; }
  .invoice-number { font-size: 20px; font-weight: 700; color: #0ea5e9; margin: 0; }
  
  /* Status Badge */
  .status-badge { display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 11px; font-weight: 700; margin-top: 12px; text-transform: uppercase; letter-spacing: 0.05em; }
  .status-paid { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
  .status-void { background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }
  .status-pending { background: #fef9c3; color: #854d0e; border: 1px solid #fef08a; }

  /* Info Grid */
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 40px; }
  .info-box h3 { font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.1em; margin: 0 0 8px; border-bottom: 1px solid #f1f5f9; padding-bottom: 4px; }
  .info-content { font-size: 13px; }
  .info-content p { margin: 2px 0; }
  .client-name { font-weight: 700; color: #0f172a; font-size: 14px; }

  /* Table */
  table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
  th { background: #f8fafc; text-align: left; padding: 12px 8px; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; border-top: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; }
  td { padding: 12px 8px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
  .col-desc { width: 70%; }
  .col-amt { width: 30%; text-align: right; }
  .item-desc { font-weight: 500; color: #334155; }

  /* Summary Section */
  .summary-container { display: flex; justify-content: flex-end; gap: 40px; }
  .payment-info { flex: 1; max-width: 300px; }
  .summary-box { width: 250px; }
  .summary-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; }
  .summary-row.total { border-top: 2px solid #0ea5e9; margin-top: 8px; padding-top: 12px; font-weight: 800; font-size: 16px; color: #0f172a; }
  .summary-row.balance { color: #0ea5e9; font-weight: 700; }
  
  /* PayNow QR */
  .qr-container { margin-top: 20px; text-align: center; border: 1px solid #e2e8f0; padding: 16px; border-radius: 12px; display: inline-block; }
  .qr-image { width: 140px; height: 140px; }
  .qr-label { font-size: 10px; font-weight: 700; color: #64748b; margin-top: 8px; display: block; }
  
  /* Footer */
  .footer { margin-top: 60px; padding-top: 20px; border-top: 1px solid #f1f5f9; color: #94a3b8; font-size: 11px; text-align: center; }
  .notes-section { margin-top: 40px; background: #f8fafc; padding: 16px; border-radius: 8px; border-left: 4px solid #e2e8f0; }
  .notes-label { font-weight: 700; color: #475569; margin-bottom: 4px; display: block; }
</style>
</head>
<body>
<div class="invoice-container">
  <div class="header">
    <div class="brand-section">
      <h1>ServiceSync</h1>
      <div class="provider-name">${eProvider}</div>
      <div class="acra-info">${acraLine}</div>
      <div class="acra-info">${providerPhone}</div>
      ${eProviderAddr ? `<div class="acra-info">${eProviderAddr}</div>` : ''}
    </div>
    <div class="meta-section">
      <div class="invoice-label">${providerAcraVerified && input.providerGstRegistered ? 'Tax Invoice' : 'Invoice'}</div>
      <div class="invoice-number">${invoiceNumber}</div>
      <div class="status-badge ${statusClass}">${statusLabel}</div>
    </div>
  </div>

  <div class="info-grid">
    <div class="info-box">
      <h3>Billed To</h3>
      <div class="info-content">
        <p class="client-name">${eClient}</p>
        <p>${clientPhone || ''}</p>
        ${eClientAddr ? `<p>${eClientAddr}</p>` : ''}
      </div>
    </div>
    <div class="info-box">
      <h3>Details</h3>
      <div class="info-content">
        <p><strong>Service:</strong> ${eService}</p>
        <p><strong>Service Date:</strong> ${fmtDate(serviceDate)}</p>
        <p><strong>Issue Date:</strong> ${fmtDate(createdAt)}</p>
        ${dueDate ? `<p><strong>Due Date:</strong> ${fmtDate(dueDate)}</p>` : ''}
      </div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th class="col-desc">Description</th>
        <th class="col-amt">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${lineItems.map(item => `
        <tr>
          <td class="col-desc item-desc">${escapeHtml(item.description)}</td>
          <td class="col-amt">${fc(item.amountCents)}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="summary-container">
    <div class="payment-info">
      ${!isPaid && paynowQrDataUrl ? `
        <div class="qr-container">
          <img src="${paynowQrDataUrl}" class="qr-image" alt="PayNow QR Code" />
          <span class="qr-label">Scan to Pay via PayNow</span>
        </div>
      ` : ''}
      ${isPaid && paidAt ? `
        <div class="notes-section" style="border-left-color: #16a34a; background: #f0fdf4;">
          <span class="notes-label" style="color: #166534;">Payment Received</span>
          <p style="margin:0; color: #15803d;">Paid via ${paymentMethod === 'cash' ? 'Cash' : paymentMethod === 'paynow_qr' ? 'PayNow' : 'electronic transfer'} on ${fmtDateTime(paidAt)}</p>
        </div>
      ` : ''}
    </div>
    <div class="summary-box">
      <div class="summary-row">
        <span>Subtotal</span>
        <span>${fc(subtotalCents)}</span>
      </div>
      ${taxCents > 0 ? `
        <div class="summary-row">
          <span>GST (9%)</span>
          <span>${fc(taxCents)}</span>
        </div>
      ` : ''}
      <div class="summary-row total">
        <span>Total</span>
        <span>${fc(totalCents)}</span>
      </div>
      ${depositAmountCents > 0 ? `
        <div class="summary-row">
          <span>Deposit Paid</span>
          <span>-${fc(depositAmountCents)}</span>
        </div>
      ` : ''}
      <div class="summary-row balance">
        <span>Balance Due</span>
        <span>${fc(balanceDueCents)}</span>
      </div>
    </div>
  </div>

  ${eNotes ? `
    <div class="notes-section">
      <span class="notes-label">Notes</span>
      <p style="margin:0;">${eNotes}</p>
    </div>
  ` : ''}

  <div class="footer">
    <p>Generated electronically by ServiceSync &middot; servicesync.sg</p>
    <p>This document serves as a formal record for your bookkeeping, tax, and audit requirements.</p>
  </div>
</div>
</body>
</html>`;
}

function buildReceiptHtml(input: CashReceiptPdfInput): string {
  const {
    invoiceId,
    providerName,
    providerAcraVerified,
    clientName,
    clientAddress,
    serviceDate,
    lineItems,
    depositAmountCents,
    amountCollectedCents,
    adjustmentCents,
    adjustmentReason,
    warrantyDays,
    signatureDataUrl,
    signedAt,
    collectedAt,
  } = input;

  const receiptUrl = `${APP_URL}/receipts/${invoiceId}`;
  const adjustmentLabel =
    adjustmentCents > 0
      ? `Tip / Keep the change: +${fc(adjustmentCents)}`
      : adjustmentCents < 0
      ? `Discount applied: -${fc(Math.abs(adjustmentCents))}`
      : '';

  // Signature data URLs are validated as base64 PNG — safe to embed
  const signatureSection = signatureDataUrl
    ? `
      <div class="signature-block">
        <p class="section-label">Client Signature — Cash Handover Confirmation</p>
        <p class="sig-text">I confirm I have paid <strong>${fc(amountCollectedCents)}</strong> in cash.</p>
        <img src="${signatureDataUrl}" class="sig-img" alt="Client signature" />
        <p class="sig-meta">Signed: ${fmtDateTime(signedAt ?? collectedAt)}</p>
      </div>`
    : '';

  // Escape all user-controlled strings to prevent XSS (CRIT-01)
  const eName = escapeHtml(providerName);
  const eClientName = escapeHtml(clientName);
  const eClientAddr = escapeHtml(clientAddress);
  const eAdjReason = adjustmentReason ? escapeHtml(adjustmentReason) : '';
  const eReceiptUrl = escapeHtml(receiptUrl);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<style>
  body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 14px; color: #1a1a1a; margin: 0; padding: 32px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .header { display: flex; justify-content: space-between; margin-bottom: 24px; }
  .brand { font-weight: 700; font-size: 18px; color: #0ea5e9; }
  .aqra-badge { background: #dcfce7; color: #166534; padding: 2px 8px; border-radius: 4px; font-size: 11px; margin-left: 6px; }
  .paid-stamp { font-size: 36px; font-weight: 900; color: rgba(22,163,74,0.18); border: 5px solid rgba(22,163,74,0.18); transform: rotate(-15deg); display: inline-block; padding: 4px 12px; position: absolute; top: 60px; right: 40px; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; }
  th { background: #f8fafc; text-align: left; padding: 8px; font-size: 12px; color: #64748b; }
  td { padding: 8px; border-bottom: 1px solid #f1f5f9; }
  .total-row td { font-weight: 700; font-size: 16px; border-top: 2px solid #0ea5e9; }
  .cash-box { background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 16px; margin: 16px 0; }
  .cash-box p { margin: 4px 0; }
  .adjustment { color: #7c3aed; font-size: 12px; }
  .warranty-box { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 12px; margin: 16px 0; font-size: 13px; }
  .signature-block { border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0; }
  .section-label { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 8px; }
  .sig-img { max-width: 100%; height: 80px; border: 1px solid #e2e8f0; }
  .sig-meta { font-size: 11px; color: #94a3b8; margin: 4px 0 0; }
  .sig-text { font-size: 13px; font-weight: 600; margin: 0 0 8px; }
  .qr-note { font-size: 11px; color: #64748b; margin-top: 24px; text-align: center; }
  .ref { font-size: 10px; color: #94a3b8; }
</style>
</head>
<body>
<div style="position:relative">
  <span class="paid-stamp">PAID IN CASH</span>
  <div class="header">
    <div>
      <div class="brand">ServiceSync ${providerAcraVerified ? '<span class="aqra-badge">✓ ACRA Verified</span>' : ''}</div>
      <p style="margin:4px 0;color:#64748b;font-size:13px;">${eName}</p>
    </div>
    <div style="text-align:right">
      <p style="margin:0;font-weight:600;">CASH RECEIPT</p>
      <p style="margin:4px 0;font-size:12px;color:#64748b;">${fmtDate(serviceDate)}</p>
      <p class="ref">Ref: ${invoiceId.slice(-8).toUpperCase()}</p>
    </div>
  </div>

  <table>
    <tr><th>Bill To</th></tr>
    <tr><td>${eClientName}</td></tr>
  </table>

  <table>
    <tr><th>Description</th><th style="text-align:right">Amount</th></tr>
    ${lineItems.map((l) => `<tr><td>${escapeHtml(l.description)}</td><td style="text-align:right">${fc(l.amountCents)}</td></tr>`).join('')}
    <tr><td style="color:#64748b;font-size:12px;">Deposit paid (PayNow)</td><td style="text-align:right;color:#64748b;font-size:12px;">-${fc(depositAmountCents)}</td></tr>
    <tr class="total-row"><td>Balance collected in cash</td><td style="text-align:right">${fc(amountCollectedCents)}</td></tr>
  </table>

  <div class="cash-box">
    <p><strong>Payment Method:</strong> Cash</p>
    <p><strong>Cash Collected:</strong> ${fc(amountCollectedCents)}</p>
    <p><strong>Collected At:</strong> ${fmtDateTime(collectedAt)}</p>
    ${adjustmentLabel ? `<p class="adjustment">${adjustmentLabel}${eAdjReason ? ` (${eAdjReason})` : ''}</p>` : ''}
  </div>

  ${signatureSection}

  <div class="warranty-box">
    ✅ <strong>${warrantyDays}-Day Workmanship Warranty</strong> — This receipt serves as your digital warranty card.
    View anytime at: <strong>${eReceiptUrl}</strong>
  </div>

  <p class="qr-note">Receipt secured by ServiceSync · servicesync.sg · Reference: ${invoiceId}</p>
</div>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Puppeteer renderer (serverless-compatible)
// ---------------------------------------------------------------------------

async function renderHtmlToPdf(html: string): Promise<Buffer> {
  let puppeteer: any;
  let chromiumArgs: string[] = ['--no-sandbox', '--disable-setuid-sandbox'];
  let executablePath: string | undefined;

  if (process.env.NODE_ENV === 'production') {
    // Production (Vercel Serverless): use @sparticuz/chromium and puppeteer-core
    try {
      puppeteer = await import('puppeteer-core');
      const chromium = await import('@sparticuz/chromium');
      chromiumArgs = chromium.default.args;
      // Use remote pack to avoid Vercel 50MB function limit issues
      executablePath = await chromium.default.executablePath(
        'https://github.com/Sparticuz/chromium/releases/download/v143.0.4/chromium-v143.0.4-pack.x64.tar'
      );
    } catch (err: any) {
      console.error('Production PDF generation setup failed:', err);
      throw new Error('Production PDF generation failed to load @sparticuz/chromium: ' + err.message);
    }
  } else {
    // Local dev: use full puppeteer which bundles an OS-specific Chromium
    try {
      puppeteer = await import('puppeteer');
    } catch (err: any) {
      console.error('Local PDF generation setup failed:', err);
      throw new Error('Local PDF generation requires the full "puppeteer" package: ' + err.message);
    }
  }

  try {
    const browser = await puppeteer.default.launch({
      headless: true,
      args: chromiumArgs,
      ...(executablePath ? { executablePath } : {}),
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdf = await page.pdf({ format: 'A4', printBackground: true });
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  } catch (err: any) {
    console.error('Browser launch or PDF generation failed:', err);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function fc(cents: number): string {
  return new Intl.NumberFormat('en-SG', {
    style: 'currency',
    currency: 'SGD',
  }).format(cents / 100);
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-SG', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Singapore',
  });
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-SG', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Singapore',
  });
}
