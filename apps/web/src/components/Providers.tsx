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
const SessionTimeoutWarning = dynamic(
  () => import('@/components/SessionTimeoutWarning').then(m => ({ default: m.SessionTimeoutWarning })),
  { ssr: false },
);
const SwUpdatePrompt = dynamic(
  () => import('@/components/SwUpdatePrompt').then(m => ({ default: m.SwUpdatePrompt })),
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

import { PwaProvider } from '@/components/PwaInstallPrompt';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => {
    const handleError = (error: unknown) => {
      const { code, message } = getErrorInfo(error);
      const isAuthError =
        code === 'UNAUTHORIZED' ||
        message?.includes('UNAUTHORIZED') ||
        message?.includes('Not authenticated');

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
          staleTime: 2 * 60 * 1000,
          gcTime: 10 * 60 * 1000,
          refetchOnWindowFocus: false,
        },
        mutations: {
          retry: 2,
          retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 8000),
          onError: (error) => {
            const { message } = getErrorInfo(error);
            if (message?.includes('Failed to fetch') || message?.includes('NetworkError') || message?.includes('Load failed')) {
              toast.error('Network issue — saved locally, will retry when online.');
            }
          },
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
        <PwaProvider>
          <AuthGuard>
            {children}
          </AuthGuard>
          <Toaster />
          <PwaInstallPrompt />
          <OfflineDetector />
          <CookieConsent />
          <SessionTimeoutWarning />
          <SwUpdatePrompt />
        </PwaProvider>
      </QueryClientProvider>
    </api.Provider>
  );
}
