/**
 * Escrow Release Service — ServiceSync
 *
 * When a cash payment is confirmed (or PayNow payment lands), this service
 * releases the homeowner's initial pay-now deposit into the technician's
 * bank account via the PayNow/NETS API, minus the platform transaction fee.
 *
 * Flow:
 *   1. Cash confirmed (or PayNow webhook received)
 *   2. Look up the booking's deposit amount
 *   3. Call NETS/DBS open-banking API to transfer net amount to technician's PayNow key
 *   4. Write escrow_releases record
 *   5. Update invoice.escrow_released_at
 *
 * Required env vars:
 *   NETS_API_BASE_URL      — e.g. https://api.nets.com.sg/paynow/v1
 *   NETS_API_KEY           — NETS merchant API key
 *   NETS_MERCHANT_ID       — Registered merchant ID
 *   PLATFORM_TRANSACTION_FEE_BPS — basis points fee, e.g. 50 = 0.5%
 */

import { getAdminClient } from './supabase-admin';
import { decryptField } from './crypto';
import type { EscrowReleaseRecord, EscrowReleaseResult } from '../payment';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

// HIGH-08: Validate NETS API base URL against allowlist to prevent SSRF
const ALLOWED_NETS_HOSTS = ['api.nets.com.sg', 'uat-api.nets.com.sg'];
const rawNetsBase = process.env.NETS_API_BASE_URL ?? 'https://api.nets.com.sg/paynow/v1';
let NETS_API_BASE = 'https://api.nets.com.sg/paynow/v1';
try {
  const parsed = new URL(rawNetsBase);
  if (ALLOWED_NETS_HOSTS.includes(parsed.hostname) && parsed.protocol === 'https:') {
    NETS_API_BASE = rawNetsBase;
  } else {
    console.error(`[Escrow] NETS_API_BASE_URL hostname '${parsed.hostname}' not in allowlist — using default`);
  }
} catch {
  console.error('[Escrow] Invalid NETS_API_BASE_URL — using default');
}

// HIGH-02: Guard against missing env vars instead of crashing with non-null assertion
const NETS_API_KEY = process.env.NETS_API_KEY ?? '';
const NETS_MERCHANT_ID = process.env.NETS_MERCHANT_ID ?? '';
/** Fee in basis points. 50 bps = 0.5% */
const FEE_BPS = parseInt(process.env.PLATFORM_TRANSACTION_FEE_BPS ?? '50', 10);

const supabase = getAdminClient();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NetsPayNowTransferPayload {
  merchantId: string;
  referenceNumber: string;
  recipientPaynowKey: string;   // NRIC or SG mobile number
  amountSgd: string;            // e.g. "85.00"
  description: string;
}

