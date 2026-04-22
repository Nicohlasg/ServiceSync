/**
 * tRPC rate limiting: Upstash Redis when configured, otherwise in-memory (local dev only).
 * In-memory resets on cold start and does not coordinate across instances — production must set Upstash env vars.
 *
 * Named buckets (SEC-M2) allow per-operation limits so that payment/auth-adjacent
 * paths get tighter thresholds than generic read queries.
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

export interface RateLimitBucket {
  /** Max requests per window */
  max: number;
  /** Window length in milliseconds */
  windowMs: number;
}

/**
 * Named rate-limit buckets. Pick the tightest bucket that matches the operation.
 *  - `default`:   generic read/query workload
 *  - `mutation`:  standard writes (create/update on CRM data)
 *  - `booking`:   booking creation — throttled to discourage automated spam
 *  - `payment`:   cash confirmation / signature capture — money-touching paths
 *  - `auth`:      login / password reset / webhook-adjacent hot spots
 */
export const RATE_LIMIT_BUCKETS = {
  default: { max: 100, windowMs: 60_000 },
  mutation: { max: 60, windowMs: 60_000 },
  booking: { max: 10, windowMs: 60_000 },
  payment: { max: 10, windowMs: 60_000 },
  auth: { max: 5, windowMs: 60_000 },
} as const satisfies Record<string, RateLimitBucket>;

export type RateLimitBucketName = keyof typeof RATE_LIMIT_BUCKETS;

// ---------------------------------------------------------------------------
// Upstash-backed limiter (production)
// ---------------------------------------------------------------------------

const upstashCache = new Map<string, Ratelimit | null>();
let hasLoggedPlaceholderFallback = false;
let hasLoggedRuntimeFallback = false;

function isPlaceholderConfig(value: string): boolean {
  return /xxxx|your-|example|changeme|replace-me/i.test(value);
}

function getUpstashRatelimit(bucket: RateLimitBucketName): Ratelimit | null {
  if (upstashCache.has(bucket)) return upstashCache.get(bucket) ?? null;

  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    upstashCache.set(bucket, null);
    return null;
  }

  if (isPlaceholderConfig(url) || isPlaceholderConfig(token)) {
    if (!hasLoggedPlaceholderFallback) {
      console.warn(
        '[rateLimit] Ignoring placeholder Upstash/KV configuration and falling back to in-memory rate limiting.',
      );
      hasLoggedPlaceholderFallback = true;
    }
    upstashCache.set(bucket, null);
    return null;
  }

  const redis = new Redis({ url, token });
  const { max, windowMs } = RATE_LIMIT_BUCKETS[bucket];
  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(max, `${windowMs / 1000} s`),
    prefix: `servicesync:trpc:rl:${bucket}`,
  });
  upstashCache.set(bucket, limiter);
  return limiter;
}

// ---------------------------------------------------------------------------
// In-memory fallback (local dev only)
// ---------------------------------------------------------------------------

const memBuckets = new Map<string, Map<string, { count: number; windowStart: number }>>();

function checkInMemory(bucket: RateLimitBucketName, identifier: string): boolean {
  const { max, windowMs } = RATE_LIMIT_BUCKETS[bucket];
  let store = memBuckets.get(bucket);
  if (!store) {
    store = new Map();
    memBuckets.set(bucket, store);
  }

  const now = Date.now();
  const record = store.get(identifier);
  if (!record || now - record.windowStart > windowMs) {
    store.set(identifier, { count: 1, windowStart: now });
    return true;
  }
  if (record.count >= max) return false;
  record.count++;
  return true;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns true if the request may proceed, false if rate limited.
 * Defaults to the `default` bucket for backwards compatibility.
 */
export async function allowRequest(
  identifier: string,
  bucket: RateLimitBucketName = 'default',
): Promise<boolean> {
  const rl = getUpstashRatelimit(bucket);
  if (rl) {
    try {
      const { success, pending } = await rl.limit(identifier);
      void pending;
      return success;
    } catch (error) {
      upstashCache.set(bucket, null);
      if (!hasLoggedRuntimeFallback) {
        console.warn(
          '[rateLimit] Upstash/KV request failed; falling back to in-memory rate limiting.',
          error,
        );
        hasLoggedRuntimeFallback = true;
      }
    }
  }
  return checkInMemory(bucket, identifier);
}

/**
 * Map tRPC paths to their rate-limit bucket. Anything not listed uses `default`.
 * Path format: `<router>.<procedure>`, e.g. `booking.createBooking`.
 */
const PATH_BUCKET_OVERRIDES: Record<string, RateLimitBucketName> = {
  'booking.createBooking': 'booking',
  'booking.rescheduleBooking': 'booking',
  'cash.confirmCashPayment': 'payment',
  'cash.recordCashPayment': 'payment',
  'invoices.create': 'mutation',
  'invoices.updateStatus': 'mutation',
  'clients.create': 'mutation',
  'clients.update': 'mutation',
  'auth.login': 'auth',
  'auth.register': 'auth',
  'auth.resetPassword': 'auth',
};

export function bucketForPath(path: string): RateLimitBucketName {
  return PATH_BUCKET_OVERRIDES[path] ?? 'default';
}
