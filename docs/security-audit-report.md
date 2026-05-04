# ServiceSync V2 Security Audit Report

**Date:** 2026-04-19
**Auditor:** Security Auditor Agent (Claude Opus 4.6)
**Scope:** tRPC routers, auth middleware, PDF render route, services, secrets, rate limiting, tenant isolation
**Methodology:** Static code analysis of all server-side source files

---

## Executive Summary

ServiceSync V2 demonstrates a **strong overall security posture**. The codebase shows evidence of deliberate security engineering with labeled security controls (SEC-C1, SEC-H1, SEC-M2, etc.), comprehensive input validation via Zod, HTML sanitization on database writes, timing-safe HMAC verification, AES-256-GCM field encryption, and per-operation rate limiting. No critical vulnerabilities were identified. Several medium and low severity findings are documented below.

### Finding Summary

| Severity | Count | Description |
|----------|-------|-------------|
| CRITICAL | 0 | - |
| HIGH     | 2 | PDF render secret fallback chain; `acraVerified` client-controlled |
| MEDIUM   | 5 | Booking IDOR via UUID guessing; in-memory rate limiting in prod; missing `provider_id` filter on booking getById sub-query; invoice `getById` missing client ownership check on sub-queries; `workingHours` accepts `z.any()` |
| LOW      | 5 | Cookie parsing edge case; Puppeteer `--no-sandbox`; `signatureDataUrl` embedded in HTML without CSP; search term sanitizer drops non-ASCII; booking fallback race window |
| INFO     | 4 | Audit logging is non-blocking; `.next/` build artifacts in repo; IP trust from `x-forwarded-for`; encryption graceful degradation |

---

## 1. Authentication and Authorization

### 1.1 protectedProcedure Middleware [PASS]

**Location:** `/packages/api/src/trpc.ts:152-160`

The `protectedProcedure` middleware correctly:
- Checks `ctx.user` is non-null before proceeding
- Throws `UNAUTHORIZED` if no user session exists
- Narrows the TypeScript context so downstream handlers have a guaranteed `ctx.user`

```typescript
.use(({ ctx, next }) => {
    if (!ctx.user) {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Please log in' });
    }
    return next({ ctx: { ...ctx, user: ctx.user } });
  });
```

### 1.2 Router Procedure Type Audit [PASS with notes]

Every router was reviewed for correct procedure type usage:

| Router | Procedure | Type | Intentional? |
|--------|-----------|------|-------------|
| `booking.getAvailableSlots` | `publicProcedure` | Yes - homeowners browse slots |
| `booking.createBooking` | `publicProcedure` | Yes - homeowners create bookings |
| `booking.getBookingConfirmation` | `publicProcedure` | Yes - confirmation permalink (data minimized via SEC-H1) |
| `booking.listBookings` | `protectedProcedure` | Correct |
| `booking.acceptBooking` | `protectedProcedure` | Correct |
| `booking.declineBooking` | `protectedProcedure` | Correct |
| `booking.startJob` | `protectedProcedure` | Correct |
| `booking.completeJob` | `protectedProcedure` | Correct |
| `booking.updateLocation` | `protectedProcedure` | Correct |
| `cash.*` (all 5 endpoints) | `protectedProcedure` | Correct |
| `clients.*` (all 9 endpoints) | `protectedProcedure` | Correct |
| `invoices.*` (all 10 endpoints) | `protectedProcedure` | Correct |
| `provider.getPublicProfile` | `publicProcedure` | Yes - public /p/{slug} page |
| `provider.*` (all other 14) | `protectedProcedure` | Correct |
| `schedule.*` (all 10 endpoints) | `protectedProcedure` | Correct |

**Verdict:** All public endpoints are intentionally public and properly minimize exposed data.

### 1.3 Tenant Isolation (provider_id Filtering) [PASS with findings]

Every protected query was checked for `provider_id = ctx.user.id` filtering:

