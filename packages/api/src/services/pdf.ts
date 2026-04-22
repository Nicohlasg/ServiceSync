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
  providerAcraUen?: string;
  providerAcraVerified: boolean;
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
    const pdfBuffer = await renderInvoiceWithPdfx(input);

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
// HTML Template
// ---------------------------------------------------------------------------

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
    <tr><th>Bill To</th><th>Service Address</th></tr>
    <tr><td>${eClientName}</td><td>${eClientAddr}</td></tr>
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
      executablePath = await chromium.default.executablePath();
    } catch (err: any) {
      throw new Error('Production PDF generation failed to load @sparticuz/chromium: ' + err.message);
    }
  } else {
    // Local dev: use full puppeteer which bundles an OS-specific Chromium
    try {
      puppeteer = await import('puppeteer');
    } catch (err: any) {
      throw new Error('Local PDF generation requires the full "puppeteer" package: ' + err.message);
    }
  }

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
