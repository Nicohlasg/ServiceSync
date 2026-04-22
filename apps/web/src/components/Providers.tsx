'use client';

import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import { useState } from 'react';
import superjson from 'superjson';
import { api } from '@/lib/api';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import dynamic from 'next/dynamic';
import { AuthGuard } from '@/components/AuthGuard';

// Lazy-load non-critical UI overlays — these render nothing on mount
// (they wait for browser events / timeouts), so deferring them avoids
// ~8-12 KB of JS in the initial client bundle.
const PwaInstallPrompt = dynamic(
  () => import('@/components/PwaInstallPrompt').then(m => ({ default: m.PwaInstallPrompt })),
  { ssr: false },
);
const OfflineDetector = dynamic(
  () => import('@/components/OfflineDetector').then(m => ({ default: m.OfflineDetector })),
  { ssr: false },
);
const CookieConsent = dynamic(
  () => import('@/components/CookieConsent').then(m => ({ default: m.CookieConsent })),
  { ssr: false },
);

interface TRPCErrorLike {
  data?: { code?: string };
  message?: string;
}

function getErrorInfo(error: unknown) {
  if (typeof error !== 'object' || error === null) {
    return { code: undefined, message: undefined };
  }

  const maybeError = error as TRPCErrorLike;
  return {
    code: maybeError.data?.code,
    message: typeof maybeError.message === 'string' ? maybeError.message : undefined,
  };
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => {
    const handleError = (error: unknown) => {
      const { code, message } = getErrorInfo(error);
      const isAuthError =
        code === 'UNAUTHORIZED' ||
        message?.includes('UNAUTHORIZED') ||
        message?.includes('Not authenticated');

      // Fresh signups don't have a profiles row yet. NOT_FOUND is the
      // contract for "no profile" and is handled per-feature (checklist
      // renders fallback, tutorial hook retries). Don't toast the user.
      const isMissingProfile =
        code === 'NOT_FOUND' ||
        message === 'Profile not found';

      if (isAuthError) {
        toast.error("Session expired. Please log in again.");
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
          window.location.href = '/login';
        }
      } else if (isMissingProfile) {
        return;
      } else {
        toast.error(message || 'Something went wrong');
      }
    };

    return new QueryClient({
      queryCache: new QueryCache({ onError: handleError }),
      mutationCache: new MutationCache({ onError: handleError }),
      defaultOptions: {
        queries: {
          staleTime: 5000,
          refetchOnWindowFocus: false,
        },
      },
    });
  });

  const [trpcClient] = useState(() =>
    api.createClient({
      links: [
        httpBatchLink({
          url: '/api/trpc',
          transformer: superjson,
        }),
      ],
    })
  );

  return (
    <api.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <AuthGuard>
          {children}
        </AuthGuard>
        <Toaster />
        <PwaInstallPrompt />
        <OfflineDetector />
        <CookieConsent />
      </QueryClientProvider>
    </api.Provider>
  );
}