| Router | Endpoint | Filter Present? |
|--------|----------|-----------------|
| `booking.listBookings` | `.eq('provider_id', ctx.user.id)` | Yes |
| `booking.acceptBooking` | `.eq('provider_id', ctx.user.id)` | Yes |
| `booking.declineBooking` | `.eq('provider_id', ctx.user.id)` | Yes |
| `booking.startJob` | `.eq('provider_id', ctx.user.id)` | Yes |
| `booking.completeJob` | `.eq('provider_id', ctx.user.id)` | Yes |
| `booking.updateLocation` | `.eq('provider_id', ctx.user.id)` | Yes |
| `cash.getInvoiceSummary` | `.eq('provider_id', ctx.user.id)` | Yes |
| `cash.confirmCashPayment` | `.eq('provider_id', providerId)` | Yes |
| `cash.getDailySummary` | `ctx.user.id` passed directly | Yes |
| `cash.getPaymentStatus` | `.eq('provider_id', ctx.user.id)` | Yes |
| `cash.confirmQrPayment` | `.eq('provider_id', ctx.user.id)` | Yes |
| `clients.list` | `.eq('provider_id', ctx.user.id)` | Yes |
| `clients.getById` | `.eq('provider_id', ctx.user.id)` | Yes |
| `clients.create` | `provider_id: ctx.user.id` in insert | Yes |
| `clients.update` | `.eq('provider_id', ctx.user.id)` | Yes |
| `clients.delete` | `.eq('provider_id', ctx.user.id)` | Yes |
| `clients.getServiceHistory` | `.eq('provider_id', ctx.user.id)` | Yes |
| `clients.getAssets` | `.eq('provider_id', ctx.user.id)` | Yes |
| `clients.addAsset` | Ownership check + `provider_id: ctx.user.id` | Yes |
| `clients.getRetentionQueue` | `.eq('provider_id', ctx.user.id)` | Yes |
| `invoices.list` | `.eq('provider_id', ctx.user.id)` | Yes |
| `invoices.getById` | `.eq('provider_id', ctx.user.id)` on invoice | Yes |
| `invoices.updateStatus` | `.eq('provider_id', ctx.user.id)` | Yes |
| `invoices.delete` | `.eq('provider_id', ctx.user.id)` | Yes |
| `invoices.create` | `provider_id: ctx.user.id` | Yes |
| `invoices.generatePdf` | `.eq('provider_id', ctx.user.id)` | Yes |
| `invoices.downloadMonthly` | `ctx.user.id` passed | Yes |
| `invoices.downloadYearly` | `ctx.user.id` passed | Yes |
| `invoices.downloadAll` | `ctx.user.id` passed | Yes |
| `invoices.getMonthlyBreakdown` | `.eq('provider_id', ctx.user.id)` | Yes |
| `invoices.getYearlyBreakdown` | `.eq('provider_id', ctx.user.id)` | Yes |
| `provider.getProfile` | `.eq('id', ctx.user.id)` | Yes |
| `provider.updateProfile` | `.eq('id', ctx.user.id)` | Yes |
| `provider.deleteAccount` | `ctx.user.id` verified | Yes |
| `schedule.*` (all) | `.eq('provider_id', ctx.user.id)` | Yes |

**All protected endpoints enforce tenant isolation.**

---

## 2. Findings

### FINDING-01: PDF Render Secret Fallback to SUPABASE_SERVICE_ROLE_KEY [HIGH]

**Severity:** HIGH
**Location:** `/apps/web/app/api/invoices/render-pdf/route.ts:161-165` and `/packages/api/src/services/pdf.ts:243-247`
**OWASP:** A02:2021 - Cryptographic Failures

**Description:**
The `getInternalPdfRenderSecret()` function falls back through three secrets:
```typescript
function getInternalPdfRenderSecret(): string | undefined {
  return process.env.INTERNAL_PDF_RENDER_SECRET
    ?? process.env.FIELD_ENCRYPTION_KEY
    ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
}
```

If `INTERNAL_PDF_RENDER_SECRET` and `FIELD_ENCRYPTION_KEY` are not configured, the HMAC signing uses `SUPABASE_SERVICE_ROLE_KEY` -- the most privileged credential in the system. This key grants full database access and should never be used for HMAC signing because:
1. If the HMAC is ever leaked or brute-forced, it reveals the service role key.
2. The service role key has a different rotation lifecycle than HMAC secrets.

**Recommendation:**
- Always require `INTERNAL_PDF_RENDER_SECRET` in production (fail closed, do not fall back).
- Remove the `SUPABASE_SERVICE_ROLE_KEY` fallback entirely.
- Keep `FIELD_ENCRYPTION_KEY` as a secondary fallback only if acceptable.

---

### FINDING-02: `acraVerified` Field is Client-Controllable [HIGH]

**Severity:** HIGH
**Location:** `/packages/api/src/routers/provider.ts:44,487`

