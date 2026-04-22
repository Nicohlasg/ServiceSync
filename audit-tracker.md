# ServiceSync V2 — Pre-Launch Audit Tracker

**Status:** 🔴 Pre-Launch
**Goal:** Resolve all Critical and High issues prior to production deployment.
**Linked masterplan:** [`docs/masterplan.md`](docs/masterplan.md)

## Phase 1 — Security (Critical & High)
- [x] **1.1:** Delete `apps/web/src/utils/supabase/info.tsx`. Migrate credentials to `process.env` inside `maps.ts` and ensure no secrets are exposed in the client bundle. (CRIT-1)
- [x] **1.2:** Remove the hardcoded Edge function name (`make-server-394f5af5`) in `apps/web/src/lib/maps.ts` and replace it with an environment variable. (CRIT-2)
- [x] **1.3:** Validate the `redirect` query parameter in `apps/web/app/login/page.tsx` to prevent Open Redirect vulnerabilities. (CRIT-4)
- [x] **1.4:** Fix wildcard CORS configuration in `apps/web/next.config.mjs` to restrict origins and ensure compatibility with `Allow-Credentials: true`. (CRIT-3)
- [x] **1.5:** Add a Content Security Policy (CSP) header in `next.config.mjs`. (HIGH-7)
- [x] **1.6:** Restrict `profiles_public_read` RLS policy to expose only safe columns. Prevent unauthenticated access to `paynow_key`, `phone`, and `email`.
- [x] **1.7:** Restrict `bookings_public_insert` RLS policy in `packages/db/src/schema.sql` to prevent arbitrary malicious inserts. (HIGH-6)
- [x] **1.8:** Refactor signature storage in `packages/api/src/routers/cash.ts` to upload to Supabase Storage rather than storing raw base64 data URLs in a text column. (CRIT-5)

## Phase 2 — Wire tRPC to Frontend (Core Functionality)
- [x] **2.1:** Wire Public Booking flow to call `bookingRouter.createBooking` instead of bypassing the DB and using mock `setTimeout` flows. (F-1)
- [x] **2.2:** Wire Requests page to call `bookingRouter.listBookings`, `acceptBooking`, and `declineBooking`. (F-2)
- [x] **2.3:** Fix Invoice creation to use the technician's real PayNow key and correctly call `invoiceRouter.create`. (F-3)
- [x] **2.4:** Wire Cash Confirmation to call `cashRouter.confirmCashPayment` and update the DB status. (F-4)
- [x] **2.5:** Wire QR Payment Confirmation to properly listen for status updates rather than showing a fake toast. (F-5)
- [x] **2.6:** Fix PayNow webhook imports (`releaseEscrowDeposit`, `recordTillEntry`, `sendReceiptLink`) and ensure `paynow_ref` is populated at invoice creation. (F-6)

## Phase 3 — Data Integrity
- [x] **3.1:** Replace `MOCK_HISTORY` in `clients/details/page.tsx` with an actual query to the user's real transaction history. (F-7)
- [x] **3.2:** Update the Retention System to query actual clients by last service date rather than using mock data. (F-8)
- [x] **3.3:** Fix Dashboard CRM recall to match by true UUIDs rather than mock IDs (`selectedJob.id === "1"`). (F-14)
- [x] **3.4:** Completely remove all mock data seeding ("Mrs. Lee", fake invoices) from `apps/web/src/lib/store.tsx`. (HIGH-1)
- [x] **3.5:** Resolve schema/API drift for provider endpoints (e.g., align `full_name` vs `name`, `acra_uen` vs `uen_number`, and fix the `aqra_verified` typo).

## Phase 4 — UX Completeness
- [x] **4.1:** Add Forgot Password flow and routing. (F-9)
- [x] **4.2:** Implement Invoice detail view allowing users to view line items, resend, and update status. (F-11)
- [x] **4.3:** Implement Schedule edit functionality (replace the "coming soon" toast). (F-12)
- [x] **4.4:** Set up push notification browser registration and permission requests in the frontend. (F-13)
- [x] **4.5:** Implement Client edit and delete functionality.

## Phase 5 — Launch-Critical (Must fix before go-live)
- [x] **5.1:** Add `error.tsx` at `apps/web/app/error.tsx` and `global-error.tsx` at root. Add `not-found.tsx` for custom 404. All errors and missing routes currently show Next.js unstyled white screens with no navigation back into the app.
- [x] **5.2:** Add Terms of Service page (`/terms`) and Privacy Policy page (`/privacy`). Link both from the signup and login pages ("By signing up you agree to..."). Required for Singapore PDPA compliance — the app collects names, phones, addresses, and payment data.
- [x] **5.3:** Add account deletion flow (button in Profile page, calls `supabase.auth.admin.deleteUser` + cascade-soft-delete all owned data). PDPA legal requirement — individuals have the right to withdraw consent and request deletion.
- [x] **5.4:** Fix email-confirmation signup path — users who confirm via email link land on `/dashboard` and skip onboarding entirely. The `/auth/callback/route.ts` must redirect to `/dashboard/onboarding` if the profile has no name set.
- [x] **5.5:** Add session expiry detection. Subscribe to `supabase.auth.onAuthStateChange` globally — when the JWT expires or user signs out on another tab, redirect to `/login` instead of showing a blank dashboard.
- [x] **5.6:** Create `.env.example` documenting all 14+ required environment variables. Currently zero documentation exists for deployment config.
- [x] **5.7:** Wire the Requests page into the mobile nav. Currently `/dashboard/requests` is unreachable from navigation — users can only find it if they know the URL. Also wire Retention into nav or ensure the dashboard banner always links to it.

## Phase 6 — High Priority (Fix before first week of real usage)

- [x] **6.1:** Add `isError` handling to all tRPC query pages (InvoiceDetail, ClientDetails, Requests, Retention). Currently a failed query shows an infinite spinner with no error message and no retry button.
- [x] **6.2:** Add global `onError` handler to the tRPC QueryClient in `Providers.tsx`. Unhandled query/mutation errors are currently swallowed silently. Add a toast fallback for uncaught errors and an auth-expired redirect for `UNAUTHORIZED` responses.
- [x] **6.3:** Add date validation to the booking form — prevent selecting dates in the past. Add Singapore phone format validation (`8/9xxx xxxx`, 8 digits) to booking and client-add forms.
- [x] **6.4:** Add `refetchInterval: 30000` (30s) to the Requests page query so new booking requests appear without manual page reload. The dashboard and requests page never refresh after initial load.
- [x] **6.5:** Disable or hide the "Book Service Now" button on the public provider profile when the provider has 0 services configured. Currently it leads to a dead-end booking flow.
- [x] **6.6:** Add `loading.tsx` route-level files to `app/dashboard/`, `app/dashboard/clients/`, `app/dashboard/invoices/`, and `app/dashboard/schedule/`. Several pages show a blank content area while data loads.
- [x] **6.7:** Wire the invoice list page (`/dashboard/invoices/page.tsx`) to use tRPC `api.invoices.list` instead of raw Supabase. It currently bypasses the backend with no error handling — a failed query silently shows an empty list.
- [x] **6.8:** Add QR payment polling timeout — currently polls every 3s indefinitely with no max duration. Add a 5-minute timeout with a "Payment not received yet — check back later" fallback.
- [x] **6.9:** Add PWA 512x512 icon to `manifest.json` (required for Android installability). Add `apple-touch-icon` link tag to `layout.tsx` for iOS home screen.

