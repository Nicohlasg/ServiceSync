/**
 * Cash Payment tRPC Router — ServiceSync
 *
 * Endpoints:
 *   cash.getInvoiceSummary    — Fetch balance due for the payment screen
 *   cash.confirmCashPayment   — Record cash collection + trigger handshake
 *   cash.getDailySummary      — Evening till dashboard
 *   cash.getPaymentStatus     — Poll invoice payment status (QR path)
 */

import { z } from 'zod';
import { createHmac } from 'crypto';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '@/server/trpc';
import { generateDigitalHandshakeLink } from '@/server/services/whatsapp-simple';
import { addDaysSGT } from '../utils/date-sgt';
import { releaseEscrowDeposit } from '@/server/services/escrow';
import { recordTillEntry, getDailySummary } from '@/server/services/till';
import { generateCashReceiptPdf } from '@/server/services/pdf';
import { getAdminClient } from '../services/supabase-admin';
import { emitAuditEvent } from '../services/audit';
import type { InvoiceSummary, CashPaymentRecord } from '../payment';

/**
 * SEC-M5: HMAC-bind a cash signature to its (invoice, amount, timestamp).
 * Uses FIELD_ENCRYPTION_KEY (already required by crypto.ts) to avoid introducing
 * a new secret. The returned hex is persisted and can be recomputed during
 * disputes to prove the signature belongs to this specific payment.
 */
function signCashBinding(invoiceId: string, amountCents: number, iso: string): string {
  const key = process.env.FIELD_ENCRYPTION_KEY;
  if (!key) {
    throw new Error('[cash] FIELD_ENCRYPTION_KEY is required to bind signatures');
  }
  return createHmac('sha256', Buffer.from(key, 'hex'))
    .update(`${invoiceId}|${amountCents}|${iso}`)
    .digest('hex');
}

// ---------------------------------------------------------------------------
// Input schemas
// ---------------------------------------------------------------------------

