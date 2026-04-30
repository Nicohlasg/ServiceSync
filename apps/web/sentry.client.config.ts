// https://docs.sentry.io/platforms/javascript/guides/nextjs/
//
// LR-3.1: Release-health wired. `release` is tagged from the Vercel commit SHA
// so Sentry's "Releases" view lights up per deploy and source maps line up.
// beforeSend strips obvious PII fields defensively — encrypted PII (phone,
// email) should never reach the error path, but breadcrumbs + query params can.

import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
const release =
  process.env.NEXT_PUBLIC_SENTRY_RELEASE ||
  process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ||
  undefined;

if (dsn) {
  Sentry.init({
    dsn,
    release,
    // Set tracesSampleRate to 1.0 to capture 100%
    // of transactions for performance monitoring.
    // We recommend adjusting this value in production
    tracesSampleRate: 1.0,
    tracePropagationTargets: ['localhost', /^https:\/\/servicesync\.sg\/api/],
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,
    environment:
      process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.NODE_ENV || 'development',
    integrations: [
      // send console.log, console.warn, and console.error calls as logs to Sentry
      Sentry.consoleLoggingIntegration({ levels: ['log', 'warn', 'error'] }),
    ],
    // Enable logs to be sent to Sentry
    // Note: Sentry.Nextjs.init has some differences in property names in v10, 
    // using the exact provided instructions.
    // @ts-ignore - Sentry 10.x SDK may have different property names for preview features
    enableLogs: true,
    beforeSend(event) {
      if (event.request?.cookies) delete event.request.cookies;
      if (event.request?.headers) {
        for (const k of Object.keys(event.request.headers)) {
          if (/authorization|cookie|x-csrf/i.test(k)) delete event.request.headers[k];
        }
      }
      return event;
    },
  });
}