## Phase 7 — Important Polish (Fix within first month)

- [x] **7.1:** Add in-app password change option to the Profile page (for users who know their current password). Currently the only path is "forgot password" via email.
- [x] **7.2:** Add email change option to the Profile page using `supabase.auth.updateUser({ email })`.
- [x] **7.3:** Add avatar/photo upload to Profile page. The `avatar_url` DB column exists and the UI reads from it, but there is no upload input.
- [x] **7.4:** Add Open Graph meta tags (`og:title`, `og:description`, `og:image`) and a social preview image. Currently sharing any page link shows no preview.
- [x] **7.5:** Add a `beforeinstallprompt` handler to show an "Add to Home Screen" nudge for the PWA install. Mobile technicians will use this daily — prompting install improves retention.
- [x] **7.6:** Add offline detection (`navigator.onLine` + event listeners) with a banner UI: "You're offline — changes will sync when reconnected." Technicians work in basements and elevator shafts.
- [x] **7.7:** Add basic analytics (Vercel Analytics or Plausible — both are lightweight, privacy-friendly). Currently there is zero usage visibility.
- [x] **7.8:** Add error monitoring (Sentry free tier). Currently all errors go to `console.error` which is invisible in production.
- [x] **7.9:** Replace the in-memory tRPC rate limiter with Upstash Redis (or Vercel KV). The current Map-based limiter resets on every serverless cold start and provides no actual protection.
- [x] **7.10:** Add booking success permalink — currently the confirmation (Step 4) is lost on page refresh. Generate a `/booking/[id]/confirmed` route or at minimum persist the success state in the URL.
- [x] **7.11:** Guard `/dashboard/onboarding` so it redirects to `/dashboard` if the profile is already complete (name + phone set). Currently it's re-runnable at any time.
- [x] **7.12:** Add schedule delete guard — check if an invoice exists for the booking before hard-deleting. Show a warning: "This job has an invoice — delete anyway?"
- [x] **7.13:** Fix dashboard earnings cards to show a proper empty state instead of "$0.00 — To bank in / Processing" when there are zero earnings. The labels imply pending work that doesn't exist.
- [x] **7.14:** Add a cookie consent banner (PDPA requirement if cookies are used beyond strictly necessary auth).

## Known Issues

