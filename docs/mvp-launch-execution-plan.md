# ServiceSync SG — MVP Launch Execution Plan

> **Purpose:** Consolidated, prioritized execution plan for MVP launch readiness. Synthesized from two independent architecture reviews (system architect + senior architect) against the Uncle Teck persona and Singapore trades context.
>
> **Source of truth for:** Sprint ordering, task dependencies, skill assignments, and acceptance criteria.
>
> **Related docs:** [masterplan.md](./masterplan.md), [masterplan_onboarding_plan.md](./masterplan_onboarding_plan.md), [Suggestions and Problems.md](./Suggestions%20and%20Problems.md), [BACKEND_IMPLEMENTATION.md](./BACKEND_IMPLEMENTATION.md)

| Field | Value |
|-------|-------|
| **Version** | 1.0 |
| **Created** | 2026-04-25 |
| **Owner** | Product / Engineering |
| **Target** | Beta recruitment: 1 June 2026 |

---

## Architecture Review Summary

Two parallel reviews were performed against the codebase (890 nodes, 946 edges, 15 dashboard pages, 7 tRPC routers).

**Architect Review** found: migration ordering dependency, missing `payments` row in QR confirmation, `addDays` UTC bug, no offline retry, no rate limiting on payment endpoints, no escrow failure alerting, duplicated helpers, redundant amount columns.

**Senior Architect Review** found: zero offline data protection (form state + mutation queue), partial-write split states in `confirmCashPayment` with no recovery, no cash payment void/reversal, PDPA consent absent, "Tax Invoice" label misuse for non-GST traders, session timeout silently destroys form data, locale dual-write race condition, `createContext` unhandled Supabase failure, manual QR path skips `payments` table, missing escrow retry job.

**Consensus:** The codebase has strong fundamentals (RLS, HMAC signatures, amount pinning, idempotent webhooks). The critical gap is the **resilience layer** — what happens when the network fails, the user makes a mistake, or the system is in a partial state. For Uncle Teck's environment (HDB basements, one-handed phone use, flaky 4G), resilience is table stakes.

---

## Sprint 0.5 — Resilience Foundation (3 days)

*"Uncle Teck operates in basements. Every mutation must survive flaky connectivity."*

### 0.1 Form state persistence

- [x] Save draft to `localStorage` on every keystroke for invoice creation, client creation, and onboarding wizard. Restore on page reload. (Implemented via `useFormDraft` hook across all three forms)
- **Files:** `apps/web/app/dashboard/invoices/new/page.tsx`, `apps/web/app/dashboard/clients/add/page.tsx`, `apps/web/app/dashboard/onboarding/page.tsx`
- **Why:** Data loss is the #1 trust killer. Uncle Teck fills an invoice in a basement, phone drops — everything gone.
- **Skills:** `/react-best-practices` `/frontend-developer`

### 0.2 Mutation retry config

- [x] Set TanStack Query `retry: 2` with exponential backoff for all mutations. Add network-error-specific toast: "Saved locally, will retry when online." (Configured in Providers.tsx QueryClient)
- **Files:** `apps/web/src/components/Providers.tsx` (QueryClient config)
- **Why:** Every failed mutation is currently a dead end with a generic "Something went wrong" toast.
- **Skills:** `/react-best-practices` `/error-handling-patterns`

### 0.3 Defensive createContext

- [x] Wrap `supabase.auth.getUser()` in try-catch mirroring middleware pattern. Return anonymous context on Supabase failure instead of 500. (Implemented in trpc.ts createContext)
- **Files:** `packages/api/src/trpc.ts:45`
- **Why:** Any Supabase blip currently kills all tRPC calls with unhandled 500 errors.
- **Skills:** `/backend-dev-guidelines` `/trpc-fullstack`

### 0.4 Session refresh on tRPC calls

- [x] Add token refresh in tRPC context or client-side interceptor so JWT doesn't expire during long form fills (default 1hr expiry). (Implemented in Providers.tsx httpBatchLink headers — refreshes session before each tRPC batch)
- **Files:** `packages/api/src/trpc.ts`, `apps/web/src/components/Providers.tsx`
- **Why:** Uncle Teck fills forms slowly; JWT expires, next tRPC call redirects to `/login` with all form data lost.
- **Skills:** `/nextjs-supabase-auth` `/auth-implementation-patterns`

