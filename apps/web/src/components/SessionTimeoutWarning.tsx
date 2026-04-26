'use client';

import { useEffect, useRef, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';
import { toast } from 'sonner';
import { usePathname } from 'next/navigation';

/**
 * Sprint 2 Task 2.6 — Session timeout warning.
 *
 * Monitors JWT expiry and shows a warning toast 5 minutes before expiry.
 * Offers silent refresh so Uncle Teck doesn't lose form data when the
 * session expires during a long form fill.
 *
 * Only active on /dashboard routes (protected pages).
 */

const WARN_BEFORE_MS = 5 * 60 * 1000; // 5 minutes
const CHECK_INTERVAL_MS = 60 * 1000;   // check every 60s

export function SessionTimeoutWarning() {
  const pathname = usePathname();
  const warningShownRef = useRef(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    // Only monitor on protected routes
    if (!pathname?.startsWith('/dashboard')) return;

    const supabase = createSupabaseBrowserClient();

    async function checkSession() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const expiresAt = session.expires_at;
        if (!expiresAt) return;

        const expiresMs = expiresAt * 1000;
        const remaining = expiresMs - Date.now();

        if (remaining <= 0) {
          // Already expired — AuthGuard handles the redirect
          return;
        }

        if (remaining <= WARN_BEFORE_MS && !warningShownRef.current) {
          warningShownRef.current = true;
          const minutes = Math.max(1, Math.ceil(remaining / 60_000));

          toast.warning(
            `Session expires in ~${minutes} min. Tap to refresh.`,
            {
              duration: 30_000,
              action: {
                label: 'Refresh',
                onClick: async () => {
                  setRefreshing(true);
                  try {
                    const { error } = await supabase.auth.refreshSession();
                    if (error) {
                      toast.error('Could not refresh session. Please save your work and log in again.');
                    } else {
                      toast.success('Session refreshed.');
                      warningShownRef.current = false;
                    }
                  } catch {
                    toast.error('Refresh failed. Please log in again.');
                  }
                  setRefreshing(false);
                },
              },
            },
          );
        }

        // Reset flag if session was refreshed (new expiry pushed out)
        if (remaining > WARN_BEFORE_MS) {
          warningShownRef.current = false;
        }
      } catch {
        // Session check failed — non-fatal
      }
    }

    // Initial check
    void checkSession();

    // Periodic checks
    const interval = setInterval(checkSession, CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [pathname]);

  return null;
}
