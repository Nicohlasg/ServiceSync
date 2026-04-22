/**
 * Payment Domain Types — ServiceSync
 * Covers: cash reconciliation, digital handshake, signature capture,
 * escrow release, and till (cash float) management.
 */

// ---------------------------------------------------------------------------
// Core Enums
// ---------------------------------------------------------------------------

export type PaymentMethod = 'paynow_qr' | 'cash' | 'mixed';

export type InvoicePaymentStatus =
  | 'pending'
  | 'awaiting_qr_confirmation'
  | 'paid_cash'
  | 'paid_qr'
  | 'disputed';

export type EscrowStatus = 'held' | 'pending' | 'processing' | 'released' | 'failed';

export type CashAdjustmentReason = 'tip' | 'discount' | 'rounding';

export type TillEntryType = 'cash_in' | 'bank_transfer';

// ---------------------------------------------------------------------------
// Invoice / Booking
// ---------------------------------------------------------------------------

/** Minimal invoice summary shown on the payment screen */
export interface InvoiceSummary {
  invoiceId: string;
  bookingId: string;
  clientId: string;
  clientName: string;
  /** E.164 format, e.g. +6591234567 */
  clientPhone: string;
  providerId: string;
  providerName: string;
  serviceType: string;
  serviceDate: string;       // ISO date string
  /** All monetary values are in cents (SGD) to avoid floating-point issues */
  totalAmountCents: number;
  depositAmountCents: number;
  balanceDueCents: number;   // totalAmountCents - depositAmountCents
  currency: 'SGD';
  /** PayNow QR payload string (EMVCo format) */
  paynowQrPayload: string;
  /** Signed URL for the draft invoice PDF */
  draftPdfUrl: string;
}

// ---------------------------------------------------------------------------
// Cash Payment
// ---------------------------------------------------------------------------

/** Input when technician confirms cash was collected */
export interface ConfirmCashPaymentInput {
  invoiceId: string;
  /** Actual cash physically handed over — may differ from balanceDue */
  amountCollectedCents: number;
  /**
   * Signed adjustment from the stepper.
   * Positive = tip (homeowner gave more, e.g. "keep the change")
   * Negative = discount (technician gave a rebate)
   */
  adjustmentCents: number;
  adjustmentReason?: CashAdjustmentReason;
  /** Base64-encoded PNG of the signature canvas (only present if amount ≥ threshold) */
  signatureDataUrl?: string;
}

/** Persisted cash payment record returned from the server */
export interface CashPaymentRecord {
  id: string;
  invoiceId: string;
  providerId: string;
  clientId: string;
  amountDueCents: number;
  amountCollectedCents: number;
  adjustmentCents: number;
  adjustmentReason?: CashAdjustmentReason;
  whatsappConfirmationSent: boolean;
  whatsappMessageId?: string;
  signatureRequired: boolean;
  signatureDataUrl?: string;
  signatureConfirmedAmountCents?: number;
  signatureCollectedAt?: string;
  collectedAt: string;
}

// ---------------------------------------------------------------------------
// WhatsApp Digital Handshake
// ---------------------------------------------------------------------------

export interface WhatsAppCashConfirmationParams {
  /** E.164 phone number of the homeowner */
  clientPhone: string;
  clientName: string;
  providerName: string;
  /** Amount in cents */
  amountCollectedCents: number;
  serviceType: string;
  serviceDate: string;
  /** Publicly accessible URL to the final e-receipt PDF */
  receiptUrl: string;
  invoiceId: string;
}

export interface WhatsAppSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Signature Capture
// ---------------------------------------------------------------------------

/** Data emitted by the SignatureCapture component on completion */
export interface SignatureData {
  /** Base64-encoded PNG image of the signature */
  dataUrl: string;
  /** Amount the client signed off on, in cents */
  confirmedAmountCents: number;
  signedAt: string;
}

/**
 * Cash amounts at or above this threshold (in cents) trigger the
 * optional glass-screen signature flow.
 * Default: $500.00 SGD
 */
export const SIGNATURE_THRESHOLD_CENTS = 50_000;

// ---------------------------------------------------------------------------
// Escrow Release
// ---------------------------------------------------------------------------

export interface EscrowReleaseRecord {
  id: string;
  invoiceId: string;
  bookingId: string;
  providerId: string;
  depositAmountCents: number;
  transactionFeeCents: number;
  netReleasedCents: number;       // depositAmountCents - transactionFeeCents
  destinationPaynowKey: string;   // NRIC or mobile number registered with PayNow
  triggeredBy: 'cash_confirmed' | 'paynow_paid';
  status: EscrowStatus;
  initiatedAt: string;
  completedAt?: string;
  failureReason?: string;
}

export interface EscrowReleaseResult {
  success: boolean;
  record?: EscrowReleaseRecord;
  error?: string;
}

// ---------------------------------------------------------------------------
// Till / Cash Float
// ---------------------------------------------------------------------------

export interface TillEntry {
  id: string;
  providerId: string;
  date: string;          // ISO date 'YYYY-MM-DD'
  invoiceId?: string;
  amountCents: number;
  type: TillEntryType;
  description: string;
  createdAt: string;
}

/** Aggregated daily summary shown in the technician's evening dashboard */
export interface TillSummary {
  providerId: string;
  date: string;
  /** Sum of all earnings (cash + bank transfers) in cents */
  totalEarnedCents: number;
  /** PayNow payments currently processing (credited to bank, not physical) */
  bankTransfersProcessingCents: number;
  /** Physical cash the technician has in pocket */
  cashInPocketCents: number;
  /** Formatted hint, e.g. "Bank $150.00 at the ATM today" */
  bankingHint: string;
  entries: TillEntry[];
}

// ---------------------------------------------------------------------------
// Formatted Display Helpers (UI layer — no business logic)
// ---------------------------------------------------------------------------

/** Converts cents integer to a display string, e.g. 8500 → "$85.00" */
export function formatCents(cents: number, currency = 'SGD'): string {
  return new Intl.NumberFormat('en-SG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

/** Returns the exact whole-dollar string a technician should say, e.g. "$85" */
export function formatCollectionAmount(cents: number): string {
  if (cents % 100 === 0) {
    return `$${cents / 100}`;
  }
  return formatCents(cents);
}