---

## Sprint 1 — Payment Integrity + Compliance (Week 1)

### 1.1 P2 — DB migration (RUN FIRST)

- [x] Make legacy columns (`price_sgd`, `scheduled_at`) nullable. Align constraints with canonical `price_cents` / `scheduled_date`. Include pre-migration backup step and rollback migration. Wrap CHECK constraints in DO blocks with exception handling. (Done in migration 003)
- **Files:** `packages/db/migrations/` (new migration file)
- **Why:** Both reviewers confirmed — code fixes will fail against unmigrated production DB. Migration ordering fragility if CHECK constraint left without a guard.
- **Skills:** `/database-migration` `/postgresql`

### 1.2 P5 — Fix payment split math + QR payments row

- [x] Remove legacy deposit deduction in `confirmQrPayment` when no matching balance. Record full invoice amount as `bank_transfer`. Align `payment_method` with DB constraint `paynow_qr`.
- [x] Insert `payments` table row in `confirmQrPayment` (currently writes only to `till_entries`, making manual QR confirmations invisible to reconciliation).
- **Files:** `packages/api/src/routers/cash.ts:457-527`
- **Why:** Manual QR confirmations have no `payments` record. Any reconciliation report joining `payments` to `invoices` undercounts QR revenue.
- **Skills:** `/backend-development-feature-development` `/payment-integration`

### 1.3 Cash payment confirmation dialog

- [x] Add "You are about to record $XX.XX cash collected — are you sure?" confirmation before `confirmCashPayment` fires. (Already implemented via DigitalHandshakeModal)
- **Files:** Client-side payment confirmation UI component
- **Why:** No undo mechanism exists. Fat-finger on a $500 payment is irreversible. Uncle Teck needs a speed bump.
- **Skills:** `/ui-ux-pro-max` `/react-best-practices`

### 1.4 Cash payment void mechanism

- [x] Add `voidCashPayment` mutation with `void_reason` field. Reverse corresponding till entry. Update invoice status back to `pending`. Add `voided_at`, `voided_by`, `void_reason` columns to `cash_payments`.
- **Files:** `packages/api/src/routers/cash.ts`, `packages/db/migrations/` (new migration)
- **Why:** Both reviewers: without void, correct math just correctly records irreversible mistakes. Also needed for IRAS — voided invoice numbers must be retained with explanation.
- **Skills:** `/backend-development-feature-development` `/database-migration`

### 1.5 PDPA consent gate

- [x] Add one-time PDPA acknowledgment checkbox before first client creation. Store `pdpa_consent_at TIMESTAMPTZ` on `profiles`. Add privacy policy link in onboarding flow.
- **Files:** `apps/web/app/dashboard/clients/add/page.tsx`, `packages/db/migrations/` (new migration)
- **Why:** Legal requirement under PDPA. Uncle Teck is a data intermediary when storing client name, phone, address. Not deferrable.
- **Skills:** `/privacy-by-design` `/gdpr-data-handling`

### 1.6 Fix "Tax Invoice" label

- [x] Show "Tax Invoice" only when provider is `acra_verified && gst_registered`. Add `gst_registered BOOLEAN DEFAULT FALSE` to `profiles`. Default PDF label: "Invoice".
- **Files:** `packages/api/src/services/pdf.ts:377`, `packages/db/migrations/` (new migration)
- **Why:** IRAS requires only GST-registered entities to use "Tax Invoice" label. Current code always shows "Tax Invoice" when `taxCents > 0`.
- **Skills:** `/backend-development-feature-development` `/pdf-official`

### 1.7 E.164 phone validation

- [x] Validate `+65` prefix on client phone at creation time. Auto-prepend if 8-digit local number entered. Add CHECK constraint or server-side validation in client creation tRPC mutation.
- **Files:** Client creation tRPC mutation in `packages/api/src/routers/clients.ts`
- **Why:** WhatsApp `wa.me` links break without country code. Uncle Teck will enter "91234567" not "+6591234567".
- **Skills:** `/backend-dev-guidelines` `/zod-validation-expert`