interface NetsApiResponse {
  status: 'success' | 'pending' | 'failed';
  transactionId?: string;
  errorCode?: string;
  errorMessage?: string;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Releases the escrow deposit to the technician's PayNow account.
 * Called immediately after cash confirmation or PayNow payment webhook.
 *
 * @param invoiceId    - UUID of the settled invoice
 * @param triggeredBy  - What triggered the release
 * @returns            - The escrow release record on success
 */
export async function releaseEscrowDeposit(
  invoiceId: string,
  triggeredBy: 'cash_confirmed' | 'paynow_paid'
): Promise<EscrowReleaseResult> {
  // 1. Fetch invoice + booking deposit details + provider PayNow key
  const { data: invoice, error: invoiceErr } = await supabase
    .from('invoices')
    .select(
      `id, booking_id, provider_id, amount,
       bookings(deposit_amount),
       profiles!provider_id(paynow_key)`
    )
    .eq('id', invoiceId)
    .single();

  if (invoiceErr || !invoice) {
    console.error('[Escrow] Invoice lookup error:', invoiceErr?.message);
    return { success: false, error: 'Invoice not found' };
  }

  const depositCents: number = (invoice as any).bookings?.deposit_amount ?? 0;
  // HIGH-07: Decrypt paynow_key (may be encrypted at rest)
  const rawPaynowKey: string = (invoice as any).profiles?.paynow_key;
  let paynowKey = '';
  if (rawPaynowKey) {
    try {
      paynowKey = decryptField(rawPaynowKey);
    } catch (err) {
      console.error('[Escrow] Failed to decrypt paynow_key:', err instanceof Error ? err.message : err);
      return { success: false, error: 'Failed to decrypt payment key' };
    }
  }

  if (!depositCents || depositCents <= 0) {
    // No deposit was taken; nothing to release
    return { success: true };
  }

  if (!paynowKey) {
    return { success: false, error: 'Technician PayNow key not configured' };
  }

  // HIGH-02: Verify NETS credentials are configured before proceeding
  if (!NETS_API_KEY || !NETS_MERCHANT_ID) {
    console.error('[Escrow] NETS_API_KEY or NETS_MERCHANT_ID not configured');
    return { success: false, error: 'Payment gateway not configured' };
  }

  // 2. Calculate fee and net amount
  const feeCents = Math.round(depositCents * (FEE_BPS / 10_000));
  const netCents = depositCents - feeCents;

  // HIGH-05: Atomic dedup — INSERT with ON CONFLICT DO NOTHING to prevent TOCTOU race
  // Uses upsert with ignoreDuplicates to atomically check+insert
  const { data: releaseRow, error: insertErr } = await supabase
    .from('escrow_releases')
    .upsert({
      invoice_id: invoiceId,
      booking_id: invoice.booking_id,
      provider_id: invoice.provider_id,
      deposit_amount_cents: depositCents,
      transaction_fee_cents: feeCents,
      net_released_cents: netCents,
      destination_paynow_key: paynowKey,
      triggered_by: triggeredBy,
      status: 'processing',
      initiated_at: new Date().toISOString(),
    }, {
      onConflict: 'invoice_id',
      ignoreDuplicates: true,
    })
    .select()
    .single();

  // If no row returned, it was a duplicate — check existing status
  if (!releaseRow) {
    const { data: existing } = await supabase
      .from('escrow_releases')
      .select('id, status')
      .eq('invoice_id', invoiceId)
      .single();

    if (existing && existing.status !== 'failed') {
      return { success: true }; // Already released; idempotent
    }
    // If failed, we could retry — but for now return the insert error
    if (insertErr) {
      console.error('[Escrow] Insert error:', insertErr.message);
      return { success: false, error: 'Failed to create escrow release record' };
    }
    return { success: false, error: 'Failed to create escrow release record' };
  }

  // 5. Call NETS PayNow API to transfer funds
  const netApiResult = await callNetsTransfer({
    merchantId: NETS_MERCHANT_ID,
    referenceNumber: `SS-ESC-${releaseRow.id.slice(-8).toUpperCase()}`,
    recipientPaynowKey: paynowKey,
    amountSgd: (netCents / 100).toFixed(2),
    description: `ServiceSync escrow release — Invoice ${invoiceId.slice(-8).toUpperCase()}`,
  });

  // 6. Update escrow record with outcome
  const now = new Date().toISOString();
  if (netApiResult.status === 'success' || netApiResult.status === 'pending') {
    await supabase
      .from('escrow_releases')
      .update({ status: 'released', completed_at: now })
      .eq('id', releaseRow.id);

    // Also stamp the invoice
    await supabase
      .from('invoices')
      .update({ escrow_released_at: now })
      .eq('id', invoiceId);
  } else {
    await supabase
      .from('escrow_releases')
      .update({ status: 'failed', failure_reason: netApiResult.errorMessage })
      .eq('id', releaseRow.id);

    return {
      success: false,
      error: netApiResult.errorMessage ?? 'NETS transfer failed',
    };
  }

  const record: EscrowReleaseRecord = {
    id: releaseRow.id,
    invoiceId,
    bookingId: invoice.booking_id,
    providerId: invoice.provider_id,
    depositAmountCents: depositCents,
    transactionFeeCents: feeCents,
    netReleasedCents: netCents,
    destinationPaynowKey: paynowKey,
    triggeredBy,
    status: 'released',
    initiatedAt: releaseRow.initiated_at,
    completedAt: now,
  };

  return { success: true, record };
}

// ---------------------------------------------------------------------------
// NETS API call (stubbed; replace with actual SDK when available)
// ---------------------------------------------------------------------------

async function callNetsTransfer(
  payload: NetsPayNowTransferPayload
): Promise<NetsApiResponse> {
  try {
    const res = await fetch(`${NETS_API_BASE}/transfer`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${NETS_API_KEY}`,
        'Content-Type': 'application/json',
        'X-Merchant-Id': payload.merchantId,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      return { status: 'failed', errorMessage: `HTTP ${res.status}: ${text}` };
    }

    return res.json() as Promise<NetsApiResponse>;
  } catch (err) {
    return {
      status: 'failed',
      errorMessage: err instanceof Error ? err.message : 'Network error',
    };
  }
}
