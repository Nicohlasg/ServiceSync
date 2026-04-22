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
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,
    environment:
      process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.NODE_ENV || 'development',
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