### 1.8 NETS webhook secret runtime guard

- [x] Replace non-null assertion (`!`) on `NETS_WEBHOOK_SECRET` with runtime guard matching `escrow.ts` pattern.
- **Files:** `apps/web/app/api/webhooks/paynow/route.ts:24`
- **Why:** Missing env var silently returns `false` from `validateHmac` but TypeScript hides the issue.
- **Skills:** `/backend-security-coder` `/error-handling-patterns`

---

## Sprint 2 — First-Time User Journey + Data Integrity (Week 2)

### 2.1 P1 — "Add first service" flow

- [x] Update `OnboardingChecklist.tsx` with example screen showing a filled-out service form. Add explicit "Create your first service" CTA pointing to `/dashboard/services?action=new`. Add pulse/glow on Services page CTA. (Already implemented via OnboardingChecklist deep links + services page pulse animation)
- **Files:** `apps/web/src/components/onboarding/OnboardingChecklist.tsx`, `apps/web/app/dashboard/services/page.tsx`
- **Why:** Without this, empty dashboard = immediate churn. Uncle Teck finishes the tour and sees nothing to do.
- **Skills:** `/ui-ux-pro-max` `/react-best-practices`

### 2.2 O2 — Post-tour activation checklist

- [x] Build persistent glass card on dashboard with 3 deep links: first client, first service, PayNow preview. Track completion state in `profiles.onboarding_checklist` JSONB with **Zod-validated shape** on tRPC mutation input. Collapse to "What's next?" hub when all 3 done. (Already implemented in OnboardingChecklist.tsx with server-side auto-marking)
- **Files:** `apps/web/app/dashboard/page.tsx` (new component), tRPC mutation for checklist updates
- **Why:** Bridges the tour → activation gap. Validates JSONB writes to prevent `{"step_2": "banana"}` corruption.
- **Skills:** `/ui-ux-pro-max` `/react-best-practices` `/zod-validation-expert`

### 2.3 O3 — Cross-device tutorial persistence

- [x] Read `tutorial_completed_at` from profile to gate tutorial on new devices (currently only reads localStorage `tutorial-seen-v1` flag). Write `tutorial_completed_at` on completion. Keep localStorage as same-device fast path. (Already implemented in useTutorialGate.ts with hybrid localStorage + server gating)
- **Files:** `apps/web/app/dashboard/onboarding/page.tsx`, tutorial component
- **Why:** Phone switch replays onboarding because server says "completed" but client-side gate sees no localStorage flag.
- **Skills:** `/nextjs-supabase-auth` `/react-best-practices`

### 2.4 Onboarding step resumption

- [x] Persist completed wizard steps to `onboarding_checklist` JSONB so phone-death mid-wizard resumes at the correct step instead of step 1.
- **Files:** `apps/web/app/dashboard/onboarding/page.tsx`
- **Why:** Current wizard holds all state in React `useState`. Phone dies at step 3 of 4 = everything gone, restart from step 1.
- **Skills:** `/react-best-practices` `/frontend-developer`

### 2.5 Reconciliation cron

- [x] Build daily cron job detecting split states: `cash_payments` without matching `invoices.status = 'paid_cash'`, `escrow_releases` stuck in `'processing'`, `till_entries` without matching payment. Log alerts to Sentry.
- **Files:** New Supabase Edge Function or `pg_cron` SQL
- **Why:** Catches partial-write failures from `confirmCashPayment` multi-step writes. Surfaces stuck escrow releases (claimed retry job does not exist).
- **Skills:** `/supabase-automation` `/observability-monitoring-monitor-setup`

### 2.6 Session timeout warning

- [x] Add "Your session is about to expire" warning 5 minutes before JWT expiry. Offer silent refresh or re-login. Prevent silent redirect that destroys form data.
- **Files:** `apps/web/src/components/Providers.tsx`, new session monitor component
- **Why:** Uncle Teck on one page for an hour → next tRPC call fails → bounced to login with data loss.
- **Skills:** `/nextjs-supabase-auth` `/ui-ux-pro-max`

