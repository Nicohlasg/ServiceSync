/**
 * Reconciliation Cron — ServiceSync
 * GET /api/cron/reconciliation
 *
 * Daily check for payment split states that indicate partial writes:
 *   1. cash_payments without matching invoices.status = 'paid_cash'
 *   2. escrow_releases stuck in 'processing' for > 1 hour
 *   3. till_entries referencing invoices that have no payment record
 *   4. Invoices marked paid but missing a payment/cash_payment row
 *
 * Protected by CRON_SECRET header (Vercel Cron or external scheduler).
 * Anomalies are logged to Sentry via captureMessage.
 *
 * Schedule: daily at 03:00 SGT (19:00 UTC previous day)
 */

import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { getAdminClient } from '@/server/services/supabase-admin';

const CRON_SECRET = process.env.CRON_SECRET ?? '';

interface Anomaly {
  check: string;
  severity: 'warning' | 'error';
  count: number;
  details: Record<string, unknown>[];
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  // Auth: verify cron secret to prevent unauthorized access
  const authHeader = req.headers.get('authorization');
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getAdminClient();
  const anomalies: Anomaly[] = [];
  const startedAt = new Date().toISOString();

  // -------------------------------------------------------------------------
  // Check 1: cash_payments without matching invoice status
  // A cash_payment row exists (not voided) but the invoice is NOT 'paid_cash'
  // -------------------------------------------------------------------------
  try {
    const { data: orphanedCash, error } = await supabase
      .from('cash_payments')
      .select('id, invoice_id, amount_collected_cents, collected_at')
      .is('voided_at', null)
      .not('invoice_id', 'is', null);

    if (!error && orphanedCash && orphanedCash.length > 0) {
      // For each cash payment, check the invoice status
      const invoiceIds = orphanedCash.map((cp) => cp.invoice_id);
      const { data: invoices } = await supabase
        .from('invoices')
        .select('id, status')
        .in('id', invoiceIds);

      const invoiceMap = new Map(
        (invoices ?? []).map((inv) => [inv.id, inv.status])
      );

      const mismatched = orphanedCash.filter(
        (cp) => invoiceMap.get(cp.invoice_id) !== 'paid_cash'
      );

      if (mismatched.length > 0) {
        anomalies.push({
          check: 'cash_payment_invoice_mismatch',
          severity: 'error',
          count: mismatched.length,
          details: mismatched.map((cp) => ({
            cash_payment_id: cp.id,
            invoice_id: cp.invoice_id,
            invoice_status: invoiceMap.get(cp.invoice_id) ?? 'missing',
            amount_cents: cp.amount_collected_cents,
            collected_at: cp.collected_at,
          })),
        });
      }
    }
  } catch (err) {
    console.error('[Reconciliation] Check 1 failed:', err);
  }

  // -------------------------------------------------------------------------
  // Check 2: escrow_releases stuck in 'processing' for > 1 hour
  // -------------------------------------------------------------------------
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const { data: stuckEscrows, error } = await supabase
      .from('escrow_releases')
      .select('id, invoice_id, provider_id, deposit_amount_cents, initiated_at')
      .eq('status', 'processing')
      .lt('initiated_at', oneHourAgo);

