# ServiceSync v2 - Suggestions & Problems Backlog

This backlog is ordered for beta readiness.

Start with the onboarding gaps from `docs/masterplan_onboarding_plan.md`, then clear the core product bugs, then tackle the lower-priority suggestions.

---

## Source of truth

- `docs/masterplan.md`
- `docs/masterplan_onboarding_plan.md`
- `docs/onboarding-tutorial/*`
- `docs/DESIGN_SYSTEM.md`
- `audit-tracker.md`

---

## Current engineering handoff (2026-04-17)

Use this as the shortest high-context status block for the current lint/test cleanup pass.

### Done

- `apps/web` lint was reduced from `87 warnings + 1 error` to `24 warnings + 0 errors` on the last verified run.
- Playwright host dependency issue was partially neutralized without `sudo`.
- Local runtime wrapper now bootstraps missing host libs and runs Playwright through `scripts/playwright-runtime.sh`.
- Local mobile project now defaults to `chromium` iPhone emulation; CI can still use WebKit.
- Generated Supabase server folders are now ignored in web lint.
- Web image host config now allows `ui-avatars.com`.

### Files already changed

- `playwright.config.ts`
- `package.json`
- `scripts/playwright-runtime.sh`
- `apps/web/eslint.config.mjs`
- `apps/web/next.config.mjs`
- `apps/web/app/dashboard/services/page.tsx`
- `apps/web/app/dashboard/page.tsx`
- `apps/web/app/dashboard/retention/page.tsx`
- `apps/web/src/components/PwaInstallPrompt.tsx`
- `apps/web/src/components/Providers.tsx`
- `apps/web/src/components/onboarding/OnboardingChecklist.tsx`
- `apps/web/src/components/ui/ios-picker.tsx`
- `apps/web/src/lib/analytics.ts`
- `apps/web/src/lib/maps.ts`
- `apps/web/src/components/ui/cube-loader.tsx`
- `apps/web/src/lib/router.tsx`
- `apps/web/app/dashboard/schedule/add/page.tsx`
- `apps/web/app/dashboard/clients/page.tsx`
- `apps/web/app/dashboard/schedule/page.tsx`
- `apps/web/src/components/DigitalHandshakeModal.tsx`
- `apps/web/src/components/figma/ImageWithFallback.tsx`
- `apps/web/app/p/[providerId]/page.tsx`

### Remaining lint warnings (24 total on last verified run)

- `apps/web/app/api/webhooks/paynow/route.ts` -> 2
- `apps/web/app/dashboard/clients/details/page.tsx` -> 3
- `apps/web/app/dashboard/invoices/[invoiceId]/page.tsx` -> 5
- `apps/web/app/dashboard/invoices/new/page.tsx` -> 6
- `apps/web/app/dashboard/invoices/page.tsx` -> 2
- `apps/web/app/dashboard/onboarding/page.tsx` -> 1
- `apps/web/app/dashboard/requests/page.tsx` -> 2
- `apps/web/app/p/[providerId]/book/page.tsx` -> 2
- `apps/web/app/update-password/page.tsx` -> 1

### Known blocker

- `npx playwright install-deps` still requires `sudo` in this environment and cannot complete normally.
- Chromium launch was proven to work locally by composing `LD_LIBRARY_PATH` from Playwright's Firefox bundle plus a locally extracted `libasound2t64`.
- WebKit host deps are still much heavier; local workaround intentionally avoids depending on WebKit for the mobile project.

### Next exact steps

1. Patch the 9 remaining `apps/web` files above in small batches.
2. Re-run `npm run lint --workspace=@servicesync/web`.
3. Run `npm test` through the wrapper.
4. If tests fail, treat the next failures as app/test issues, not host-lib setup, unless launch errors reappear.
5. Optional final confidence check after green tests: `npm run build`.

### Patch plan for the remaining files

- Replace residual `any` casts with local interfaces or inferred row types.
- Remove unused imports in invoice/book/update-password pages.
- Replace the QR preview `<img>` in `invoices/new` with `next/image`.
- Keep the onboarding page fix minimal: change the remaining `catch (err: any)` to `unknown` + safe message extraction.

### Failed attempt to be aware of

- One multi-file `apply_patch` failed because the hunk for `apps/web/app/dashboard/onboarding/page.tsx` did not match exactly.
- That failed patch was not applied, so the remaining warning counts above are still the correct handoff baseline.