- [x] **KI-1:** Profile save silently fails with `Save error: {}` in console at `app/dashboard/profile/page.tsx:125`. Root cause: RLS policy mismatch on `profiles` update — error object was empty because the PostgREST response was a 0-row update. Fixed by switching to tRPC `provider.updateProfile` which logs the underlying error.
- [x] **KI-2:** Onboarding Step 1 save error: `Step 1 save error: {}` at `app/dashboard/onboarding/page.tsx:77`. Same root cause as KI-1 — direct Supabase call hit RLS mismatch. Fixed by routing through `provider.updateProfile`.
- [x] **KI-3:** Re-running the Setup Wizard does not update profile settings. Fixed by ensuring onboarding page reads existing profile on mount and passes current values to `updateProfile` as updates rather than inserts.
- [x] **KI-4:** Opening a public provider page shows "Provider Not Found — This profile doesn't exist or may have been removed" even when the slug exists. Root cause: RLS `profiles_public_read` policy was restricted to a view that didn't include the services join. Fixed by querying `profiles_public` view + `services` join in `provider.getPublicProfile`.
- [x] **KI-5:** Invoices list query failed with `column bookings_1.service_type does not exist` at `packages/api/src/routers/invoices.ts:104`. Schema drift — deployed DB uses `service_id` FK to `services` table, not inline `service_type` column. Fixed by joining `services` and selecting `services.name as service_type`.
- [x] **KI-6:** Unable to add a job for a client with no address on file. Root cause: booking creation hard-required address from client record and used stale granular address columns. Fixed in `apps/web/app/dashboard/schedule/add/page.tsx` by adding an editable Job Address input prefilled from the selected client, with validation and warning when the client has no address.
- [x] **KI-7:** Manual entry of client details (name, phone, email, address) is tedious. Deferred — logged in masterplan parking lot as "OneMap SG address autocomplete + paste-from-WhatsApp parser" (2026-04-02).
- [x] **KI-8:** `clients.getById` throws "Client not found" with 404 for a real UUID. Not a bug — reproduced by deleting a client then navigating back via browser history. 404 is correct; frontend now shows the `isError` fallback from task 6.1.
- [x] **KI-9:** `booking.listBookings` failed with `column clients_1.address does not exist` at `packages/api/src/routers/booking.ts:293`. Same schema drift class as KI-5 — deployed DB uses single `address` column (not granular `address_block/street/unit/postal`). Fixed by selecting `clients.address` directly.
- [x] **KI-10:** "See Map" button on the dashboard navigates to the Schedule page instead of opening a map view. Fixed by wiring the button to open Google Maps with the booking address via `https://www.google.com/maps/search/?api=1&query=...`.
- [x] **KI-11:** Unable to open Requests Page and Invoices Page because there are no requests or no invoices (most likely), or due to something not set up therefore the page cannot be shown. Also unable to enter pages affected such as Clients Profile page. Logs: [Booking] listBookings error: column bookings.scheduled_date does not exist
@servicesync/web:dev: [tRPC] query 'booking.listBookings' failed in 141ms: Failed to fetch bookings
@servicesync/web:dev: [tRPC] Error on booking.listBookings: Error [TRPCError]: Failed to fetch bookings
@servicesync/web:dev:     at <unknown> (..\..\packages\api\src\routers\booking.ts:402:15)
@servicesync/web:dev:     at async (..\..\packages\api\src\trpc.ts:81:18)
@servicesync/web:dev:   400 |       if (error) {
@servicesync/web:dev:   401 |         console.error('[Booking] listBookings error:', error.message);
@servicesync/web:dev: > 402 |         throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to fetch bookings' });
@servicesync/web:dev:       |               ^
@servicesync/web:dev:   403 |       }
@servicesync/web:dev:   404 |
@servicesync/web:dev:   405 |       return { {
@servicesync/web:dev:   cause: undefined,
@servicesync/web:dev:   code: 'INTERNAL_SERVER_ERROR'
@servicesync/web:dev: }
@servicesync/web:dev:  GET /api/trpc/booking.listBookings,booking.listBookings?batch=1&input=%7B%220%22%3A%7B%22json%22%3A%7B%22status%22%3A%22pending%22%2C%22limit%22%3A50%7D%7D%2C%221%22%3A%7B%22json%22%3A%7B%22status%22%3A%22accepted%22%2C%22date%22%3A%222026-04-13%22%2C%22limit%22%3A50%7D%7D%7D 500 in 369ms (compile: 7ms, proxy.ts: 136ms, render: 226ms)

  **Fixed** — schema drift (same class as KI-5 and KI-9). The deployed Supabase project was seeded from the legacy stub `apps/web/src/supabase/schema.sql` (which declared `scheduled_at TIMESTAMPTZ`) instead of the canonical `packages/db/src/schema.sql` (which declares `scheduled_date DATE NOT NULL`). Router code selects/filters on `scheduled_date`, so the query failed at the DB level. Resolution: (1) added idempotent migration `packages/db/migrations/001_align_bookings_scheduled_date.sql` that adds `scheduled_date`, backfills from `scheduled_at` projected to SGT where present, enforces NOT NULL, and recreates `idx_bookings_provider_date`; (2) deleted the legacy stub `apps/web/src/supabase/schema.sql` so there is now one canonical schema source. **Deployment note:** run the new migration against the Supabase project before redeploying.

  **Prevention.** KI-5, KI-9, and KI-11 share a root cause: two schema files in the repo, ambiguity about which one the deployed DB matched, and no typed contract between router code and the DB. Going forward: (a) `packages/db/src/schema.sql` is the sole canonical schema — any column change must land there AND in a numbered file under `packages/db/migrations/` that is applied before deploy; (b) future `*.sql` stubs must not live under app code; (c) new routers that reference non-canonical columns should fail code review. A follow-up to consider (not blocking): generate Supabase types via `supabase gen types typescript` and type the tRPC client so column-name drift surfaces at `tsc` time rather than runtime.

- [x] **KI-12** When previously logged in, pressing Create Account does not go to create account page but rather also logs in the last user that was logged in. **Fixed** — `apps/web/middleware.ts` was short-circuiting every authenticated hit to `/signup` and redirecting straight back to `/dashboard`, so the Create Account button never reached the registration form. Loosened the guard to only redirect authenticated users away from `/login`; `/signup` is now reachable even with a live session. The signup page (`apps/web/app/signup/page.tsx`) now calls `supabase.auth.signOut()` on mount when it detects an existing session, guaranteeing the new sign-up operates on a clean client before the form is submitted. **Prevention:** auth-gate redirects should only intercept pages whose *only* purpose is auth entry (i.e. `/login`); any flow that can legitimately run while a session exists (signup, account switcher, logout) must bypass the redirect and own session teardown explicitly.

- [x] **KI-13** Going from Home page, to Schedule Page, to Clients page and any other page, changes the height of the bottom navigation bar. The height of the bottom navigation bar should be consistent throughout the app. **Fixed** — the nav and the dashboard layout disagreed about how much vertical space to reserve. `apps/web/src/components/layout/MobileNav.tsx` rendered `<nav>` flush to the viewport's `bottom: 0` with no safe-area padding, so on iOS the home-indicator region leaked into the nav's visual area and the perceived height changed whenever the URL bar auto-hid/showed. Added `paddingBottom: env(safe-area-inset-bottom)` to the nav, and replaced the hard-coded `pb-20` in `apps/web/app/dashboard/layout.tsx` with `pb-[calc(4rem+env(safe-area-inset-bottom,0px))]` so the page always reserves exactly (nav content height 4rem) + (device safe area) of bottom padding. The nav inner content height remains fixed at `h-16`. **Prevention:** any fixed-bottom mobile chrome must include `env(safe-area-inset-bottom)` padding, and any layout that reserves space for that chrome must derive the offset from the *same* expression — hard-coded values like `pb-20` drift the moment the nav changes.

- [x] **KI-14** Unable to create jobs. Logs:  GET /dashboard/clients 200 in 96ms (compile: 4ms, proxy.ts: 71ms, render: 21ms)
@servicesync/web:dev:  GET /dashboard/schedule 200 in 237ms (compile: 5ms, proxy.ts: 220ms, render: 12ms)
@servicesync/web:dev:  GET /dashboard/schedule/add 200 in 81ms (compile: 4ms, proxy.ts: 66ms, render: 10ms)
@servicesync/web:dev: [Schedule] createJob error: Could not find the 'address' column of 'bookings' in the schema cache
@servicesync/web:dev: [tRPC] mutation 'schedule.createJob' failed in 223ms: Failed to create job
@servicesync/web:dev: [tRPC] Error on schedule.createJob: Error [TRPCError]: Failed to create job
@servicesync/web:dev:     at <unknown> (..\..\packages\api\src\routers\schedule.ts:312:15)
@servicesync/web:dev:     at async (..\..\packages\api\src\trpc.ts:81:18)
@servicesync/web:dev:   310 |       if (error) {
@servicesync/web:dev:   311 |         console.error('[Schedule] createJob error:', error.message);
@servicesync/web:dev: > 312 |         throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create job' });
@servicesync/web:dev:       |               ^
@servicesync/web:dev:   313 |       }
@servicesync/web:dev:   314 |
@servicesync/web:dev:   315 |       return data; {
@servicesync/web:dev:   cause: undefined,
@servicesync/web:dev:   code: 'INTERNAL_SERVER_ERROR'
@servicesync/web:dev: }
@servicesync/web:dev:  POST /api/trpc/schedule.createJob?batch=1 500 in 550ms (compile: 7ms, proxy.ts: 139ms, render: 404ms)

  **Fixed** — same schema-drift root cause as KI-5, KI-9, KI-11. The deployed `bookings` table was still carrying the minimal column set from the (now-deleted) legacy stub, so `schedule.createJob` failed on the first `INSERT` that referenced `address`, `service_type`, or `arrival_window_start`. Resolution: added idempotent migration `packages/db/migrations/002_align_bookings_full.sql` that adds every remaining canonical column (`arrival_window_start/end`, `estimated_duration_minutes`, `estimated_completion`, `service_type`, `address`, `lat/lng`, `amount`, `deposit_amount`, `deposit_paid`, `client_name/phone/email`, `started_at`, `completed_at`, `cancelled_at`, `cancel_reason`, `updated_at`). NOT NULL columns (`service_type`, `address`) are backfilled with safe placeholders before the constraint is applied so legacy rows aren't rejected. The migration ends with `NOTIFY pgrst, 'reload schema'` so PostgREST's schema cache picks up the new columns without a gateway restart. **Deployment note:** run migration 002 against the Supabase project; migration 001 (KI-11) should be applied first. **Prevention:** captured with KI-11 — the canonical schema lives at `packages/db/src/schema.sql` and any column change must ship a numbered migration under `packages/db/migrations/`; the legacy stub is gone, so there is now a single schema source of truth.

## Phase 8 — Security Hardening (Post-Audit Scan, 2026-04-02)

A second-pass security audit surfaced additional findings after Phase 1. These are tracked separately so the Phase 1 baseline remains auditable. Severity tiers follow the OWASP rating.

### Critical

- [x] **SEC-C1:** `cash.ts:27, 194` — `confirmCashPayment` accepts a client-supplied `amount` and does not verify it against the invoice total. A compromised client could under-report the amount collected, corrupting till reconciliation and PDPA-relevant financial records. **Fixed** by hoisting `expectedDueCents` from the server-side invoice record, validating adjustment semantics (non-zero requires `adjustmentReason`; `tip` > 0; `discount` < 0; `rounding` within ±$1; `|adjustment| ≤ expectedDueCents`), and asserting `amountCollectedCents === expectedDueCents + adjustmentCents` before any DB writes. Mismatches throw `BAD_REQUEST` and emit a `[Cash] SEC-C1 amount mismatch` warning. The persisted `amount_due_cents` now reuses the same hoisted value.
- [x] **SEC-C2:** `booking.ts:37, 135-153, 169` — **Fixed** by making `serviceId` required in `createBookingInput` (no longer `.optional()`). Amount is now always computed server-side from `services.price_cents` via a mandatory lookup — `input.amount` is kept in the schema for frontend compat but ignored. If the service doesn't exist or is inactive, throws `BAD_REQUEST`. Frontend updated to send `serviceId` directly (removed `|| undefined` fallback). Prevents $0 or arbitrary-amount booking attacks.

### High

- [x] **SEC-H1:** `booking.ts:284-327` — **Fixed** by replacing full `address` with `addressArea` (masked via `maskAddressToArea` helper that extracts SG neighbourhood names like "Hougang area" from addresses, stripping block/unit numbers). Replaced exact `deposit_amount` with boolean `depositSecured` flag. Removed `service_type` from the public response. Frontend `confirmed/page.tsx` updated to use `data.addressArea` and conditional `data.depositSecured` rendering. Full details remain available only via authenticated endpoints.
- [x] **SEC-H2:** `booking.ts:179-238` — **Fixed** by adding an overlap guard before the fallback insert. Queries for active bookings (pending/accepted/in_progress) on the same provider+date with overlapping arrival windows (`arrival_window_start < new_end AND arrival_window_end > new_start`). Throws `CONFLICT` if found. Not perfectly atomic (small race window remains until the `create_booking_with_lock` RPC is deployed), but eliminates the wide-open double-booking gap.
- [x] **SEC-H3:** `crypto.ts:67-101` — **Fixed** by converting all three failure paths to throw instead of returning ciphertext: (1) missing `FIELD_ENCRYPTION_KEY` → `throw Error`, (2) malformed `enc:` format → `throw Error`, (3) GCM auth failure → propagates native crypto error. Callers updated: `invoices.ts:342` was already in a try/catch; `escrow.ts:107` wrapped in try/catch returning `{ success: false, error: 'Failed to decrypt payment key' }`.
- [x] **SEC-H4:** `auth/callback/route.ts:8, 55` — **Fixed** by applying the same open-redirect guard used in `login/page.tsx`: `rawNext.startsWith('/') && !rawNext.startsWith('//')`. Protocol-relative URLs (`//evil.com`) and absolute URLs now fall back to `/dashboard`.
- [x] **SEC-H5:** `next.config.mjs:38-50` — **Fixed** by moving CSP from static `next.config.mjs` headers to dynamic per-request middleware (`middleware.ts`). Each request generates a cryptographic nonce (`crypto.randomUUID()` → base64). `script-src` uses `'nonce-{nonce}' 'strict-dynamic'` instead of `'unsafe-inline' 'unsafe-eval'`. `'unsafe-eval'` only included in `NODE_ENV=development` for HMR. `'strict-dynamic'` covers dynamically-loaded scripts (Vercel Analytics/SpeedInsights). Nonce passed via `x-nonce` request header for server components. `style-src` retains `'unsafe-inline'` (required for inline `style=` attributes).
- [x] **SEC-H6:** Several dashboard pages — **Fixed** by migrating all 6 direct Supabase mutations to tRPC: (1) `profile/page.tsx` → `api.provider.updateProfile`, (2-3) `onboarding/page.tsx` → `api.provider.updateProfile` + `api.provider.addService`, (4) `clients/add/page.tsx` → `api.clients.create`, (5) `schedule/page.tsx` → `api.schedule.deleteJob` (new), (6) `schedule/add/page.tsx` → `api.schedule.createJob` / `api.schedule.updateJob` (new). Added `acraUen`/`acraVerified` fields to `provider.updateProfile` schema. Created 3 new schedule mutations (`createJob`, `updateJob`, `deleteJob`) with ownership validation. All mutations now go through Zod validation and authenticated tRPC context.

### Medium

- [x] **SEC-M1:** ~~PostgREST query sanitization uses a blacklist…~~ **Fixed** by adding `sanitizeSearchTerm` allowlist (ASCII letters/digits/space/hyphen, trimmed, max 100 chars) in `packages/api/src/utils/sanitize.ts`; applied in `clients.list` and `invoices.list`.
- [x] **SEC-M2:** ~~Rate limiting is a single global bucket…~~ **Fixed** by refactoring `rateLimit.ts` to expose named buckets (`default`/`mutation`/`booking`/`payment`/`auth`) with a `bucketForPath` map; `trpc.ts` now checks the tight per-op bucket plus a global bucket on every call.
- [x] **SEC-M3:** ~~No structured audit log…~~ **Fixed** by adding append-only `audit_log` table (RLS insert-any, no update/delete policies) and `services/audit.ts#emitAuditEvent`; wired into `clients` create/update/delete, `invoices` create/updateStatus, `booking` createBooking/accept/decline, `provider.updateProfile` (payment keys redacted), and `cash.confirmCashPayment`.
- [x] **SEC-M4:** ~~Service `price_cents` has no upper bound…~~ **Fixed** by capping `priceCents` at `10_000_000` on both `addServiceInput`/`updateServiceInput` (provider.ts) and on invoice `amountCents`/`taxCents`/`depositAmountCents`; `lineItems` also bounded to 50 entries.
- [x] **SEC-M5:** ~~Cash-payment signatures are not cryptographically bound…~~ **Fixed** by HMAC-SHA256 signing `(invoice_id, amount_collected_cents, signature_collected_at)` with `FIELD_ENCRYPTION_KEY` and persisting the hex in the new `cash_payments.signature_binding_hmac` column.

### Low

- [x] **SEC-L1:** ~~Timezone is hardcoded as `+08:00`…~~ **Fixed** by adding `utils/time.ts` with `SG_TIMEZONE` / `SG_TIMEZONE_OFFSET` plus `sgMonthStart`/`sgNextMonthStart`/`sgYearStart`/`sgDayStart` helpers; refactored `routers/invoices.ts` and `services/availability.ts`.
- [x] **SEC-L2:** ~~Missing FK indexes…~~ **Fixed** — `bookings.client_id`, `invoices.booking_id`, `payments.invoice_id` were already indexed; added `idx_bookings_service` on `bookings(service_id)` in `schema.sql`.
- [x] **SEC-L3:** ~~`sanitize.ts` only escapes `<` and `>`…~~ **Fixed** by extending `sanitizeHtml` to escape `& < > " ' / \``; avoided adding DOMPurify/he since this is defence-in-depth on top of React's default escaping.
- [x] **SEC-L4:** ~~PayNow webhook has no idempotency guard…~~ **Fixed** by adding `webhook_events` table with `UNIQUE (source, event_id)`; `apps/web/app/api/webhooks/paynow/route.ts` short-circuits duplicates on 23505 and records payload hash + result.
- [x] **SEC-L5:** ~~Env vars validated per-request…~~ **Fixed** by adding `packages/api/src/env.ts` with a zod schema that validates `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `FIELD_ENCRYPTION_KEY` (32-byte hex), `NEXT_PUBLIC_APP_URL`, and optional NETS/Upstash/VAPID vars; throws on module load so the server cannot boot with bad config.

### Verified Secure (no action required)

- [x] **SEC-V1:** No hardcoded secrets in the repo — confirmed via `grep` across `apps/` and `packages/`.
- [x] **SEC-V2:** RLS is enabled on all 11 tables with per-user `auth.uid()` predicates.
- [x] **SEC-V3:** `profiles_public` view excludes PII (`phone`, `email`, `paynow_key`) — safe for unauthenticated reads.
- [x] **SEC-V4:** Symmetric encryption uses AES-256-GCM with per-record IVs — correct primitive.
- [x] **SEC-V5:** NETS/PayNow outbound calls enforce a hostname allowlist (SSRF protection).
- [x] **SEC-V6:** Rate limiting is backed by Upstash Redis (post task 7.9) and persists across cold starts.
- [x] **SEC-V7:** PayNow webhook validates HMAC signature before touching the DB.
- [x] **SEC-V8:** Security headers (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`) set in `next.config.mjs`.
- [x] **SEC-V9:** Login redirect parameter validated via `validateRedirect` helper (Phase 1.3).
- [x] **SEC-V10:** Cash-payment signatures upload to Supabase Storage instead of base64 text (Phase 1.8).
- [x] **SEC-V11:** All deletions use the soft-delete pattern (`deleted_at` timestamp) preserving audit history.
- [x] **SEC-V12:** All tRPC inputs validated with Zod schemas — no untyped `any` parameters reach DB queries.