const confirmCashInput = z.object({
  invoiceId: z.string().uuid(),
  amountCollectedCents: z.number().int().positive('Must collect a positive amount'),
  adjustmentCents: z.number().int().default(0),
  adjustmentReason: z
    .enum(['tip', 'discount', 'rounding'])
    .optional(),
  /** Base64 PNG of the touch signature (high-value jobs only) */
  // HIGH-04: Cap signature data URL at ~500KB to prevent memory abuse
  signatureDataUrl: z
    .string()
    .regex(/^data:image\/png;base64,/, 'Must be a base64 PNG data URL')
    .max(500_000, 'Signature image too large (max ~375KB)')
    .optional(),
});

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const cashRouter = router({
  /**
   * Fetches the invoice summary to populate the payment screen.
   * Returns the total, deposit already paid, and the balance due.
   */
  getInvoiceSummary: protectedProcedure
    .input(z.object({ invoiceId: z.string().uuid() }))
    .query(async ({ ctx, input }): Promise<InvoiceSummary> => {
      const { data, error } = await ctx.supabase
        .from('invoices')
        .select(
          `id, booking_id, amount, tax, status, paynow_ref, draft_pdf_url,
           bookings(deposit_amount, service_type, scheduled_date, deposit_paid),
           clients(id, name, phone, address),
           profiles!provider_id(name)`
        )
        .eq('id', input.invoiceId)
        .eq('provider_id', ctx.user.id)
        .single();

      if (error || !data) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Invoice not found' });
      }

      const booking = (data as any).bookings;
      const client = (data as any).clients;
      const provider = (data as any).profiles;

      const totalCents = data.amount;
      const depositCents = booking?.deposit_paid ? (booking.deposit_amount ?? 0) : 0;
      const balanceCents = Math.max(0, totalCents - depositCents);

      return {
        invoiceId: data.id,
        bookingId: data.booking_id,
        clientId: client.id,
        clientName: client.name,
        clientPhone: client.phone,
        providerId: ctx.user.id,
        providerName: provider.name,
        serviceType: booking?.service_type ?? 'Service',
        serviceDate: booking?.scheduled_date ?? new Date().toISOString(),
        totalAmountCents: totalCents,
        depositAmountCents: depositCents,
        balanceDueCents: balanceCents,
        currency: 'SGD',
        paynowQrPayload: data.paynow_ref ?? '',
        draftPdfUrl: data.draft_pdf_url ?? '',
      };
    }),

  /**
   * Core mutation: technician taps "I Collected Cash".
   *
   * Steps (all run server-side, atomically where possible):
   *   1. Validate the invoice belongs to this provider and is not already paid
   *   2. Persist the cash_payment record
   *   3. Update invoice status to paid_cash
   *   4. Generate PDF receipt with signature if provided
   *   5. Fire WhatsApp digital handshake to homeowner
   *   6. Trigger escrow release (deposit → technician bank)
   *   7. Record till entry (cash_in)
   *   8. Trigger CRM asset tagging + retention workflow queue
   */
  confirmCashPayment: protectedProcedure
    .input(confirmCashInput)
    .mutation(async ({ ctx, input }): Promise<CashPaymentRecord> => {
      const providerId = ctx.user.id;
      const {
        invoiceId,
        amountCollectedCents,
        adjustmentCents,
        adjustmentReason,
        signatureDataUrl,
      } = input;

      // 1. Fetch and validate invoice
      const { data: invoice, error: invErr } = await ctx.supabase
        .from('invoices')
        .select(
          `id, booking_id, amount, status, payment_method,
           bookings(deposit_amount, deposit_paid, service_type, scheduled_date),
           clients(id, name, phone, address),
           profiles!provider_id(paynow_key, acra_verified)`
        )
        .eq('id', invoiceId)
        .eq('provider_id', providerId)
        .single();

      if (invErr || !invoice) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Invoice not found' });
      }

      if (['paid_cash', 'paid_qr'].includes(invoice.status)) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Invoice is already paid',
        });
      }

      const client = (invoice as any).clients;
      const booking = (invoice as any).bookings;
      const profile = (invoice as any).profiles;
      const depositCents = booking?.deposit_paid ? (booking.deposit_amount ?? 0) : 0;
      const expectedDueCents = Math.max(0, invoice.amount - depositCents);

      // SEC-C1: Validate adjustment semantics before trusting the amount.
      if (adjustmentCents !== 0 && !adjustmentReason) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'adjustmentReason is required when adjustmentCents is non-zero',
        });
      }
      if (Math.abs(adjustmentCents) > expectedDueCents) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Adjustment cannot exceed amount due',
        });
      }
      if (adjustmentReason === 'tip' && adjustmentCents <= 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Tip adjustment must be positive',
        });
      }
      if (adjustmentReason === 'discount' && adjustmentCents >= 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Discount adjustment must be negative',
        });
      }
      if (adjustmentReason === 'rounding' && Math.abs(adjustmentCents) > 100) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Rounding adjustment must be within ±$1',
        });
      }

      // SEC-C1: Pin the collected amount to the server-computed expected amount.
      // Prevents a compromised client from under-reporting cash collection,
      // which would corrupt till reconciliation and IRAS/PDPA audit trails and
      // let the technician bypass the ≥ $500 signature rule below.
      if (amountCollectedCents !== expectedDueCents + adjustmentCents) {
        console.warn('[Cash] SEC-C1 amount mismatch', {
          invoiceId,
          expectedDueCents,
          adjustmentCents,
          amountCollectedCents,
        });
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Collected amount does not match invoice total',
        });
      }

      const signatureRequired =
        !!signatureDataUrl || amountCollectedCents >= 50_000; // ≥ $500

      // HIGH-03: Enforce signature for high-value cash payments (≥ $500)
      if (amountCollectedCents >= 50_000 && !signatureDataUrl) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Signature is required for cash payments of $500 or more',
        });
      }

      const now = new Date().toISOString();

      // 2a. Upload signature to Supabase Storage (if provided)
      let signatureStorageUrl: string | null = null;
      if (signatureDataUrl) {
        const base64Data = signatureDataUrl.replace(/^data:image\/png;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        const filePath = `signatures/${providerId}/${invoiceId}.png`;

        const admin = getAdminClient();
        const { error: uploadErr } = await admin.storage
          .from('cash-receipts')
          .upload(filePath, buffer, {
            contentType: 'image/png',
            upsert: true,
          });

        if (!uploadErr) {
          const { data: urlData } = admin.storage
            .from('cash-receipts')
            .getPublicUrl(filePath);
          signatureStorageUrl = urlData.publicUrl;
        } else {
          console.error('[Cash] Signature upload error:', uploadErr.message);
        }
      }

      // SEC-M5: bind the signature to this specific payment tuple.
      // Only meaningful when a signature was actually captured.
      const signatureBindingHmac = signatureDataUrl
        ? signCashBinding(invoiceId, amountCollectedCents, now)
        : null;

      // 2b. Persist cash_payment record (store Storage URL, not raw base64)
      const { data: cashRecord, error: cashErr } = await ctx.supabase
        .from('cash_payments')
        .insert({
          invoice_id: invoiceId,
          provider_id: providerId,
          client_id: client.id,
          amount_due_cents: expectedDueCents,
          amount_collected_cents: amountCollectedCents,
          adjustment_cents: adjustmentCents,
          adjustment_reason: adjustmentReason,
          signature_required: signatureRequired,
          signature_data: signatureStorageUrl,
          signature_confirmed_cents: signatureDataUrl ? amountCollectedCents : null,
          signature_collected_at: signatureDataUrl ? now : null,
          signature_binding_hmac: signatureBindingHmac,
          collected_at: now,
        })
        .select()
        .single();

      if (cashErr || !cashRecord) {
        console.error('[Cash] insert error:', cashErr?.message);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to record cash payment',
        });
      }

      // 3. Update invoice status
      await ctx.supabase
        .from('invoices')
        .update({
          status: 'paid_cash',
          payment_method: depositCents > 0 ? 'mixed' : 'cash',
          cash_amount_collected_cents: amountCollectedCents,
          cash_collected_at: now,
          paid_at: now,
        })
        .eq('id', invoiceId);

      // 4. Generate PDF receipt (non-blocking — don't fail the mutation if it errors)
      let receiptUrl = `${process.env.NEXT_PUBLIC_APP_URL}/receipts/${invoiceId}`;
      generateCashReceiptPdf({
        invoiceId,
        providerId,
        providerName: ctx.user.user_metadata?.name ?? 'Your technician',
        providerAcraVerified: !!profile?.acra_verified,
        clientName: client.name,
        clientAddress: client.address,
        serviceType: booking?.service_type ?? 'Service',
        serviceDate: booking?.scheduled_date ?? now,
        lineItems: [{ description: booking?.service_type ?? 'Service', amountCents: invoice.amount }],
        totalAmountCents: invoice.amount,
        depositAmountCents: depositCents,
        amountCollectedCents,
        adjustmentCents,
        adjustmentReason,
        warrantyDays: 90,
        signatureDataUrl,
        signedAt: signatureDataUrl ? now : undefined,
        collectedAt: now,
      })
        .then(async (res) => {
          if (res.success && res.pdfUrl) {
            receiptUrl = res.pdfUrl;
            await ctx.supabase
              .from('invoices')
              .update({ pdf_url: res.pdfUrl })
              .eq('id', invoiceId);
          }
        })
        .catch((err) => console.error('[Cash] PDF generation error:', err));

      // 5. Generate WhatsApp digital handshake link (wa.me — no API needed)
      const providerName = ctx.user.user_metadata?.name ?? 'Your technician';
      const handshakeLink = generateDigitalHandshakeLink({
        clientName: client.name,
        clientPhone: client.phone,
        invoiceUrl: receiptUrl,
        amount: amountCollectedCents,
        serviceType: booking?.service_type ?? 'Service',
        technicianName: providerName,
      });

      // Mark handshake link as generated on cash record
      await ctx.supabase
        .from('cash_payments')
        .update({
          whatsapp_confirmation_sent: true,
          whatsapp_message_id: handshakeLink,
        })
        .eq('id', cashRecord.id);

      // 6. Trigger escrow release (fire-and-forget; failures are retried by a job)
      releaseEscrowDeposit(invoiceId, 'cash_confirmed').catch((err) =>
        console.error('[Cash] Escrow release error:', err)
      );

      // 7. Record till entry
      await recordTillEntry({
        providerId,
        invoiceId,
        amountCents: amountCollectedCents,
        type: 'cash_in',
        description: `${booking?.service_type ?? 'Service'} — ${client.name}`,
      });

      // 8. Queue CRM retention (mark asset as serviced; retention cron picks this up)
      await ctx.supabase
        .from('client_assets')
        .update({
          last_service_date: now,
          next_service_date: addDaysSGT(now, 90),
        })
        .eq('client_id', client.id)
        .eq('provider_id', providerId);

      void emitAuditEvent({
        actorId: providerId,
        actorIp: ctx.clientIp,
        entityType: 'cash_payment',
        entityId: cashRecord.id,
        action: 'payment_confirm',
        diff: {
          invoice_id: invoiceId,
          amount_collected_cents: amountCollectedCents,
          adjustment_cents: adjustmentCents,
          adjustment_reason: adjustmentReason ?? null,
          signature_captured: !!signatureDataUrl,
          signature_binding_hmac: signatureBindingHmac,
        },
      });

      return {
        id: cashRecord.id,
        invoiceId,
        providerId,
        clientId: client.id,
        amountDueCents: cashRecord.amount_due_cents,
        amountCollectedCents,
        adjustmentCents,
        adjustmentReason,
        whatsappConfirmationSent: true,
        whatsappMessageId: handshakeLink,
        signatureRequired,
        signatureDataUrl,
        signatureConfirmedAmountCents: signatureDataUrl ? amountCollectedCents : undefined,
        signatureCollectedAt: signatureDataUrl ? now : undefined,
        collectedAt: now,
      };
    }),

  /**
   * Returns the aggregated till summary for the technician's current day.
   * Used by the evening dashboard to show cash vs. bank split.
   */
  getDailySummary: protectedProcedure
    .input(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }))
    .query(async ({ ctx, input }) => {
      return getDailySummary(ctx.user.id, input.date);
    }),

  /**
   * Polls the payment status of an invoice.
   * Used by the "Client Paid Via QR" path to detect PayNow webhook updates.
   */
  getPaymentStatus: protectedProcedure
    .input(z.object({ invoiceId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from('invoices')
        .select('id, status, paid_at, payment_method')
        .eq('id', input.invoiceId)
        .eq('provider_id', ctx.user.id)
        .single();

      if (error || !data) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      return {
        invoiceId: data.id,
        status: data.status as string,
        paidAt: data.paid_at,
        paymentMethod: data.payment_method,
        isPaid: ['paid_cash', 'paid_qr'].includes(data.status),
      };
    }),

  /**
   * Task 1.4: Void a cash payment within 24 hours.
   * Reverses the till entry, resets invoice to pending, and records the reason.
   */
  voidCashPayment: protectedProcedure
    .input(z.object({
      invoiceId: z.string().uuid(),
      reason: z.string().min(3).max(500),
    }))
    .mutation(async ({ ctx, input }) => {
      const providerId = ctx.user.id;
      const now = new Date();

      // Fetch cash payment
      const { data: cashPayment, error: cpErr } = await ctx.supabase
        .from('cash_payments')
        .select('id, collected_at, amount_collected_cents, voided_at')
        .eq('invoice_id', input.invoiceId)
        .eq('provider_id', providerId)
        .single();

      if (cpErr || !cashPayment) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Cash payment not found' });
      }

      if (cashPayment.voided_at) {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Payment already voided' });
      }

      // Enforce 24-hour void window
      const collectedAt = new Date(cashPayment.collected_at);
      const hoursSince = (now.getTime() - collectedAt.getTime()) / (1000 * 60 * 60);
      if (hoursSince > 24) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Cash payments can only be voided within 24 hours of collection',
        });
      }

      // Mark cash payment as voided
      await ctx.supabase
        .from('cash_payments')
        .update({
          voided_at: now.toISOString(),
          voided_by: providerId,
          void_reason: input.reason,
        })
        .eq('id', cashPayment.id);

      // Reset invoice status back to pending
      await ctx.supabase
        .from('invoices')
        .update({
          status: 'pending',
          payment_method: null,
          paid_at: null,
          cash_amount_collected_cents: null,
          cash_collected_at: null,
        })
        .eq('id', input.invoiceId)
        .eq('provider_id', providerId);

      // Reverse till entry
      await recordTillEntry({
        providerId,
        invoiceId: input.invoiceId,
        amountCents: -cashPayment.amount_collected_cents,
        type: 'cash_in',
        description: `VOID — ${input.reason}`,
      });

      void emitAuditEvent({
        actorId: providerId,
        actorIp: ctx.clientIp,
        entityType: 'cash_payment',
        entityId: cashPayment.id,
        action: 'payment_void',
        diff: {
          invoice_id: input.invoiceId,
          void_reason: input.reason,
          original_amount_cents: cashPayment.amount_collected_cents,
        },
      });

      return { success: true, voidedAt: now.toISOString() };
    }),

  /**
   * Manually confirms that a PayNow QR payment was received.
   * Used when there's no webhook integration — the technician confirms
   * they received the money before proceeding.
   */
  confirmQrPayment: protectedProcedure
    .input(z.object({ invoiceId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { data: invoice, error: fetchErr } = await ctx.supabase
        .from('invoices')
        .select(`id, status, amount, booking_id,
                 bookings(service_type, deposit_amount, deposit_paid),
                 clients(id, name)`)
        .eq('id', input.invoiceId)
        .eq('provider_id', ctx.user.id)
        .single();

      if (fetchErr || !invoice) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Invoice not found' });
      }

      if (['paid_cash', 'paid_qr'].includes(invoice.status)) {
        // Already paid — idempotent
        return { invoiceId: invoice.id, status: 'paid_qr', alreadyPaid: true };
      }

      const now = new Date().toISOString();
      const booking = (invoice as any).bookings;
      const client = (invoice as any).clients;

      const { error: updateErr } = await ctx.supabase
        .from('invoices')
        .update({
          status: 'paid_qr',
          payment_method: 'paynow_qr',
          paid_at: now,
        })
        .eq('id', input.invoiceId)
        .eq('provider_id', ctx.user.id);

      if (updateErr) {
        console.error('[Cash] confirmQrPayment error:', updateErr.message);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to confirm payment' });
      }

      // Task 1.2: Insert a payments row so manual QR confirmations are visible
      // to the reconciliation query (mirrors what the PayNow webhook does).
      await ctx.supabase.from('payments').insert({
        invoice_id: input.invoiceId,
        provider_id: ctx.user.id,
        amount_cents: invoice.amount,
        payment_method: 'paynow_qr',
        status: 'confirmed',
        reference: `manual-qr-${input.invoiceId.slice(-8)}`,
        confirmed_at: now,
      });

      // Record the FULL invoice amount as a bank_transfer in the daily till.
      // This ensures the till summary correctly reports QR payments as
      // "bank transfers processing" instead of splitting them incorrectly.
      await recordTillEntry({
        providerId: ctx.user.id,
        invoiceId: input.invoiceId,
        amountCents: invoice.amount,
        type: 'bank_transfer',
        description: `${booking?.service_type ?? 'Service'} — ${client?.name ?? 'Client'} (PayNow)`,
      });

      // Release escrow deposit if one was taken (fire-and-forget)
      releaseEscrowDeposit(input.invoiceId, 'paynow_paid').catch((err) =>
        console.error('[Cash] Escrow release error (QR):', err)
      );

      void emitAuditEvent({
        actorId: ctx.user.id,
        actorIp: ctx.clientIp,
        entityType: 'invoice',
        entityId: input.invoiceId,
        action: 'payment_confirm_qr',
        diff: {
          previous_status: invoice.status,
          new_status: 'paid_qr',
          amount: invoice.amount,
        },
      });

      return { invoiceId: invoice.id, status: 'paid_qr', alreadyPaid: false };
    }),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// addDays moved to utils/date-sgt.ts as addDaysSGT (Sprint 3 Task 3.4)
