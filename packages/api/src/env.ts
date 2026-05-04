/**
 * Environment variable validation (SEC-L5).
 *
 * Fails fast at module load time if any required variable is missing or malformed.
 * Import `env` from this module instead of reading `process.env` directly in server code.
 *
 * Client code that needs a NEXT_PUBLIC_* var must still reference process.env directly,
 * because Next.js inlines those at build time based on literal references.
 */

import { z } from 'zod';

const hexString = (bytes: number) =>
    z.string().regex(new RegExp(`^[0-9a-fA-F]{${bytes * 2}}$`), {
        message: `must be a ${bytes * 2}-char hex string (${bytes} bytes)`,
    });

const urlString = z.string().url();

const serverSchema = z.object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

    NEXT_PUBLIC_SUPABASE_URL: urlString,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),

    NEXT_PUBLIC_APP_URL: urlString,

    FIELD_ENCRYPTION_KEY: hexString(32),
    INTERNAL_PDF_RENDER_SECRET: z.string().min(32).optional(),

    NETS_WEBHOOK_SECRET: z.string().min(16).optional(),
    NETS_API_KEY: z.string().optional(),
    NETS_MERCHANT_ID: z.string().optional(),
    NETS_API_BASE_URL: urlString.optional(),


    PLATFORM_TRANSACTION_FEE_BPS: z
        .string()
        .regex(/^\d+$/)
        .optional(),

    UPSTASH_REDIS_REST_URL: urlString.optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
    KV_REST_API_URL: urlString.optional(),
    KV_REST_API_TOKEN: z.string().optional(),

    VAPID_PUBLIC_KEY: z.string().optional(),
    VAPID_PRIVATE_KEY: z.string().optional(),
    VAPID_SUBJECT: z.string().optional(),

    SENTRY_DSN: z.string().optional(),
});

const raw = {
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    FIELD_ENCRYPTION_KEY: process.env.FIELD_ENCRYPTION_KEY,
    INTERNAL_PDF_RENDER_SECRET: process.env.INTERNAL_PDF_RENDER_SECRET,
    NETS_WEBHOOK_SECRET: process.env.NETS_WEBHOOK_SECRET,
    NETS_API_KEY: process.env.NETS_API_KEY,
    NETS_MERCHANT_ID: process.env.NETS_MERCHANT_ID,
    NETS_API_BASE_URL: process.env.NETS_API_BASE_URL,
    PLATFORM_TRANSACTION_FEE_BPS: process.env.PLATFORM_TRANSACTION_FEE_BPS,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
    KV_REST_API_URL: process.env.KV_REST_API_URL,
    KV_REST_API_TOKEN: process.env.KV_REST_API_TOKEN,
    VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY,
    VAPID_SUBJECT: process.env.VAPID_SUBJECT,
    SENTRY_DSN: process.env.SENTRY_DSN,
};

const parsed = serverSchema.safeParse(raw);

if (!parsed.success) {
    const issues = parsed.error.issues
        .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
        .join('\n');
    // Fail fast — do not let the server boot with an invalid environment.
    throw new Error(
        `[env] Invalid or missing environment variables:\n${issues}\n` +
            `See .env.example for the full list of required variables.`,
    );
}

export const env = parsed.data;
export type Env = z.infer<typeof serverSchema>;