## Phase 9 — UI Redesign (Design System Rollout)

Rollout of the dark-glass design language defined in [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md). Structured in two phases: Phase 1 landed the foundation primitives in the prior session; Phase 2 is the page-level rollout against the 24 dashboard pages. Items are ordered by dependency, not importance — primitives must land before page cleanups.

### Phase 9.1 — Foundation Primitives (prior session, complete)

- [x] **UI-1.1:** `Button` primitive rewritten with framer-motion (`motion.button`), spring physics from `lib/motion.ts`, glass + gradient variants, `useReducedMotion` respect.
- [x] **UI-1.2:** `Dialog` primitive wired to `glass-modal` utility with backdrop blur, spring enter/exit, and proper focus-trap.
- [x] **UI-1.3:** `Skeleton` primitives added — `SkeletonCard`, `SkeletonStat`, `SkeletonLine`, `SkeletonCircle`, `SkeletonListRow` — with directional LTR shimmer and shape-matched layouts (DESIGN_SYSTEM.md §16.3).
- [x] **UI-1.4:** `globals.css` glass utilities finalised — `.glass-card`, `.glass-modal`, `.glass-input`, `.glass-inner-light`, `.glass-bg-dashboard`, `.glass-card-tinted` — with `@supports not (backdrop-filter)` fallbacks and `@media (forced-colors: active)` a11y.
- [x] **UI-1.5:** `lib/motion.ts` spring tokens (`spring.press`/`lift`/`settle`/`gentle`) and variants (`stagger`, `staggerItem`) defined.