**Description:**
The `updateProfile` input schema accepts `acraVerified: z.boolean().optional()`, meaning any authenticated technician can set their own ACRA verification status to `true`:

```typescript
acraVerified: z.boolean().optional(),
// ...
if (input.acraVerified !== undefined) updateData.acra_verified = input.acraVerified;
```

This field is displayed as a trust badge ("ACRA Verified") on the public profile and in invoices/PDFs. A malicious user could self-verify to appear as a legitimate registered business.

**Recommendation:**
- Remove `acraVerified` from the `updateProfileInput` schema.
- Only allow this field to be set through an admin verification workflow or a server-side ACRA API lookup.
- Consider adding a separate admin-only endpoint for verification status changes.

---

### FINDING-03: Booking Confirmation Accessible by UUID Guessing [MEDIUM]

**Severity:** MEDIUM
**Location:** `/packages/api/src/routers/booking.ts:325-369`

**Description:**
`getBookingConfirmation` is a public procedure that returns booking details (masked address, provider name, status) given only a booking UUID. While UUIDs are hard to guess in practice (128-bit randomness), the endpoint returns confirmation data without any additional authentication token. If a booking UUID is leaked (e.g., in a URL, logs, or email), anyone can view the confirmation.

The response is already minimized (SEC-H1), which reduces the impact.

**Recommendation:**
- Consider adding a short random confirmation token (e.g., 6-8 character alphanumeric) that must be provided alongside the booking UUID.
- Alternatively, rate-limit this endpoint more aggressively to prevent brute-force enumeration.

---

### FINDING-04: In-Memory Rate Limiting in Production [MEDIUM]

**Severity:** MEDIUM
**Location:** `/packages/api/src/rateLimit.ts:87-104`

**Description:**
When Upstash Redis is not configured or fails, rate limiting falls back to an in-memory implementation. In a serverless environment (Vercel), this means:
1. Each function instance has its own independent rate limit counter.
2. Cold starts reset all counters.
3. Rate limits are not coordinated across instances.

An attacker could bypass rate limits by distributing requests across multiple serverless instances.

