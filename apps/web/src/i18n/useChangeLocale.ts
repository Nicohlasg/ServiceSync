'use client';

import { useCallback, useTransition } from 'react';
import { LOCALE_COOKIE, type Locale } from './config';

// Writes the locale cookie and hard-reloads the current URL.
//
// Masterplan §10 risk: next-intl renders messages server-side at request
// time. Swapping messages on the client without a reload produces hydration
// mismatches (CJK vs Latin glyph metrics shift layout, icons may re-mount).
// A full reload is the safest UX for a low-literacy cohort — they see the
// interface flip cleanly rather than flicker. Performance cost is one extra
// RTT per preference change, which happens at most a handful of times ever.

const ONE_YEAR = 60 * 60 * 24 * 365;

export function useChangeLocale() {
  const [isPending, startTransition] = useTransition();

  const change = useCallback((next: Locale) => {
    if (typeof document === 'undefined') return;

    // Cookie: authoritative for SSR on next paint.
    document.cookie = `${LOCALE_COOKIE}=${next}; Path=/; Max-Age=${ONE_YEAR}; SameSite=Lax`;

    // localStorage: fast-path cache for client-only surfaces (landing hero
    // flash, tour replay). Profile write happens in the caller when the user
    // is authenticated — see Task 3 language picker.
    try {
      window.localStorage.setItem('locale', next);
    } catch {
      // Storage may be blocked (private mode, strict SameSite). Non-fatal —
      // cookie is the source of truth on the server.
    }

    startTransition(() => {
      // Hard reload: bypass client cache, let server resolve new messages.
      window.location.reload();
    });
  }, []);

  return { change, isPending };
}
