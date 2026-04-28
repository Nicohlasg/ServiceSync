'use client';

import { useCallback, useEffect, useState } from 'react';

import { api } from '@/lib/api';

// Masterplan §4.2 + P0 Task 6 — hybrid gating.
//
// Source of truth:  profiles.tutorial_completed_at (Supabase, cross-device)
// Fast-path cache:  localStorage 'tutorial-seen-v1' (avoids a flash on return)
//
// Precedence on mount (sync → async):
//   1. localStorage === 'true'       → hide immediately, no spinner
//   2. localStorage unset/blocked    → show after 600 ms mount delay
//   3. Profile fetch resolves with tutorialCompletedAt !== null → hide +
//      promote cache so next session doesn't need the query
//   4. Profile query errors with UNAUTHORIZED → pre-auth caller, fall back
//      to localStorage-only behaviour (step 1 or 2 decision stands)

const STORAGE_KEY = 'tutorial-seen-v1';
const MOUNT_DELAY_MS = 600;

type GateState = 'unknown' | 'show' | 'hide';

function readCache(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function writeCache(seen: boolean) {
  if (typeof window === 'undefined') return;
  try {
    if (seen) window.localStorage.setItem(STORAGE_KEY, 'true');
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage blocked (Safari private mode, strict sandboxing). Non-fatal —
    // server column is authoritative; worst case overlay re-shows once per
    // tab until the server write lands.
  }
}

export function useTutorialGate() {
  const [state, setState] = useState<GateState>(() => (readCache() ? 'hide' : 'unknown'));

  const utils = api.useUtils();
  const tutorialStatus = api.provider.getTutorialStatus.useQuery(undefined, {
    // Stale time is effectively forever — completion is a write-once event.
    staleTime: Infinity,
    // Don't retry UNAUTHORIZED (pre-auth callers hit this path legitimately).
    retry: (failureCount, err) => {
      const code = (err as { data?: { code?: string } })?.data?.code;
      if (code === 'UNAUTHORIZED' || code === 'NOT_FOUND') return false;
      return failureCount < 2;
    },
  });
  const markMutation = api.provider.markTutorialComplete.useMutation();
  const resetMutation = api.provider.resetTutorialCompletion.useMutation();

  // Step 1+2 — sync decision from cache, then 600 ms trigger if unseen.
  useEffect(() => {
    if (state !== 'unknown') return;
    const t = window.setTimeout(() => {
      setState('show');
    }, MOUNT_DELAY_MS);
    return () => clearTimeout(t);
  }, [state]);

  // Step 3 — DB confirms completion. Promote cache + hide overlay.
  useEffect(() => {
    if (tutorialStatus.data?.tutorialCompletedAt) {
      writeCache(true);
    }
  }, [tutorialStatus.data?.tutorialCompletedAt]);

  const markComplete = useCallback(
    async (reason: 'completed' | 'skipped') => {
      writeCache(true);
      setState('hide');

      // Fire-and-forget server write. Pre-auth callers will throw UNAUTHORIZED —
      // that's fine; cookie/localStorage is enough until the profile exists.
      try {
        await markMutation.mutateAsync({ reason });
      } catch (err) {
        const code = (err as { data?: { code?: string } })?.data?.code;
        // Intentionally silent for UNAUTHORIZED / NOT_FOUND. Other errors we
        // log for Sentry to pick up, but don't block the user.
        if (code && code !== 'UNAUTHORIZED' && code !== 'NOT_FOUND') {
          console.warn('[tutorial] markComplete failed:', err);
        }
      }
    },
    [markMutation]
  );

  const reset = useCallback(async () => {
    writeCache(false);
    setState('show');
    // Invalidate so the dashboard's fresh mount refetches instead of serving
    // stale cached data (staleTime: Infinity means setData alone doesn't
    // survive a cross-page navigation).
    await utils.provider.getTutorialStatus.invalidate();
    try {
      await resetMutation.mutateAsync();
    } catch (err) {
      const code = (err as { data?: { code?: string } })?.data?.code;
      if (code && code !== 'UNAUTHORIZED') {
        console.warn('[tutorial] reset failed:', err);
      }
    }
  }, [resetMutation, utils.provider.getTutorialStatus]);

  return {
    /** True when the overlay should be mounted + visible. */
    shouldShow: state === 'show' && !tutorialStatus.data?.tutorialCompletedAt,
    /** Persist completion to both layers. Idempotent on the server. */
    markComplete,
    /** Clear both layers so the tour plays again on next mount. */
    reset,
  };
}