**Recommendation:**
- In production, fail closed if Upstash is unavailable rather than falling back to in-memory.
- Log a warning/alert when Upstash fails so the operations team can investigate.
- At minimum, ensure `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are required in production deployments.

---

### FINDING-05: Missing `provider_id` Filter on Booking Sub-Query in `invoices.getById` [MEDIUM]

**Severity:** MEDIUM
**Location:** `/packages/api/src/routers/invoices.ts:147-153`

**Description:**
When fetching the related booking for an invoice, the query only filters by `booking_id` without also checking `provider_id`:

```typescript
if (invoice.booking_id) {
  const { data } = await ctx.supabase
    .from('bookings')
    .select('...')
    .eq('id', invoice.booking_id)
    .single();  // No .eq('provider_id', ctx.user.id)
  booking = data;
}
```

Since the invoice itself is filtered by `provider_id`, and the `booking_id` foreign key would normally reference a booking owned by the same provider, this is unlikely to be exploitable in practice. However, if booking data were ever shared across providers (or if foreign key constraints are relaxed), this could leak booking details from another provider.

The same pattern exists for the client sub-query at line 139-145 (no `provider_id` check).

**Recommendation:**
- Add `.eq('provider_id', ctx.user.id)` to the booking and client sub-queries in `invoices.getById`.

---

### FINDING-06: `workingHours` Accepts `z.any()` [MEDIUM]

**Severity:** MEDIUM
**Location:** `/packages/api/src/routers/provider.ts:45`

**Description:**
The `updateProfile` input accepts `workingHours: z.any().optional()`, which means any arbitrary JSON value can be written to the `working_hours` column. While Supabase/Postgres will enforce column type constraints, accepting `z.any()` bypasses Zod's input validation and could allow:
1. Excessively large JSON payloads stored in the database.
2. Unexpected data shapes that crash client-side rendering.
3. Injection of nested objects with unexpected properties.

**Recommendation:**
- Replace `z.any()` with the proper `workingHoursSchema` already defined in `schedule.ts:16-24` or a compatible schema.

---

### FINDING-07: Booking Fallback Insert Has a Small Race Window [LOW]

**Severity:** LOW
**Location:** `/packages/api/src/routers/booking.ts:179-266`

**Description:**
When the `create_booking_with_lock` RPC is not available (error code `42883`), the fallback path checks for overlapping bookings then inserts. This check-then-insert is not atomic, leaving a small window where two concurrent requests for the same slot could both pass the overlap check and both insert. The code acknowledges this with a comment (SEC-H2).

**Recommendation:**
- Deploy the `create_booking_with_lock` RPC function to eliminate this race condition.
- Consider adding a unique constraint or exclusion constraint on the bookings table for `(provider_id, scheduled_date, arrival_window_start, arrival_window_end)` as a database-level safety net.

---

### FINDING-08: Cookie Parsing May Truncate Values with Semicolons [LOW]

**Severity:** LOW
**Location:** `/packages/api/src/trpc.ts:31-36`

**Description:**
The cookie parser splits on `'; '` (semicolon-space). While standard cookie format uses `'; '` as the delimiter, if any cookie value contains a literal `'; '` sequence (unusual but theoretically possible in malformed cookies), parsing could break. The code already has a fix note (MED-06) for the `=` split issue. The current implementation is functionally correct for standard Supabase auth cookies.

**Recommendation:**
- Consider using a well-tested cookie parsing library (`cookie` npm package) for robustness.

---

### FINDING-09: Puppeteer Launched with `--no-sandbox` [LOW]

**Severity:** LOW
**Location:** `/packages/api/src/services/pdf.ts:379`

**Description:**
Puppeteer/Chromium is launched with `--no-sandbox` and `--disable-setuid-sandbox`. This is standard for serverless environments (Vercel, AWS Lambda) where the sandbox cannot be enabled, but it means the Chromium process has fewer isolation guarantees. Since the HTML content is fully server-generated and user input is escaped via `escapeHtml()`, the risk is low.

**Recommendation:**
- Ensure all user-controlled strings in the HTML template are always escaped (already done via `escapeHtml()` -- verified).
- Consider migrating fully to the PDFx/react-pdf path for all PDF generation to eliminate the Puppeteer dependency.

---

### FINDING-10: Signature Data URL Embedded in HTML Without CSP [LOW]

**Severity:** LOW
**Location:** `/packages/api/src/services/pdf.ts:281-288`

**Description:**
The `signatureDataUrl` (validated as a base64 PNG data URL by Zod) is embedded directly into the HTML template `<img src="${signatureDataUrl}">`. While the Zod validation ensures it starts with `data:image/png;base64,` and is capped at 500KB, the HTML rendered by Puppeteer has no Content Security Policy. If the regex validation is ever loosened, this could become a vector for injecting arbitrary content.

**Recommendation:**
- The current validation is adequate. Maintain the regex check and size limit.
- If Puppeteer rendering is kept, consider adding a `<meta>` CSP header to the generated HTML.

---

### FINDING-11: Search Term Sanitizer Drops Non-ASCII Characters [LOW]

**Severity:** LOW
**Location:** `/packages/api/src/utils/sanitize.ts:43-44`

**Description:**
The `sanitizeSearchTerm` function strips all non-ASCII characters:
```typescript
return input.replace(/[^A-Za-z0-9\s-]/g, '')
```

This means searches for client names with Chinese, Malay, or Tamil characters (common in Singapore's multilingual population) will return empty results. The code acknowledges this limitation.

**Recommendation:**
- Consider extending the allowlist to include Unicode letters using `\p{L}` with the `u` flag.
- Alternatively, use Postgres full-text search which handles Unicode natively.

---

## 3. HMAC Verification in PDF Render Route [PASS]

**Location:** `/apps/web/app/api/invoices/render-pdf/route.ts:144-158`

The HMAC verification is correctly implemented:

1. **Timing-safe comparison:** Uses `crypto.timingSafeEqual()` to prevent timing attacks.
2. **Length check first:** Verifies buffer lengths match before calling `timingSafeEqual` (required by the Node.js API).
3. **Null check:** Returns `false` if no signature is provided.
4. **Secret check:** Returns `false` if no secret is configured.
5. **Algorithm:** Uses HMAC-SHA256.

```typescript
function verifySignature(payload: string, providedSignature: string | null): boolean {
  const secret = getInternalPdfRenderSecret();
  if (!secret || !providedSignature) return false;

  const expectedSignature = createHmac('sha256', secret).update(payload).digest('hex');
  const expectedBuffer = Buffer.from(expectedSignature);
  const providedBuffer = Buffer.from(providedSignature);

  return expectedBuffer.length === providedBuffer.length
    && timingSafeEqual(expectedBuffer, providedBuffer);
}
```

**Verdict:** The HMAC verification is correct and secure. The only issue is the secret fallback chain (see FINDING-01).

---

## 4. Cryptographic Implementation [PASS]

**Location:** `/packages/api/src/services/crypto.ts`

The field-level encryption implementation is well-designed:

- **Algorithm:** AES-256-GCM (authenticated encryption).
- **IV:** 12 bytes (96 bits), randomly generated per encryption (correct for GCM).
- **Auth Tag:** 16 bytes (128 bits).
- **Key Management:** 32-byte key from hex env var, validated on first use.
- **Error Handling:** Throws on decryption failure instead of returning ciphertext (SEC-H3).
- **Migration Support:** Plaintext values (not prefixed with `enc:`) pass through unchanged.

**No issues found.**

---

## 5. Input Validation [PASS]

All routers use Zod schemas for input validation:

- **UUIDs:** Validated with `z.string().uuid()` on all ID inputs.
- **Dates:** Validated with regex `^\d{4}-\d{2}-\d{2}$`.
- **Numeric ranges:** All numeric inputs have min/max bounds.
- **String lengths:** All string inputs have appropriate length limits.
- **Enums:** Status fields use `z.enum()` with exhaustive values.
- **Financial amounts:** Capped at `MAX_INVOICE_CENTS = 10_000_000` (SGD 100,000).
- **Signature data:** Capped at 500KB with format validation.

### XSS Prevention

- **Database writes:** All user-controlled strings pass through `sanitizeHtml()` before storage (clients, provider profile, services, assets).
- **PDF templates:** All values in the Puppeteer HTML template use `escapeHtml()`.
- **Search terms:** Strict allowlist via `sanitizeSearchTerm()`.

### SQL Injection Prevention

- All database queries use the Supabase client which parameterizes queries internally.
- No raw SQL queries found in the tRPC layer (the `create_booking_with_lock` RPC is a stored procedure called via `.rpc()`).
- Search terms are sanitized before being interpolated into PostgREST `or()` expressions.

---

## 6. Rate Limiting [PASS with notes]

**Location:** `/packages/api/src/rateLimit.ts`

Rate limiting is well-structured with per-operation buckets:

| Bucket | Max/min | Applied To |
|--------|---------|-----------|
| `default` | 100/min | Generic queries |
| `mutation` | 60/min | CRM writes |
| `booking` | 10/min | Booking creation |
| `payment` | 10/min | Cash confirmation |
| `auth` | 5/min | Login, register, password reset |

The middleware applies both a per-operation bucket and a global bucket per user, preventing fan-out attacks.

**Issue:** See FINDING-04 regarding in-memory fallback.

**Additional Note:** The `confirmQrPayment` endpoint is not listed in `PATH_BUCKET_OVERRIDES` and defaults to the `default` bucket (100/min) instead of the `payment` bucket (10/min).

---

## 7. Secrets Management [PASS]

### Hardcoded Secrets Scan

- **No hardcoded API keys, secrets, or credentials found** in any source files under `packages/` or `apps/`.
- All secrets are sourced from `process.env`.
- The grep results showing secrets in `.agents/skills/` and `.agent/skills/` are example/documentation strings in skill templates, not production code.

### .env File Status

- **No `.env` files committed** to the repository.
- `.gitignore` correctly excludes `.env`, `.env.local`, `.env.development.local`, `.env.test.local`, `.env.production.local`.

### Secret References Audit

All `process.env` references for secrets:
- `NEXT_PUBLIC_SUPABASE_URL` -- validated at startup
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` -- validated at startup
- `SUPABASE_SERVICE_ROLE_KEY` -- validated in `supabase-admin.ts`
- `FIELD_ENCRYPTION_KEY` -- validated in `crypto.ts` (64 hex chars)
- `INTERNAL_PDF_RENDER_SECRET` -- optional (see FINDING-01)
- `UPSTASH_REDIS_REST_URL` / `KV_REST_API_URL` -- optional, validated for placeholders
- `UPSTASH_REDIS_REST_TOKEN` / `KV_REST_API_TOKEN` -- optional, validated for placeholders
- `NEXT_PUBLIC_APP_URL` -- non-secret, public-facing URL