### Status: Complete (2026-04-17)

Lint/type cleanup task finished. Verified end-state:

- `apps/web` lint: **24 warnings -> 0 warnings, 0 errors** (`../../node_modules/.bin/eslint .` exits 0).
- `apps/web` typecheck: **clean** (`tsc --noEmit` exits 0).
- All 9 files in the "Remaining lint warnings" list above are patched.

Files patched in this pass:

- `apps/web/app/update-password/page.tsx` - removed unused `ShieldCheck` import.
- `apps/web/app/dashboard/onboarding/page.tsx` - `catch (err: any)` -> `catch (err: unknown)` with safe message extraction.
- `apps/web/app/api/webhooks/paynow/route.ts` - replaced `(invoice as any).clients/.bookings` with a local `InvoiceJoins` interface.
- `apps/web/app/dashboard/invoices/page.tsx` - removed `: any` from map callback and replaced `setFilter(f as any)` with `setFilter(f as typeof filter)`; typed the Supabase `clients` join via a local `unknown`-bridged cast.
- `apps/web/app/dashboard/requests/page.tsx` - removed `: any` from both setData and map callbacks so tRPC inference supplies the types.
- `apps/web/app/p/[providerId]/book/page.tsx` - removed unused `Info, ShieldAlert` icons.
- `apps/web/app/dashboard/clients/details/page.tsx` - replaced `(client.invoices as any[])` and `(bookings as any[])` with inline `Array<{...}>` type assertions.
- `apps/web/app/dashboard/invoices/[invoiceId]/page.tsx` - removed unused `Input`, typed the line-items `map` parameter, and introduced a local `invoiceMeta` cast for the Supabase `clients`/`pdf_url` joins.
- `apps/web/app/dashboard/invoices/new/page.tsx` - removed `useCallback`, replaced `<img>` with `next/image` (`unoptimized`), widened `catch (err: any)` to `unknown`, and typed the `getById.setData` callback via `RouterOutputs["invoices"]["getById"]`.

Notes for the next engineer:

- Build (`next build`) on the current Windows dev host fails on a platform-specific `@parcel/watcher-win32-x64` install issue. That is unrelated to the lint pass and reproduces on `main` without our edits; leave it for the CI environment or a Linux/WSL shell.
- The playwright test wrapper (`scripts/playwright-runtime.sh`) still assumes a Linux host (`apt download`, `dpkg-deb`), so `npm test` was not re-run on this Windows machine. CI remains the source of truth for runtime tests.
- When the tRPC `setData` updater cannot infer its callback parameter (observed on `invoices.getById.setData`), import `RouterOutputs` from `@/lib/api` and annotate explicitly rather than reintroducing `any`.

---

## Phase 0: Beta onboarding blockers

These items block the first-time user journey and should be handled before the broader suggestion list.

### O1. Language selection system

Problem: The onboarding plan requires a first-class locale choice, but the current flow is still effectively English-first.

Proposed fix:
1. Add a visible locale picker on landing, signup, and onboarding.
2. Persist the preference in `profiles.preferred_locale`.
3. Keep `localStorage` as a cache only, not the source of truth.

### O2. Post-tour activation checklist

Problem: The tutorial ends, but the user can still land on an empty dashboard with no next step.

Proposed fix:
1. Add a persistent dashboard card with three deep links: first service, first client, PayNow preview.
2. Track completion in `profiles.onboarding_checklist_jsonb`.
3. Collapse the card into a lighter "What's next?" hub once all three actions are done.

### O3. Cross-device tutorial persistence

Problem: Tour completion is currently device-local, so reinstalling or switching phones can replay onboarding and damage trust.

Proposed fix:
1. Store `tutorial_completed_at` on the profile when the tour is fully completed.
2. Keep `localStorage` for same-device fast path.
3. Treat skips as device-local only, so users can still re-open the tour later if needed.

### O4. Concierge onboarding playbook

Problem: The masterplan calls for a human-assisted onboarding script, but the operational flow needs to be explicit and repeatable.

Proposed fix:
1. Keep the playbook as the facilitator script for install -> login -> setup -> first client -> first invoice.
2. Use it to capture drop-off reasons during calls.
3. Escalate product defects separately from user education issues.