---

## Sprint 3 — Mobile Polish + i18n (Week 3)

### 3.1 P4 — Fix persistent bottom nav

- [x] Make `MobileNav.tsx` fixed to bottom. Reserve bottom padding in dashboard layout. Keep nav height consistent across pages. (Already implemented: MobileNav has `fixed bottom-0 z-50`, layout has `pb-[calc(4rem+env(safe-area-inset-bottom))]`)
- **Files:** `apps/web/src/components/MobileNav.tsx` (or equivalent), dashboard layout
- **Why:** Nav disappearing behind viewport edge = "app is broken" perception.
- **Skills:** `/ui-ux-pro-max` `/react-best-practices`

### 3.2 P3 — Onboarding responsiveness

- [x] Apply `max-w-[90vw]`, `overflow-y-auto`, safe-area padding to onboarding popups. Test on iPhone SE dimensions. (Already implemented: OnboardingChecklist has `max-w-[90vw] max-h-[80vh] overflow-y-auto`, TutorialOverlay uses `calc(100vw - 32px)` + safe-area insets)
- **Files:** Onboarding popover/modal components
- **Why:** Clipped popups on smaller iPhones make onboarding unusable for Uncle Teck.
- **Skills:** `/ui-ux-pro-max` `/fixing-accessibility`

### 3.3 O1 — Mandarin i18n (zh-Hans-SG)

- [x] Translate onboarding wizard (4 screens), dashboard empty states, bottom nav labels (~50 string keys) into Simplified Chinese. (Already translated in zh-Hans-SG.json; added 3 missing tutorial keys: setupPayment, profileButton, editProfile)
- [x] Fix `useChangeLocale` race condition: `await` profile write completion **before** `window.location.reload()`. (Already fixed: LocalePicker `commit()` awaits `setPreferredLocale.mutateAsync()` before calling `change()`)
- **Files:** `apps/web/messages/zh-Hans-SG.json`, `apps/web/src/i18n/useChangeLocale.ts`
- **Why:** 40%+ of ICP prefers Mandarin. Locale dual-write race means Mandarin users revert to English on new device.
- **Skills:** `/i18n-localization` `/react-best-practices`

### 3.4 Fix `addDays` UTC bug

- [x] Replace UTC-based `addDays` with SGT-aware date arithmetic for `next_service_date`. Extract shared helper from duplicated implementations in `cash.ts` and webhook handler.
- **Files:** `packages/api/src/routers/cash.ts:534`, `apps/web/app/api/webhooks/paynow/route.ts:203`
- **Why:** For a payment at 11:30 PM SGT (15:30 UTC), `addDays(now, 90)` lands on the wrong date. Duplicated helper invites drift.
- **Skills:** `/backend-dev-guidelines` `/typescript-pro`

### 3.5 Clean up stale push subscriptions

- [x] On login, deactivate any `push_subscriptions` with mismatched endpoint for the current user. Remove orphaned subscriptions.
- **Files:** `apps/web/src/components/PushNotificationRegistrar.tsx`
- **Why:** Phone switch leaves old subscription active → wasted VAPID sends, potential confusion on old device.
- **Skills:** `/progressive-web-app` `/backend-dev-guidelines`

### 3.6 Service worker cache-bust prompt

- [x] On service worker update detection, show "New version available — tap to refresh" banner instead of serving stale cached code.
- **Files:** `apps/web/public/sw.js`, `apps/web/src/components/Providers.tsx`
- **Why:** Uncle Teck doesn't close browser tabs for days. Stale SW cache after deployment serves old payment form code against new API endpoints.
- **Skills:** `/progressive-web-app` `/ui-ux-pro-max`

---

## Deferred — Post-MVP / Beta Feedback Driven