---

## 8. Data Access Control and Privacy [PASS]

### Public Endpoint Data Minimization

- `booking.getBookingConfirmation` (SEC-H1): Masks full address to area-only, replaces deposit amount with boolean flag.
- `provider.getPublicProfile`: Uses a `profiles_public` view (not the full `profiles` table), excluding sensitive fields like `paynow_key`.

### Audit Logging

- All sensitive mutations emit audit events via `emitAuditEvent()`.
- Audit events include: actor ID, actor IP, entity type, entity ID, action, and diff.
- `paynow_key` is redacted from audit diffs (`AUDIT_REDACTED_KEYS`).
- Cash payment signature bindings use HMAC for non-repudiation.

### PDPA Compliance

- Account deletion (`provider.deleteAccount`) uses admin client to delete the auth user, cascading all related data.
- Confirmation email verification required before deletion.

---

## 9. Informational Notes

### INFO-01: Audit Logging is Non-Blocking

All `emitAuditEvent()` calls use `void` (fire-and-forget). If the audit log insert fails, the primary operation still succeeds. This is by design to avoid cascading failures, but means audit records could be silently lost.

### INFO-02: Build Artifacts in Repository

The `.next/` directory appears to be present (based on grep results hitting build chunks). While `.gitignore` excludes it, the working directory contains compiled JavaScript with source maps that could expose internal code structure.

