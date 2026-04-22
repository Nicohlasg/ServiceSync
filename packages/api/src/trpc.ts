/**
 * tRPC Initialisation — ServiceSync
 * Defines the base tRPC instance, context, and procedure builders.
 */

import { initTRPC, TRPCError } from '@trpc/server';
import type { FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch';
import { createServerClient } from '@supabase/ssr';
import superjson from 'superjson';
import { ZodError } from 'zod';
import { allowRequest, bucketForPath } from './rateLimit';

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export async function createContext(opts: FetchCreateContextFnOptions) {
  // HIGH-02: Guard against missing env vars with clear error
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        get(name: string) {
          // MED-06: Fix cookie parser — don't split on '=' which truncates Base64 values
          const match = opts.req.headers
            .get('cookie')
            ?.split('; ')
            .find((c) => c.startsWith(`${name}=`));
          return match ? match.slice(name.length + 1) : undefined;
        },
        // Server context is read-only for cookies
        set() { },
        remove() { },
      },
    }
  );

  const { data } = await supabase.auth.getUser();
  const user = data.user ?? null;

  const forwarded = opts.req.headers.get('x-forwarded-for');
  const clientIp =
    forwarded?.split(',')[0]?.trim() ?? opts.req.headers.get('x-real-ip') ?? 'unknown';

  return {
    supabase,
    user,
    clientIp,
    requestOrigin: getRequestOrigin(opts.req),
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;

function getRequestOrigin(req: Request): string | undefined {
  const origin = req.headers.get('origin')?.replace(/\/$/, '');
  if (origin) {
    return origin;
  }

  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  if (!host) {
    return undefined;
  }

  const protocol = req.headers.get('x-forwarded-proto')
    ?? (host.includes('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https');

  return `${protocol}://${host}`;
}

// ---------------------------------------------------------------------------
// tRPC instance
// ---------------------------------------------------------------------------

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

// ---------------------------------------------------------------------------
// Middlewares
// ---------------------------------------------------------------------------

const loggerMiddleware = t.middleware(async ({ path, type, next }) => {
  const start = Date.now();
  const result = await next();
  const durationMs = Date.now() - start;

  if (result.ok) {
    console.log(`[tRPC] ${type} '${path}' OK in ${durationMs}ms`);
  } else {
    console.error(`[tRPC] ${type} '${path}' failed in ${durationMs}ms:`, result.error.message);
  }

  return result;
});

const rateLimitMiddleware = t.middleware(async ({ ctx, path, next }) => {
  const identifier = ctx.user?.id ?? `ip:${ctx.clientIp}`;
  const bucket = bucketForPath(path);

  // Per-operation bucket (SEC-M2) — payment/booking/auth paths use tighter limits.
  const specificOk = await allowRequest(`${bucket}:${identifier}`, bucket);
  if (!specificOk) {
    console.warn(`[tRPC] Rate limit (${bucket}) exceeded for ${identifier} on path ${path}`);
    throw new TRPCError({
      code: 'TOO_MANY_REQUESTS',
      message: 'Rate limit exceeded. Please try again later.',
    });
  }

  // Global bucket still applies so one user can't fan-out across operations.
  if (bucket !== 'default') {
    const globalOk = await allowRequest(identifier, 'default');
    if (!globalOk) {
      console.warn(`[tRPC] Global rate limit exceeded for ${identifier} on path ${path}`);
      throw new TRPCError({
        code: 'TOO_MANY_REQUESTS',
        message: 'Rate limit exceeded. Please try again later.',
      });
    }
  }

  return next();
});

// ---------------------------------------------------------------------------
// Procedure builders
// ---------------------------------------------------------------------------

export const router = t.router;
export const publicProcedure = t.procedure.use(loggerMiddleware).use(rateLimitMiddleware);

/** Any authenticated technician */
export const protectedProcedure = t.procedure
  .use(loggerMiddleware)
  .use(rateLimitMiddleware)
  .use(({ ctx, next }) => {
    if (!ctx.user) {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Please log in' });
    }
    return next({ ctx: { ...ctx, user: ctx.user } });
  });