| Item | Reason to Defer | Revisit When |
|------|----------------|--------------|
| S1 — Contact importing | No impact on activation metric | After 10+ active users |
| S2 — WhatsApp API automation | `wa.me` links work for beta | After activation rate stabilizes |
| S3 — Calendar sync (iCal) | Nice-to-have | After schedule flow is battle-tested |
| S4 — Service request management | Depends on booking acceptance flow | After booking flow stable |
| S5 — Visual polish | Polish after core works | After Sprint 3 |
| S6 — Map integration | Performance review needed | After booking/schedule stable |
| O4 — Concierge playbook | Operational doc, not code | Write during beta calls |
| O6 — Tutorial videos | Need real friction data first | After 2 weeks of beta calls |
| Transaction wrapping (`confirmCashPayment`) | Reconciliation cron mitigates for now | When payment volume > 50/day |
| Amount column aliasing (`amount` vs `total_cents`) | Maintenance issue, not user-facing | Next schema cleanup |
| RLS audit on admin client (`escrow.ts`) | Admin bypass tracked as debt | Pre-production security sweep |
| P7 — Client profile history | Display-only enhancement | After activation checklist ships |
| Malay / Tamil i18n (`ms-SG`, `ta-SG`) | Smaller ICP segments | After Mandarin validated |

---

## Risk Register

| Risk | Mitigation | Sprint |
|------|-----------|--------|
| Partial-write split state in `confirmCashPayment` | Reconciliation cron + future transaction wrapping | S2 / debt |
| Escrow release fire-and-forget with no retry | Reconciliation cron detects stuck releases → Sentry alert | S2 |
| `onboarding_checklist` JSONB has no schema validation | Zod schema on tRPC mutation input | S2 |
| Old-device push subscriptions remain active | Stale subscription cleanup on login | S3 |
| `NETS_WEBHOOK_SECRET` non-null assertion | Add runtime guard matching `escrow.ts` pattern | S1 |
| Locale dual-write race condition | Await profile write before reload | S3 |
| No cash payment reversal after fat-finger | Void mechanism with reason tracking | S1 |
| Silent session timeout destroys form data | Session expiry warning + refresh | S2 |

---

## Key Architectural Decisions

1. **Migration before code fix** — both reviewers confirmed: deploy DB migration first or code hits constraint errors in production.
2. **Resilience over features** — offline protection, mutation retry, and session refresh moved to Sprint 0.5 because Uncle Teck's environment makes network failures the norm, not the exception.
3. **Mandarin stays Sprint 3** — the i18n infrastructure already exists; Sprint 3 is a content task (~50 string keys) not a rewrite. The race condition fix is the real code work.
4. **Cash void over cash perfection** — without undo, even perfect math records irreversible mistakes. Void mechanism is Sprint 1 alongside the math fix.
5. **PDPA + IRAS in Sprint 1** — legal compliance is not deferrable. Both are small code changes with large regulatory risk if missed.

---

## Skill Quick Reference

| Skill | Used In Tasks |
|-------|---------------|
| `/react-best-practices` | 0.1, 0.2, 1.3, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3 |
| `/ui-ux-pro-max` | 1.3, 2.1, 2.2, 2.6, 3.1, 3.2, 3.6 |
| `/backend-dev-guidelines` | 0.3, 1.7, 3.4, 3.5 |
| `/backend-development-feature-development` | 1.2, 1.4, 1.6 |
| `/database-migration` | 1.1, 1.4, 1.5, 1.6 |
| `/nextjs-supabase-auth` | 0.4, 2.3, 2.6 |
| `/payment-integration` | 1.2 |
| `/zod-validation-expert` | 1.7, 2.2 |
| `/trpc-fullstack` | 0.3 |
| `/error-handling-patterns` | 0.2, 1.8 |
| `/postgresql` | 1.1 |
| `/privacy-by-design` | 1.5 |
| `/i18n-localization` | 3.3 |
| `/progressive-web-app` | 3.5, 3.6 |
| `/supabase-automation` | 2.5 |
| `/observability-monitoring-monitor-setup` | 2.5 |
| `/fixing-accessibility` | 3.2 |
| `/backend-security-coder` | 1.8 |
| `/frontend-developer` | 0.1, 2.4 |
| `/typescript-pro` | 3.4 |
| `/pdf-official` | 1.6 |
| `/gdpr-data-handling` | 1.5 |
| `/auth-implementation-patterns` | 0.4 |