### INFO-03: IP Trust from x-forwarded-for

Client IP is extracted from `x-forwarded-for` header without validation. On Vercel this is set by the platform and is trustworthy, but if the app is deployed behind a different reverse proxy, this header could be spoofed to bypass IP-based rate limiting.

### INFO-04: Encryption Graceful Degradation

When `FIELD_ENCRYPTION_KEY` is not configured, `encryptField()` returns plaintext. This supports gradual rollout but means sensitive fields (NRIC, PayNow keys) could be stored unencrypted. In production, the key should always be set.

---

## 10. Recommendations Summary (Prioritized)

### Priority 1 (Address Before Launch)

1. **Remove SUPABASE_SERVICE_ROLE_KEY from HMAC fallback chain** (FINDING-01). Set `INTERNAL_PDF_RENDER_SECRET` as a required env var in production.
2. **Remove `acraVerified` from client-controllable `updateProfile` input** (FINDING-02). This is a trust indicator that should only be set server-side.

### Priority 2 (Address Soon After Launch)

3. **Add `provider_id` filter to sub-queries in `invoices.getById`** (FINDING-05).
4. **Replace `z.any()` with proper schema for `workingHours`** (FINDING-06).
5. **Require Upstash Redis in production** or fail closed on rate limit backend failure (FINDING-04).
6. **Add `confirmQrPayment` to `PATH_BUCKET_OVERRIDES`** with `payment` bucket.

### Priority 3 (Improvements)

7. **Deploy `create_booking_with_lock` RPC** to eliminate booking race condition (FINDING-07).
8. **Add confirmation token to booking confirmation endpoint** (FINDING-03).
9. **Extend search sanitizer for Unicode** (FINDING-11).
10. **Add CSP meta tag to Puppeteer HTML templates** (FINDING-10).

---

## Appendix: Files Reviewed

| File | Path |
|------|------|
| tRPC init & middleware | `packages/api/src/trpc.ts` |
| Rate limiting | `packages/api/src/rateLimit.ts` |
| Sanitization | `packages/api/src/utils/sanitize.ts` |
| Booking router | `packages/api/src/routers/booking.ts` |
| Cash router | `packages/api/src/routers/cash.ts` |
| Clients router | `packages/api/src/routers/clients.ts` |
| Invoices router | `packages/api/src/routers/invoices.ts` |
| Provider router | `packages/api/src/routers/provider.ts` |
| Schedule router | `packages/api/src/routers/schedule.ts` |
| App router | `packages/api/src/routers/_app.ts` |
| PDF render route | `apps/web/app/api/invoices/render-pdf/route.ts` |
| Crypto service | `packages/api/src/services/crypto.ts` |
| Audit service | `packages/api/src/services/audit.ts` |
| PDF service | `packages/api/src/services/pdf.ts` |
| PayNow QR | `packages/api/src/services/paynow-qr.ts` |
| Invoice storage | `packages/api/src/services/invoice-storage.ts` |
| Supabase admin | `packages/api/src/services/supabase-admin.ts` |
| .gitignore | `.gitignore` |