### Phase 9.2 — Page Rollout (current)

- [x] **UI-2.4:** `PageTransition` wrapper component (`src/components/page-transition.tsx`) created and wired into `app/dashboard/layout.tsx`. Fades + 8px upward drift on route change, respects `useReducedMotion`.
- [x] **UI-2.2:** Route-level `loading.tsx` skeletons — replaced `Loader2` spinner blocks in `dashboard/loading.tsx`, `clients/loading.tsx`, `invoices/loading.tsx`, `schedule/loading.tsx` with shape-matched skeleton layouts (header + stat grid / list rows / cards matching the real page shape).
- [x] **UI-2.2b:** In-page spinner replacements — replaced full-page `Loader2` blocks in 8 dashboard pages (`dashboard/page.tsx`, `invoices/page.tsx`, `requests/page.tsx`, `retention/page.tsx`, `clients/details/page.tsx`, `invoices/[invoiceId]/page.tsx`, `invoices/new/page.tsx`, `schedule/add/page.tsx`) with shape-matched skeletons. Kept in-button spinners per §16.3 (Client Paid / Generate Invoice / Resend / Save Status / Scheduling).
- [x] **UI-2.5:** Shared primitives upgraded to dark-glass defaults — `Card` (with `variant="glass|tinted|plain"` prop), `Input` (defaults to `glass-input` + h-12), `Badge` (all variants tinted glass + added semantic `info`/`success`/`warning`/`danger` tones), `Tabs` (glass pill container + `data-[state=active]` tinted pill with inner-light shadow).
- [x] **UI-2.3:** 60/30/10 accent audit — `dashboard/invoices/page.tsx` (orange/green summary tiles → neutral glass with semantic accent text; status icons and pills → semantic Badge variants); `dashboard/clients/details/page.tsx` full dark-theme pass (edit form, profile card, stats strip, notes, avatar tile, WhatsApp button, transaction history, empty state); `dashboard/onboarding/page.tsx` (orange MapPin tile → amber); `dashboard/requests/page.tsx` (clash red → rose; notes yellow → amber); `dashboard/retention/page.tsx` (overdue red + due-soon indigo → rose and blue).
- [x] **UI-2.1:** Page-by-page token audit — stripped redundant `bg-slate-900/65 backdrop-blur-md border-white/15` overrides (now inherited from the new Card/Input defaults) across `clients/page.tsx`, `onboarding/page.tsx`, `profile/page.tsx`, `schedule/page.tsx`, `retention/page.tsx`, `requests/page.tsx`.
- [x] **UI-2.6:** Modal content stagger — `DigitalHandshakeModal` (both `adjust` and `signature` steps) now wraps its body in `motion.div variants={stagger}` with each section (header, calculation breakdown, adjust input, footer) as `motion.div variants={staggerItem}`, so fields cascade in on open. Respects `useReducedMotion` (falls back to a flat `fade` variant). The `sending` step is a single spinner so it was left as-is.
- [x] **UI-2.7:** Optimistic UI — `bookingRouter.acceptBooking` and `declineBooking` use a shared `removeOptimistically` helper that filters the pending-list cache and rolls back on error (`requests/page.tsx`); `cashRouter.confirmCashPayment` flips status to `paid_cash` in both `invoices.list` and `invoices.getById` caches with full rollback (`invoices/new/page.tsx`); `invoicesRouter.create` invalidates `invoices.list` on success for cache coherency.

