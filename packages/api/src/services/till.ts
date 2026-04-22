/**
 * Till / Cash Float Service — ServiceSync
 *
 * Tracks the daily split between bank transfers (PayNow) and physical cash
 * for each technician. Replaces the paper notebook tally.
 *
 * Dashboard output example:
 *   Total earned today:         $350.00
 *   Bank transfers processing:  $200.00
 *   Physical cash in pocket:    $150.00  ← "Bank this at the ATM"
 */

import { getAdminClient } from './supabase-admin';
import type { TillEntry, TillSummary } from '../payment';

const supabase = getAdminClient();

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Records a new entry in the technician's daily till.
 * Called automatically after a payment is confirmed (either cash or PayNow).
 */
export async function recordTillEntry(params: {
  providerId: string;
  invoiceId: string;
  amountCents: number;
  type: 'cash_in' | 'bank_transfer';
  description: string;
  date?: string; // ISO date; defaults to today (SGT)
}): Promise<TillEntry | null> {
  const date = params.date ?? todaySGT();

  const { data, error } = await supabase
    .from('till_entries')
    .insert({
      provider_id: params.providerId,
      invoice_id: params.invoiceId,
      date,
      amount_cents: params.amountCents,
      entry_type: params.type,
      description: params.description,
    })
    .select()
    .single();

  if (error) {
    console.error('[Till] recordTillEntry failed:', error.message);
    return null;
  }

  return mapRow(data);
}

/**
 * Returns the aggregated daily summary for a technician.
 * Shown in the evening dashboard.
 */
export async function getDailySummary(
  providerId: string,
  date?: string
): Promise<TillSummary> {
  const targetDate = date ?? todaySGT();

  const { data: rows, error } = await supabase
    .from('till_entries')
    .select('*')
    .eq('provider_id', providerId)
    .eq('date', targetDate)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[Till] getDailySummary failed:', error.message);
  }

  const entries: TillEntry[] = (rows ?? []).map(mapRow);

  const bankTransfersCents = entries
    .filter((e) => e.type === 'bank_transfer')
    .reduce((sum, e) => sum + e.amountCents, 0);

  const cashCents = entries
    .filter((e) => e.type === 'cash_in')
    .reduce((sum, e) => sum + e.amountCents, 0);

  const totalCents = bankTransfersCents + cashCents;

  const bankingHint =
    cashCents > 0
      ? `Deposit ${formatCents(cashCents)} in cash at the ATM today`
      : 'No cash collected today — all payments via PayNow';

  return {
    providerId,
    date: targetDate,
    totalEarnedCents: totalCents,
    bankTransfersProcessingCents: bankTransfersCents,
    cashInPocketCents: cashCents,
    bankingHint,
    entries,
  };
}

/**
 * Returns till entries for a date range (used by the weekly/monthly report).
 */
export async function getTillRange(
  providerId: string,
  fromDate: string,
  toDate: string
): Promise<TillEntry[]> {
  const { data, error } = await supabase
    .from('till_entries')
    .select('*')
    .eq('provider_id', providerId)
    .gte('date', fromDate)
    .lte('date', toDate)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Till] getTillRange failed:', error.message);
    return [];
  }

  return (data ?? []).map(mapRow);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns today's date in Singapore timezone (UTC+8) as 'YYYY-MM-DD' */
function todaySGT(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Singapore',
  }).format(new Date()); // en-CA gives YYYY-MM-DD format
}

function formatCents(cents: number): string {
  return new Intl.NumberFormat('en-SG', {
    style: 'currency',
    currency: 'SGD',
  }).format(cents / 100);
}

function mapRow(row: Record<string, any>): TillEntry {
  return {
    id: row.id,
    providerId: row.provider_id,
    date: row.date,
    invoiceId: row.invoice_id ?? undefined,
    amountCents: row.amount_cents,
    type: row.entry_type as 'cash_in' | 'bank_transfer',
    description: row.description,
    createdAt: row.created_at,
  };
}
