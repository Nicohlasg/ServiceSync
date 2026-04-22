'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';
import { toast } from 'sonner';

/**
 * AuthGuard — subscribes to supabase.auth.onAuthStateChange globally.
 *
 * When a SIGNED_OUT or TOKEN_REFRESHED (failed) event fires while the user
 * is on a /dashboard route, redirect to /login. This handles:
 *   - JWT expiry
 *   - Sign-out from another tab
 *   - Session revocation server-side
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event) => {
        if (event === 'SIGNED_OUT') {
          // Only redirect if on a protected route
          if (pathname?.startsWith('/dashboard')) {
            toast.error('Your session has expired. Please log in again.');
            router.push('/login');
          }
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [pathname, router]);

  return <>{children}</>;
}