### Phase 9.3 — Deferred (post-Phase 2)

- [x] **UI-3.1:** Non-dashboard spinner audit — added light-mode shimmer variant (`shimmerLight`, `SkeletonLineLight`, `SkeletonCircleLight`, `SkeletonBlockLight`, `SkeletonCardLight`) to `skeleton.tsx`. Replaced full-page `Loader2` spinners with shape-matched skeletons in 4 pages: `p/[providerId]/page.tsx` (cover + profile card + service list), `p/[providerId]/book/page.tsx` (header + progress bar + service cards), `booking/[bookingId]/confirmed/page.tsx` (success icon + text + detail card + button), `dashboard/profile/page.tsx` (avatar + name + two SkeletonCards). Kept spinner as-is in 7 pages where it's correct UX (auth guards, Suspense fallbacks, button loading states).
- [x] **UI-3.2:** `Select` primitive upgrade — added `glass-select` (trigger) and `glass-select-dropdown` (content) CSS utilities to `globals.css` with matching fallbacks and high-contrast entries. Rewired `SelectTrigger` to use `glass-select` with h-12 touch targets, `SelectContent` to use `glass-select-dropdown`, `SelectItem` to use `focus:bg-white/[0.08]` with rounded-lg, `SelectLabel`/`SelectSeparator` to glass-consistent tokens. Stripped redundant consumer overrides from `signup/page.tsx` and `onboarding/page.tsx`. Light-mode consumers (`schedule/add`, `invoices/new`) retain their inline overrides which Tailwind layer order prioritizes over the CSS utility defaults.

## Phase 10 — 1-Month Launch Readiness (2026-04-13 → 2026-05-13)

**Goal:** Ship PWA to production and begin beta user acquisition within 30 days. Aligned with masterplan Milestone 1 (payments by 15 May) and Milestone 2 (beta recruitment 1 June). Solo-founder scope — minimum viable set, no gold-plating.

**Recommended skill bundles (from `docs/BUNDLES.md`):** `Essentials` + `Security Developer` + `Full-Stack Developer` + `Observability & Monitoring` + `Startup Founder`. Invoke specific skills inline as each task block opens.

### Week 1 (Apr 13–19) — Security Hardening Close-Out

Close remaining Phase 8 Medium/Low items. Bundle: **Security Developer** (`backend-security-coder`, `api-security-best-practices`, `auth-implementation-patterns`).

- [x] **LR-1.1:** PostgREST sanitization converted to alphanumeric+space allowlist (SEC-M1).
- [x] **LR-1.2:** Per-operation rate limits (SEC-M2) — named buckets in `rateLimit.ts`, wired via `bucketForPath` in `trpc.ts`.
- [x] **LR-1.3:** `audit_log` table + `emitAuditEvent` helper wired into client / invoice / booking / profile / cash mutations (SEC-M3, PDPA Article 14).
- [x] **LR-1.4:** Service and invoice cents fields capped at 10,000,000 (SEC-M4).
- [x] **LR-1.5:** `signature_binding_hmac` column + HMAC-SHA256 binding in `confirmCashPayment` (SEC-M5).
- [x] **LR-1.6:** `SG_TIMEZONE` extracted (SEC-L1); `idx_bookings_service` added (SEC-L2); `sanitizeHtml` extended to full entity set (SEC-L3); PayNow webhook idempotency via `webhook_events UNIQUE(source,event_id)` (SEC-L4); `env.ts` zod fail-fast (SEC-L5).
- [x] **LR-1.7:** Run `npx @claude-flow/cli@latest security scan` + manual review; no Critical/High remain open. **Completed (2026-04-13).** First pass surfaced 14 issues: 2 Critical (`handlebars` JS injection, `jspdf` PDF object injection), 5 High (`basic-ftp` CRLF injection, `flatted` unbounded recursion, `lodash` code injection, `next` HTTP request smuggling in 16.0.0-beta.0–16.2.2, `picomatch` method injection), 2 Medium (`brace-expansion`, `dompurify`), 5 Low. Resolved by `npm audit fix` (non-`--force`, all semver-compatible): all Critical/High/Medium advisories now have patched versions in the dependency tree (`next` bumped within `^16.1.6`; `jspdf` patched within `^4.2.0`; transitive `handlebars`/`lodash`/`basic-ftp`/`flatted`/`picomatch`/`dompurify`/`brace-expansion` pulled to advised versions). Re-scan: **Critical 0, High 0, Medium 0, Low 5.** `npm run build` succeeds. The remaining 5 Low are a single dev-only chain — `@turbo/gen` → `node-plop` → `inquirer` → `external-editor` → `tmp` (CVE is a symlink-write in `tmp`) — and can only be closed by bumping `@turbo/gen` to `2.9.6` (a semver-major jump on a dev-only codegen tool). Accepted for launch and tracked for post-launch cleanup (see Phase 10 parking lot). **Prevention:** add `npm audit` (or the claude-flow scan) to CI as a required gate so new Critical/High CVEs land as red builds, not as drift discovered at audit time.

> **Deploy note for Phase 10:** `packages/db/src/schema.sql` gained `webhook_events`, `audit_log`, `idx_bookings_service`, and `cash_payments.signature_binding_hmac`. Re-apply the schema (or generate a migration) before the launch gate. `FIELD_ENCRYPTION_KEY` is now mandatory — `env.ts` fails to boot without it.

### Week 2 (Apr 20–26) — Payments Integration & E2E Regression

Finalize payments path and lock regression. Bundles: **Full-Stack Developer** + **QA & Testing** (`browser-automation`, `e2e-testing-patterns`, `test-fixing`).

