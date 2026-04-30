/**
 * Rate limiting — Upstash Redis when configured, otherwise in-memory (local dev only).
 * In-memory resets on cold start and does not coordinate across instances.
 * Production MUST set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN.
 *
 * Named buckets (SEC-M2) allow per-operation limits so that payment/auth-adjacent
 * paths get tighter thresholds than generic read queries.
 *
 * Used by both tRPC middleware (via rateLimitMiddleware in trpc.ts) and raw
 * Next.js API routes (via checkHttpRateLimit below).
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { TRPCError } from '@trpc/server';
import { NextResponse } from 'next/server';

export interface RateLimitBucket {
  /** Max requests per window */
  max: number;
  /** Window length in milliseconds */
  windowMs: number;
}

// ---------------------------------------------------------------------------
// SCALING NOTE: Limits are calibrated for <100 active users (current baseline).
// When the user base grows — target is 5,000/month — revisit these values:
//
//   Current (<100 users)   →  Suggested at 5,000/month
//   default:   30 req/min  →  200 req/min
//   mutation:  15 req/min  →  60 req/min
//   booking:    5 req/min  →  20 req/min
//   payment:    3 req/min  →  10 req/min
//   pdf:        2 req/min  →  10 req/min  (CPU-intensive, keep tight)
//   auth:       5 req/min  →  10 req/min
//   webhook:   20 req/min  →  60 req/min  (external callback traffic)
//
// Also consider per-plan limits when tiered pricing is introduced.
// ---------------------------------------------------------------------------

/**
 * Named rate-limit buckets. Pick the tightest bucket that matches the operation.
 *  - `default`:   generic read/query workload
 *  - `mutation`:  standard writes (create/update on CRM data)
 *  - `booking`:   booking creation — throttled to discourage automated spam
 *  - `payment`:   cash confirmation / signature capture — money-touching paths
 *  - `pdf`:       PDF render — CPU/memory intensive, very tight
 *  - `auth`:      login / password reset / webhook-adjacent hot spots
 *  - `webhook`:   inbound callbacks from external payment providers (NETS/PayNow)
 */
export const RATE_LIMIT_BUCKETS = {
  // Tuned for <100 active users. See SCALING NOTE above.
  default: { max: 30, windowMs: 60_000 },
  mutation: { max: 15, windowMs: 60_000 },
  booking: { max: 5, windowMs: 60_000 },
  payment: { max: 3, windowMs: 60_000 },
  pdf: { max: 2, windowMs: 60_000 },
  auth: { max: 5, windowMs: 60_000 },
  webhook: { max: 20, windowMs: 60_000 },
  // Address autocomplete — generous because each keystroke fires a request.
  // TODO: Raise to 120/min when user base exceeds 500 active users.
  geocode: { max: 60, windowMs: 60_000 },
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
    '/api/geocode': 'geocode',
    '/api/geocode/reverse': 'geocode',
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
  // provider mutations — profile changes, ACRA updates, schedule config
  'provider.updateProfile': 'mutation',
  'provider.updateSchedule': 'mutation',
  'schedule.block': 'mutation',
  'schedule.unblock': 'mutation',
};

export function bucketForPath(path: string): RateLimitBucketName {
  return PATH_BUCKET_OVERRIDES[path] ?? 'default';
}

// ---------------------------------------------------------------------------
// Raw HTTP route helper (for non-tRPC Next.js API routes)
// ---------------------------------------------------------------------------

/**
 * Use this in raw Next.js API route handlers (not tRPC) to apply rate limiting.
 *
 * Returns `null` if the request is allowed, or a 429 NextResponse if blocked.
 *
 * @example
 * const limited = await checkHttpRateLimit(request, 'pdf');
 * if (limited) return limited;
 */
export async function checkHttpRateLimit(
  req: { headers: { get(name: string): string | null } },
  bucket: RateLimitBucketName = 'default',
): Promise<NextResponse | null> {
  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() ?? req.headers.get('x-real-ip') ?? 'unknown';
  const identifier = `ip:${ip}`;

  const allowed = await allowRequest(identifier, bucket);
  if (!allowed) {
    console.warn(`[rateLimit] HTTP ${bucket} limit exceeded for ${identifier}`);
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: { 'Retry-After': '60' } },
    );
  }
  return null;
}

/**
 * Same as checkHttpRateLimit but throws a TRPCError instead of returning a response.
 * Use this inside tRPC procedures that need an extra per-operation guard.
 */
export async function assertHttpRateLimit(
  req: { headers: { get(name: string): string | null } },
  bucket: RateLimitBucketName = 'default',
): Promise<void> {
  const response = await checkHttpRateLimit(req, bucket);
  if (response) {
    throw new TRPCError({
      code: 'TOO_MANY_REQUESTS',
      message: 'Rate limit exceeded. Please try again later.',
    });
  }
}