### O5. Tutorial content and help surface

Problem: The tutorial spec is strong, but the content, illustrations, motion, and replay path need to stay aligned with the onboarding plan.

Proposed fix:
1. Keep the 7-step tutorial content in sync with `docs/onboarding-tutorial/content.md`.
2. Make sure the replay path is available from profile settings.
3. Validate reduced-motion, responsive, and accessibility behavior before release.

### O6. Tutorial videos

Problem: The masterplan requires short, local-language tutorial videos, but there is no user-facing help surface for them yet.

Proposed fix:
1. Add a help area for the three videos.
2. Host the final videos in a way that works for both public sharing and app support.
3. Base the video topics on real friction from beta calls, not guesses.

---

## Phase 1: Critical problems

### P1. "Add your first service" flow and link

Problem: The current flow is not obvious enough for a first-time user, and the existing link is broken or too indirect.

Proposed fix:
1. Update `OnboardingChecklist.tsx` to include an example screen that shows a filled-out service form.
2. Add a prompt that explicitly says "Create your first service".
3. Send the CTA to `/dashboard/services?action=new`.
4. Add a gentle pulse/glow on the Services page CTA so it is easy to find.

### P2. Database constraint violations

Problem: `price_sgd` and `scheduled_at` are still treated as required in the database, but the code path now uses the newer canonical fields.

Proposed fix:
1. Add a migration that aligns the schema with the code.
2. Make the legacy columns nullable where needed.
3. Keep the canonical `price_cents` and `scheduled_date` fields as the real source of truth.

### P3. Onboarding checklist responsiveness

Problem: The onboarding popups can be clipped on mobile, especially on smaller iPhone screens.

Proposed fix:
1. Use `max-w-[90vw]`.
2. Add `overflow-y-auto`.
3. Respect safe-area padding so the controls stay reachable.

### P4. Persistent bottom navigation

Problem: The bottom nav can move with content or disappear behind the viewport edge.

Proposed fix:
1. Make `MobileNav.tsx` fixed to the bottom.
2. Reserve enough bottom padding in the dashboard layout.
3. Keep the nav height consistent across pages.

### P5. Financial split math error

Problem: QR payment handling can split the amount incorrectly and can still try to apply legacy deductions that should no longer exist.

Proposed fix:
1. Update `confirmQrPayment` in `packages/api/src/routers/cash.ts`.
2. Remove legacy deposit deduction logic when there is no matching legacy balance.
3. Record the full invoice amount as `bank_transfer` in `till_entries`.
4. Keep `payment_method` aligned with the database constraint (`paynow_qr`).

#### P7. Client Profile History Missing
*   **Problem**: No transaction/job history visible in client profile details.
*   **Proposed Fix**:
    1.  Update `packages/api/src/routers/clients.ts` -> `getById` to fetch both `bookings` and `invoices` for the client.
    2.  Ensure display logic in `apps/web/app/dashboard/clients/details/page.tsx` correctly handles data from both sources.


---

## Phase 2: Planned suggestions

### S1. Contact importing

Spec: Use the browser Contact Picker API.

Guardrail: Show a clear consent modal before any import is stored.

### S2. WhatsApp invoice automation

Spec: Prefer `wa.me` templated links first.

Guardrail: Keep the flow simple and avoid pretending the product sends messages directly through WhatsApp API unless it really does.

### S3. Calendar sync

Spec: Generate an iCal feed that users can add to Google or Apple Calendar.

Guardrail: Mark external events clearly so the internal scheduler does not try to manage them.

### S4. Service request management

Spec: Add a Requests tab for incoming jobs and accepted work.

Guardrail: Route optimization only makes sense after the request acceptance flow is stable.

### S5. Visual polish

Spec: Remove redundant borders and add subtle page transitions.

Guardrail: Keep the motion restrained and consistent with `docs/DESIGN_SYSTEM.md`.

### S6. Map integration

Spec: Revisit the map implementation if performance or consistency becomes a real issue.

Guardrail: Only swap the map layer after the booking and schedule flows are stable.

---

## Summary of next actions

1. Lock the onboarding blockers first: locale, checklist, tutorial persistence, playbook, and videos.
2. Fix the core product bugs that affect service creation, payments, mobile nav, and client history.
3. Treat the remaining suggestions as post-beta improvements unless they unblock a real user journey.