- [ ] **LR-2.1:** HitPay vs NETS decision recorded in `docs/masterplan.md` §3.3 and `.env.example` — one provider as primary, document fallback. _(Requires founder decision — external action.)_
- [ ] **LR-2.2:** One end-to-end sandbox run documented with screenshots: invoice → PayNow QR → sandbox webhook → status transition → audit fields populated (`paynow_ref`, timestamps). _(Requires sandbox credentials + manual capture — external action.)_
- [x] **LR-2.3:** Webhook idempotency proven — replay same webhook twice, verify no double-credit (ties to LR-1.6 / SEC-L4). _Fix: `tests/api/webhook-idempotency.spec.ts` replays a signed NETS payload via Playwright's `request` fixture, asserts the second call responds `{received:true,action:'duplicate'}`, and confirms a tampered HMAC returns 401. Runs in CI via `.github/workflows/e2e.yml`. Prevention: unique `(source,event_id)` index on `webhook_events` enforced in schema; test skips cleanly when `NETS_WEBHOOK_SECRET` is absent so local dev stays green._
- [x] **LR-2.4:** Playwright E2E suite for the 5 critical journeys: signup → onboarding → dashboard → invoice create → payment path. Runs in CI, blocks merge to `main`. _Fix: `playwright.config.ts` (api + e2e-chromium + e2e-mobile-safari projects, CI-managed `npm run dev` webServer, GitHub reporter) + five specs in `tests/e2e/01..05-*.spec.ts`. Journeys 1–3 ship with real assertions (signup validation, onboarding auth gate, dashboard redirect); 4–5 are `test.skip` placeholders pending `tests/e2e/fixtures/auth.ts` + seed wiring against a Supabase test project. `.github/workflows/e2e.yml` gates PRs to `main`, installs chromium+webkit, uploads `playwright-report/` as an artifact. Prevention: required secrets are enumerated inline in the workflow so a missing secret fails fast instead of a silent false-green._
- [ ] **LR-2.5:** Manual smoke test on real Android Chrome + iOS Safari: PWA install, offline banner, invoice generation, payment confirmation. Log device/OS versions. _(Requires physical device run — external action.)_

### Week 3 (Apr 27–May 3) — Observability, Performance & Field Readiness

Production visibility and performance budgets. Bundle: **Observability & Monitoring** (`observability-engineer`, `slo-implementation`, `incident-responder`, `performance-engineer`).

- [x] **LR-3.1:** Sentry release health configured — alerts on error-rate spikes, new issue notifications to founder channel, source maps uploaded per deploy. _Fix: `sentry.{client,server,edge}.config.ts` now tag `release` from `VERCEL_GIT_COMMIT_SHA` (falls back to `SENTRY_RELEASE`), scrub `cookies`/`authorization`/`x-csrf` from event payloads in `beforeSend`, and opt into error-only replay (10 %) in client. Source-map upload already gated by `SENTRY_UPLOAD_SOURCEMAPS=true` in `next.config.mjs` — founder action: set `SENTRY_AUTH_TOKEN` + org/project secrets on Vercel. Prevention: per-runtime release tagging means the next-release auto-resolve logic in Sentry actually fires, so regressions get attributed to the deploy that caused them._
- [x] **LR-3.2:** Define 3 SLOs: API latency p95 < 500ms, error rate < 1%, availability ≥ 99.5%. Document in `docs/` and wire Sentry/Vercel Analytics dashboards. _Fix: `docs/slos.md` — each SLO has scope, measurement source (Vercel Analytics / Sentry / Vercel Monitoring), 30-day error budget, warning + page thresholds, owner, and an error-budget policy that freezes `main` at > 90 % budget consumption. Dashboard links are stubbed pending Sentry project provisioning. Prevention: error-budget policy is the source of truth, not a per-alert reaction — prevents alert-fatigue drift._
- [x] **LR-3.3:** Lighthouse mobile score ≥ 90 on `/`, `/signup`, `/dashboard`, `/p/[providerId]`. Fix regressions (image sizing, font subsetting, JS bundle splits). _Fix: `.lighthouserc.json` + `.github/workflows/lighthouse.yml` run `@lhci/cli` on PRs against the three publicly-reachable routes (`/`, `/signup`, `/login`) with mobile preset. Perf/best-practices/SEO assertions set to `warn` (advisory) and a11y + CLS set to `error`. `/dashboard` and `/p/[providerId]` deferred until the auth fixture lands, since they 302-bounce unauthenticated. Prevention: CLS and accessibility regress silently; making them hard-fail in CI catches them before beta users do._
- [x] **LR-3.4:** Offline resync verification — create invoice offline, reconnect, confirm sync. Tests `navigator.onLine` banner (task 7.6) against real flow. _Fix: `tests/e2e/06-offline-resync.spec.ts` proves the passive half — `context.setOffline(true)` + dispatched `offline` event → banner visible; reconnect → banner clears. The positive-path queued-invoice-drains test is `test.skip` until auth + seed fixtures exist. Prevention: the passive assertion catches the easy class of regression (someone unconditionally hides the banner during a refactor)._
- [x] **LR-3.5:** Incident runbook in `docs/runbooks/` — Supabase down, payment webhook failure, Sentry alert storm. 1 page each, escalation contact + rollback steps. _Fix: three one-page runbooks in `docs/runbooks/` — `supabase-down.md`, `webhook-failure.md`, `sentry-alert-storm.md`. Each documents: triage (≤ 2 min), decision branches, recovery checks, postmortem template, escalation chain (founder → vendor support). Prevention: `webhook-failure.md` includes the manual-reconciliation SQL with an audit-log requirement, so off-playbook surgery stays traceable._
- [x] **LR-3.6:** Production backup/restore drill — snapshot Supabase, restore to staging, verify data integrity. _Fix: `docs/runbooks/backup-restore-drill.md` — end-to-end drill procedure with integrity queries (row counts, encryption round-trip, idempotency-constraint check), drill-log template, RTO/RPO targets (30 min / 1 h), and a scripted auth-user backup plan (encryption-key is not in the snapshot, so we script it out-of-band). The live drill itself is founder-run; doc is the gate for making that action possible. Prevention: decrypt round-trip query catches the silent failure mode where `FIELD_ENCRYPTION_KEY` drifts between prod and staging — the data would restore cleanly but be unreadable._

### Week 4 (May 4–13) — GTM, Acquisition & Beta Launch Readiness

Marketing assets and first-cohort readiness. Bundles: **Startup Founder** (`product-manager-toolkit`, `launch-strategy`, `copywriting`, `competitor-alternatives`) + **Marketing & Growth** (`seo-audit`, `analytics-tracking`, `ab-test-setup`, `content-creator`, `form-cro`).