    if (!error && stuckEscrows && stuckEscrows.length > 0) {
      anomalies.push({
        check: 'escrow_stuck_processing',
        severity: 'error',
        count: stuckEscrows.length,
        details: stuckEscrows.map((er) => ({
          escrow_release_id: er.id,
          invoice_id: er.invoice_id,
          provider_id: er.provider_id,
          deposit_amount_cents: er.deposit_amount_cents,
          initiated_at: er.initiated_at,
          stuck_hours: (
            (Date.now() - new Date(er.initiated_at).getTime()) /
            (1000 * 60 * 60)
          ).toFixed(1),
        })),
      });
    }
  } catch (err) {
    console.error('[Reconciliation] Check 2 failed:', err);
  }

  // -------------------------------------------------------------------------
  // Check 3: Invoices marked paid but missing any payment record
  // paid_cash invoices should have a cash_payments row
  // paid_qr invoices should have a payments row
  // -------------------------------------------------------------------------
  try {
    // Check paid_cash invoices without cash_payments
    const { data: paidCashInvoices, error: pcErr } = await supabase
      .from('invoices')
      .select('id, provider_id, amount, paid_at')
      .eq('status', 'paid_cash');

    if (!pcErr && paidCashInvoices && paidCashInvoices.length > 0) {
      const cashInvoiceIds = paidCashInvoices.map((inv) => inv.id);
      const { data: cashPayments } = await supabase
        .from('cash_payments')
        .select('invoice_id')
        .in('invoice_id', cashInvoiceIds)
        .is('voided_at', null);

      const cashPaymentInvoiceIds = new Set(
        (cashPayments ?? []).map((cp) => cp.invoice_id)
      );

      const missingCashRecords = paidCashInvoices.filter(
        (inv) => !cashPaymentInvoiceIds.has(inv.id)
      );

      if (missingCashRecords.length > 0) {
        anomalies.push({
          check: 'paid_cash_missing_record',
          severity: 'error',
          count: missingCashRecords.length,
          details: missingCashRecords.map((inv) => ({
            invoice_id: inv.id,
            provider_id: inv.provider_id,
            amount_cents: inv.amount,
            paid_at: inv.paid_at,
          })),
        });
      }
    }

    // Check paid_qr invoices without payments
    const { data: paidQrInvoices, error: pqErr } = await supabase
      .from('invoices')
      .select('id, provider_id, amount, paid_at')
      .eq('status', 'paid_qr');

    if (!pqErr && paidQrInvoices && paidQrInvoices.length > 0) {
      const qrInvoiceIds = paidQrInvoices.map((inv) => inv.id);
      const { data: qrPayments } = await supabase
        .from('payments')
        .select('invoice_id')
        .in('invoice_id', qrInvoiceIds);

      const qrPaymentInvoiceIds = new Set(
        (qrPayments ?? []).map((p) => p.invoice_id)
      );

      const missingQrRecords = paidQrInvoices.filter(
        (inv) => !qrPaymentInvoiceIds.has(inv.id)
      );

      if (missingQrRecords.length > 0) {
        anomalies.push({
          check: 'paid_qr_missing_record',
          severity: 'warning',
          count: missingQrRecords.length,
          details: missingQrRecords.map((inv) => ({
            invoice_id: inv.id,
            provider_id: inv.provider_id,
            amount_cents: inv.amount,
            paid_at: inv.paid_at,
          })),
        });
      }
    }
  } catch (err) {
    console.error('[Reconciliation] Check 3 failed:', err);
  }

  // -------------------------------------------------------------------------
  // Check 4: till_entries referencing invoices that are not in a paid state
  // -------------------------------------------------------------------------
  try {
    const { data: tillEntries, error } = await supabase
      .from('till_entries')
      .select('id, invoice_id, provider_id, amount_cents, entry_type, date')
      .not('invoice_id', 'is', null)
      .gt('amount_cents', 0); // Exclude void reversals (negative amounts)

    if (!error && tillEntries && tillEntries.length > 0) {
      const tillInvoiceIds = Array.from(
        new Set(tillEntries.map((te) => te.invoice_id))
      );
      const { data: invoices } = await supabase
        .from('invoices')
        .select('id, status')
        .in('id', tillInvoiceIds);

      const invoiceStatusMap = new Map(
        (invoices ?? []).map((inv) => [inv.id, inv.status])
      );

      const orphanedTill = tillEntries.filter((te) => {
        const status = invoiceStatusMap.get(te.invoice_id);
        return status && !['paid_cash', 'paid_qr'].includes(status);
      });

      if (orphanedTill.length > 0) {
        anomalies.push({
          check: 'till_entry_unpaid_invoice',
          severity: 'warning',
          count: orphanedTill.length,
          details: orphanedTill.slice(0, 20).map((te) => ({
            till_entry_id: te.id,
            invoice_id: te.invoice_id,
            invoice_status: invoiceStatusMap.get(te.invoice_id) ?? 'missing',
            amount_cents: te.amount_cents,
            entry_type: te.entry_type,
            date: te.date,
          })),
        });
      }
    }
  } catch (err) {
    console.error('[Reconciliation] Check 4 failed:', err);
  }

  // -------------------------------------------------------------------------
  // Report results
  // -------------------------------------------------------------------------
  const completedAt = new Date().toISOString();
  const totalAnomalies = anomalies.reduce((sum, a) => sum + a.count, 0);

  if (totalAnomalies > 0) {
    const errorAnomalies = anomalies.filter((a) => a.severity === 'error');
    const warningAnomalies = anomalies.filter((a) => a.severity === 'warning');

    // Report each error-severity anomaly to Sentry
    for (const anomaly of errorAnomalies) {
      Sentry.captureMessage(
        `[Reconciliation] ${anomaly.check}: ${anomaly.count} anomalies found`,
        {
          level: 'error',
          extra: {
            check: anomaly.check,
            count: anomaly.count,
            details: anomaly.details,
            ran_at: startedAt,
          },
        }
      );
    }

    // Report warnings at warning level
    for (const anomaly of warningAnomalies) {
      Sentry.captureMessage(
        `[Reconciliation] ${anomaly.check}: ${anomaly.count} anomalies found`,
        {
          level: 'warning',
          extra: {
            check: anomaly.check,
            count: anomaly.count,
            details: anomaly.details,
            ran_at: startedAt,
          },
        }
      );
    }

    console.warn(
      `[Reconciliation] ${totalAnomalies} anomalies detected across ${anomalies.length} checks`,
      JSON.stringify(anomalies, null, 2)
    );
  } else {
    console.info('[Reconciliation] All checks passed — no anomalies detected');
  }

  return NextResponse.json({
    status: totalAnomalies === 0 ? 'healthy' : 'anomalies_detected',
    ran_at: startedAt,
    completed_at: completedAt,
    total_anomalies: totalAnomalies,
    checks: anomalies.map((a) => ({
      check: a.check,
      severity: a.severity,
      count: a.count,
    })),
  });
}
