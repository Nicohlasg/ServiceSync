'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';

/**
 * Sprint 3 Task 3.6 — Service Worker update prompt.
 *
 * Detects when a new SW version is available (waiting to activate) and shows
 * a "New version available — tap to refresh" toast. Uncle Teck doesn't close
 * browser tabs for days, so without this he serves stale cached code.
 */
export function SwUpdatePrompt() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    let registration: ServiceWorkerRegistration | null | undefined = null;

    async function listen() {
      try {
        registration = await navigator.serviceWorker.getRegistration('/sw.js');
        if (!registration) return;

        // If there's already a waiting worker on mount, prompt immediately
        if (registration.waiting) {
          setWaitingWorker(registration.waiting);
          return;
        }

        // Listen for new SW installs
        registration.addEventListener('updatefound', () => {
          const newWorker = registration!.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New version installed and waiting — prompt user
              setWaitingWorker(newWorker);
            }
          });
        });
      } catch {
        // SW not available — silently ignore
      }
    }

    // Also listen for controller change (happens after skipWaiting)
    let reloading = false;
    const onControllerChange = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    void listen();

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, []);

  useEffect(() => {
    if (!waitingWorker) return;

    toast.info('New version available', {
      duration: Infinity,
      description: 'Tap refresh to get the latest features.',
      action: {
        label: 'Refresh',
        onClick: () => {
          waitingWorker.postMessage({ type: 'SKIP_WAITING' });
        },
      },
    });
  }, [waitingWorker]);

  return null;
}