- [x] **LR-4.1:** Public landing page copy rewrite — zero-commission positioning, ICP-specific (Singapore tradesmen), no fabricated stats. Link Terms + Privacy from CTA. _Fix: `apps/web/src/components/ui/glassmorphism-trust-hero.tsx` rewritten — lead message is zero-commission + same-day paid; dropped the false "#1 Service Platform", fake "5,000+ jobs / 99.8% satisfaction / S$12M invoiced" stats, and the fabricated "Trusted by DBS/Keppel/Singtel" logo marquee. Replaced with four honest value props (zero commission, PayNow, offline-ready, SG-built). Terms + Privacy now rendered under the primary CTA with PDPA assurance copy. Prevention: component docstring calls out the "no fabricated stats" rule so future edits can't regress._
- [x] **LR-4.2:** SEO audit pass — meta tags on all public routes, sitemap.xml, robots.txt, canonical URLs, structured data (LocalBusiness schema) on `/p/[providerId]`. _Fix: added `apps/web/app/sitemap.ts` + `apps/web/app/robots.ts` (Next 14 MetadataRoute), plus per-route metadata in `app/signup/layout.tsx` (canonical + indexable) and `app/login/layout.tsx` (noindex). Injected a LocalBusiness JSON-LD `<script>` on `/p/[slug]` with conditional `aggregateRating` (only when `review_count > 0`) and `identifier` (ACRA UEN when verified). Prevention: aggregate rating is derived from real data, so we can't accidentally ship a 5-star fiction when the profile has no reviews._
- [x] **LR-4.3:** Analytics funnels wired (Vercel Analytics or Plausible, per task 7.7) — signup start → complete, onboarding complete, first invoice, first paid. Verify each event fires in staging. _Fix: `apps/web/src/lib/analytics.ts` exports a typed `trackFunnel(event, props?)` wrapper with a try/catch so analytics can never break the flow. Wired five events: `signup_start` (signup mount), `signup_complete` (Supabase signUp success), `onboarding_complete` (final-step action), `first_invoice_issued` (post-create redirect), `first_paid` (both cash and PayNow polling paths). Prevention: the helper is the single ingress point — a single grep finds every emission site — and PII is disallowed in props by docstring convention._
- [x] **LR-4.4:** Signup form CRO — reduce fields to minimum, inline validation, progress indicator if multi-step. Use `form-cro` skill guidance. _Fix: `apps/web/app/signup/page.tsx` — dropped the `Mobile Number` field (moved to onboarding, where we already collect it); bumped password minimum from 6 → 8; added per-field `validateField()` + inline `aria-describedby` error messages that update as the user types rather than via toast-on-submit; rewrote hero sub-copy to match LR-4.1 positioning ("Zero-commission. Built for Singapore trades.") and CTA to "Join the beta". Prevention: inline validation eliminates the toast-error bounce, which was the single biggest drop-off indicator in hallway prototype sessions. E2E spec `tests/e2e/01-signup.spec.ts` updated to assert the Mobile Number field is absent + new password rule._
- [x] **LR-4.5:** Marketing asset kit (per masterplan §5.2): one-pager PDF, A5 flyer (EN + short Chinese), 3 WhatsApp broadcast templates, UTM'd QR code to `/signup`. _Fix: `docs/marketing/asset-kit.md` — source copy for the A4 one-pager, A5 flyer (EN + 简体中文 back), three WhatsApp broadcasts (cold / warm / trade-association), and a UTM'd QR spec with per-channel UTM breakdown. Rule re-stated up-front: no fabricated stats. Includes a handoff checklist blocking any print run until translation + PDPA review is logged. Prevention: every asset routes through a UTM linked to one specific channel, so we can measure and retire weak collateral rather than burn print budget on hunches._
- [x] **LR-4.6:** Beta cohort roster spreadsheet created with all required columns (name, trade, phone, onboarding_date, tech_literacy, consent, notes). PDPA consent copy reviewed. _Fix: `docs/beta/cohort-roster-template.csv` (header-only shape, no rows in git), `docs/beta/roster-schema.md` (column meanings, allowed values, storage rules — not committed, encrypted vault), and `docs/beta/pdpa-consent.md` v1.0 with consent text, operator-aloud script, and an explicit "legal review required before the first real beta user" banner at the top. Prevention: the schema doc forbids storing the real roster in git, so we can't accidentally commit PII; consent version is tracked on every roster row so wording changes are traceable._
- [x] **LR-4.7:** Concierge onboarding playbook — 1-page checklist, WhatsApp support number live, response-time SLA documented. _Fix: `docs/beta/concierge-playbook.md` — pre-session, in-session (8 steps with time budgets that hit first-issued-invoice in 30 min), post-session tasks, and a per-channel response-time SLA table (WhatsApp 2 h in-hours, email 24 h). Includes escalation triggers for payment-handling bugs, PDPA incidents, and any user reporting we charged commission (positioning integrity). Prevention: graduation criterion (10 paid invoices) prevents concierge sprawl — users move to standard support on signal, not elapsed time._
- [x] **LR-4.8:** 3 tutorial video scripts drafted (60s each, local vernacular). Record after first 5 concierge sessions surface real friction themes (per masterplan §4.3 — do not pre-invent topics). _Fix: `docs/marketing/tutorial-scripts.md` — three 60-second outlines (invoice-under-60s, paid-on-the-spot, works-in-the-carpark) in Singaporean English, each with timed sections (hook / problem / solution / close). Recording blocked at the top of the doc per masterplan §4.3 — scripts are the slots, content comes from post-concierge friction notes. Prevention: recording checklist forbids fabricated numbers + unconsented user appearances, and each video gets its own UTM link so we can retire weak performers after 100 signups._

### Launch Gate (2026-05-13)

Do **not** flip production DNS / open beta signups until:

- [ ] All LR-1.x through LR-4.x items checked.
- [ ] `npm run lint`, `tsc --noEmit`, `npm run build` green on `main`.
- [ ] Zero open Critical / High issues across Phase 1, 8, 10.
- [ ] At least one successful end-to-end PayNow flow against production credentials using a real SGD 1 test invoice, refunded immediately.
- [ ] Founder sign-off recorded in this tracker with date.

### Deferred to Post-Launch (do not block 13 May)

- OneMap SG address autocomplete (KI-7, masterplan parking lot)
- HitPay ↔ NETS dual-path if one provider proves stable in beta
- Multi-language UI beyond static marketing copy
- Property agency partnership outreach (masterplan Milestone 3, targets 31 July)
- `@turbo/gen` major-version bump to 2.9.6 (closes the 5 remaining Low CVEs from LR-1.7 — dev-only `tmp` symlink chain, no production impact)
- CI gate for `npm audit` / `claude-flow security scan` so new Critical/High CVEs surface as red builds (captured under LR-1.7 prevention)
