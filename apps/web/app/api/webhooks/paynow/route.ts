/**
 * PayNow Webhook Handler — ServiceSync
 * POST /api/webhooks/paynow
 *
 * Receives payment confirmation callbacks from NETS/DBS PayNow.
 * On confirmation:
 *   1. Validates HMAC signature to prevent spoofing
 *   2. Matches payment to invoice via reference code
 *   3. Updates invoice status to paid_qr
 *   4. Triggers escrow release
 *   5. Records till entry (bank_transfer)
 *   6. Sends receipt WhatsApp + tags CRM asset
 *
 * NETS callback format (simplified):
 *   { reference, amount, status, timestamp, hmac }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHash, createHmac } from 'crypto';
import { releaseEscrowDeposit } from '@/server/services/escrow';
import { recordTillEntry } from '@/server/services/till';
import { getAdminClient } from '@/server/services/supabase-admin';
import { checkHttpRateLimit } from '@servicesync/api';

const NETS_WEBHOOK_SECRET = process.env.NETS_WEBHOOK_SECRET ?? '';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NetsCallback {
  reference: string;        // Our paynow_ref from the invoice
  amount: number;           // In cents
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
  timestamp: string;        // ISO 8601
  transactionId: string;    // NETS internal transaction ID
  hmac: string;             // HMAC-SHA256 of reference+amount+status+timestamp
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Rate limit: 20 webhook calls/min per IP (see SCALING NOTE in rateLimit.ts).
  // Generous limit because legitimate NETS retries are expected on network failures.
  // Must run before body.read() to avoid consuming the stream on a rejected request.
  const limited = await checkHttpRateLimit(req, 'webhook');
  if (limited) return limited;

  // Task 1.8: Runtime guard — reject all webhooks if secret is missing
  if (!NETS_WEBHOOK_SECRET) {
    console.error('[PayNow Webhook] NETS_WEBHOOK_SECRET is not configured — rejecting request');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
  }

  const supabase = getAdminClient();

  // Read raw body once — we need it for both HMAC + payload hashing.
  const rawBody = await req.text();
  let body: NetsCallback;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // 1. Validate HMAC to prevent spoofing
  if (!validateHmac(body)) {
    console.warn('[PayNow Webhook] HMAC validation failed for reference:', body.reference);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  // 2. Idempotency guard (SEC-L4): short-circuit if we've already seen this event.
  // Insert relies on UNIQUE (source, event_id) — duplicates raise a 23505.
  const payloadHash = createHash('sha256').update(rawBody).digest('hex');
  const { error: dedupeErr } = await supabase.from('webhook_events').insert({
    source: 'paynow',
    event_id: body.transactionId,
    signature: body.hmac,
    payload_hash: payloadHash,
  });
  if (dedupeErr) {
    if ((dedupeErr as { code?: string }).code === '23505') {
      return NextResponse.json({ received: true, action: 'duplicate' });
    }
    console.error('[PayNow Webhook] webhook_events insert failed:', dedupeErr);
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }

  // 3. Only process successful payments
  if (body.status !== 'SUCCESS') {
    await supabase
      .from('webhook_events')
      .update({ processed_at: new Date().toISOString(), result: 'ignored' })
      .eq('source', 'paynow')
      .eq('event_id', body.transactionId);
    return NextResponse.json({ received: true, action: 'ignored', status: body.status });
  }

  // 3. Find the invoice by paynow reference
  const { data: invoice, error: invErr } = await supabase
    .from('invoices')
    .select(
      `id, provider_id, booking_id, amount, status,
       bookings(service_type, deposit_amount, deposit_paid),
       clients(id, name, phone),
       profiles!provider_id(paynow_key)`
    )
    .eq('paynow_ref', body.reference)
    .single();

  if (invErr || !invoice) {
    console.error('[PayNow Webhook] Invoice not found for reference:', body.reference);
    // Return 200 to prevent NETS retrying; log internally
    return NextResponse.json({ received: true, action: 'invoice_not_found' });
  }

  // 4. Guard: already paid
  if (['paid_cash', 'paid_qr'].includes(invoice.status)) {
    return NextResponse.json({ received: true, action: 'already_paid' });
  }

  interface InvoiceJoins {
    clients: { id: string; name: string | null; phone: string | null };
    bookings: { service_type: string | null; deposit_amount: number | null; deposit_paid: boolean | null } | null;
  }
  const joined = invoice as unknown as InvoiceJoins;
  const client = joined.clients;
  const booking = joined.bookings;
  const now = new Date().toISOString();

  // 5. Update invoice to paid
  await supabase
    .from('invoices')
    .update({
      status: 'paid_qr',
      payment_method: 'paynow_qr',
      paid_at: now,
    })
    .eq('id', invoice.id);

  // 6. Record payment in payments table
  await supabase.from('payments').insert({
    invoice_id: invoice.id,
    provider_id: invoice.provider_id,
    amount_cents: body.amount,
    payment_method: 'paynow_qr',
    status: 'confirmed',
    reference: body.reference,
    confirmed_at: body.timestamp,
  });

  // 7. Trigger escrow release (non-blocking)
  releaseEscrowDeposit(invoice.id, 'paynow_paid').catch((err: unknown) =>
    console.error('[PayNow Webhook] Escrow release failed:', err)
  );

  // 8. Record till entry as bank_transfer
  await recordTillEntry({
    providerId: invoice.provider_id,
    invoiceId: invoice.id,
    amountCents: body.amount,
    type: 'bank_transfer',
    description: `${booking?.service_type ?? 'Service'} — ${client?.name ?? 'Client'} (PayNow)`,
  });

  // 9. Send receipt WhatsApp + update CRM (non-blocking)
  // AUTOMATED SENDING DEPRECATED - Must use manual wa.me links now (handled elsewhere on UI)

  // 10. Queue CRM retention workflow
  await supabase
    .from('client_assets')
    .update({
      last_service_date: now,
      next_service_date: addDays(now, 90),
    })
    .eq('client_id', client.id)
    .eq('provider_id', invoice.provider_id);

  await supabase
    .from('webhook_events')
    .update({ processed_at: new Date().toISOString(), result: 'processed' })
    .eq('source', 'paynow')
    .eq('event_id', body.transactionId);

  console.info(
    `[PayNow Webhook] Invoice ${invoice.id} marked paid — ${body.amount} cents — ref: ${body.reference}`
  );

  return NextResponse.json({ received: true, action: 'payment_processed', invoiceId: invoice.id });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validateHmac(body: NetsCallback): boolean {
  if (!NETS_WEBHOOK_SECRET) return false;

  const payload = `${body.reference}|${body.amount}|${body.status}|${body.timestamp}`;
  const expected = createHmac('sha256', NETS_WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');

  // Constant-time comparison to prevent timing attacks
  const a = Buffer.from(expected);
  const b = Buffer.from(body.hmac ?? '');
  if (a.length !== b.length) return false;

  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

// Sprint 3 Task 3.4: SGT-aware date arithmetic. Prevents the UTC-date
// pitfall where 11:30 PM SGT lands on the wrong calendar day.
const SGT_OFFSET_MS = 8 * 60 * 60 * 1000;
function addDays(isoDate: string, days: number): string {
  const utcMs = new Date(isoDate).getTime();
  const sgtDate = new Date(utcMs + SGT_OFFSET_MS);
  sgtDate.setUTCDate(sgtDate.getUTCDate() + days);
  sgtDate.setUTCHours(0, 0, 0, 0);
  return new Date(sgtDate.getTime() - SGT_OFFSET_MS).toISOString();
}
