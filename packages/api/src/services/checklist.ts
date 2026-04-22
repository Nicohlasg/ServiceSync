/**
 * Onboarding checklist helpers (masterplan §6 P0 Task 7).
 *
 * Server-side auto-marking for the post-tour activation checklist. Called
 * from `provider.addService` and `clients.create` success paths so the
 * dashboard checklist rows fill in without requiring a separate client
 * round-trip. Best-effort: always wrapped in try/catch by callers — a
 * telemetry failure must never surface as a tRPC error on the main write.
 *
 * Shape of `profiles.onboarding_checklist` (JSONB, nullable):
 *   {
 *     serviceAddedAt:    string | null,
 *     clientAddedAt:     string | null,
 *     paynowPreviewedAt: string | null,
 *     hiddenAt:          string | null
 *   }
 *
 * First-completion-wins: existing timestamps are preserved so deleting the
 * only service/client doesn't retrigger the onboarding nudge — matches the
 * same rule used in `markChecklistItem` on the router.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export type ChecklistItem = 'service' | 'client' | 'paynow';

const KEY_MAP: Record<ChecklistItem, 'serviceAddedAt' | 'clientAddedAt' | 'paynowPreviewedAt'> = {
  service: 'serviceAddedAt',
  client: 'clientAddedAt',
  paynow: 'paynowPreviewedAt',
};

/**
 * Marks a checklist item complete if not already set. Does NOT throw —
 * catches and logs all errors so it can safely be awaited or fire-and-forget
 * from inside success handlers without leaking into tRPC error responses.
 */
export async function markChecklistItemServerSide(
  supabase: SupabaseClient,
  userId: string,
  item: ChecklistItem
): Promise<void> {
  try {
    const { data: existing, error: readErr } = await supabase
      .from('profiles')
      .select('onboarding_checklist')
      .eq('id', userId)
      .single();

    if (readErr || !existing) {
      console.warn('[checklist] read failed, skipping auto-mark:', readErr?.message);
      return;
    }

    const current = (existing.onboarding_checklist ?? {}) as Record<string, string | null>;
    const key = KEY_MAP[item];

    // First-completion-wins — preserve original timestamp on subsequent writes.
    if (current[key]) return;

    const next = { ...current, [key]: new Date().toISOString() };

    const { error: writeErr } = await supabase
      .from('profiles')
      .update({ onboarding_checklist: next })
      .eq('id', userId);

    if (writeErr) {
      console.warn('[checklist] auto-mark write failed:', writeErr.message);
    }
  } catch (err) {
    console.warn('[checklist] unexpected error:', err);
  }
}
