# QA Checklist

> Full QA sweep for the onboarding flow — tutorial, language picker, activation checklist, PayNow preview, Re-run Setup Wizard, and the §9 analytics taxonomy. Run the manual checklist before every release that touches any onboarding code. Automate the Playwright section.
>
> **Scope last expanded:** 2026-04-15 (P0 Task 11) — added sections §6 (LocalePicker), §7 (OnboardingChecklist), §8 (PayNowPreviewModal), §9 (Re-run Setup Wizard), §10 (Analytics taxonomy §9), and Playwright specs `08-language-switching`, `07-onboarding-checklist`, `09-paynow-preview`.

## Pre-Release Manual Checklist

### Setup

1. Sign in as a fresh technician account (or reset `localStorage.tutorial-seen-v1` on an existing account).
2. Complete the setup wizard at `/dashboard/onboarding`.
3. Land on `/dashboard`.

### Core paths

- [ ] Tour appears **~600 ms** after `/dashboard` loads.
- [ ] Step 1 shows the user's first name via `{name}` substitution (not a blank or "undefined").
- [ ] Progress indicator shows **7 pills**; first is active.
- [ ] Tapping **Next** advances to step 2; progress pill fills.
- [ ] Tapping **Back** on step 3 returns to step 2; progress pill rewinds.
- [ ] Swiping left advances; swiping right goes back.
- [ ] Tapping **Skip** closes the tour and sets `localStorage.tutorial-seen-v1 === 'true'`.
- [ ] Pressing **Escape** closes the tour (same as Skip).
- [ ] Reloading after dismissal does **not** re-show the tour.
- [ ] On step 7, the button reads **Start** (not Next).
- [ ] Tapping **Start** closes the tour and the coachmark appears on the Home icon.
- [ ] Coachmark pulses **twice** and auto-dismisses within ~3 s.
- [ ] Tapping anywhere during the coachmark dismisses it immediately.

### Auto-advance

- [ ] Step 1 auto-advances after ~15 s if the user does nothing.
- [ ] Step 6 dwells for ~20 s (longer than other steps).
- [ ] Step 7 does **not** auto-advance — it waits for the user to tap Start.
- [ ] Switching to another browser tab pauses the auto-advance timer.
- [ ] Returning to the tab resumes the timer without jumping forward.

### Reduced motion

1. Enable OS "Reduce motion" (macOS: System Settings → Accessibility → Display; iOS: Settings → Accessibility → Motion).
2. Trigger the tour.

- [ ] Modal fades in only (no scale).
- [ ] Slides crossfade (no horizontal motion).
- [ ] Auto-advance is **disabled** — user must tap Next.
- [ ] Coachmark is **skipped** entirely.
- [ ] Buttons don't scale on press.

### Responsive

- [ ] Test at **375 px** (iPhone SE): no horizontal scroll, illustration fits, controls not clipped.
- [ ] Test at **390 px** (iPhone 14): same.
- [ ] Test at **768 px** (iPad portrait): modal is centred with `max-w-md`; backdrop blurs the rest.
- [ ] Test at **≥ 1024 px** (desktop): tour does **not** render.
- [ ] Safe-area insets respected on notched devices (no content under the notch or home indicator).

### Accessibility

- [ ] Tab cycles focus within the modal; doesn't escape to the page behind.
- [ ] Initial focus lands on **Skip**.
- [ ] Every icon-only button has a visible `aria-label` when inspected.
- [ ] Progress indicator has `role="progressbar"` and `aria-valuenow` updates per step.
- [ ] Screen reader (VoiceOver / TalkBack) announces step title + body when each step becomes active.
- [ ] Body text passes WCAG AA (4.5:1) on the glass backdrop.

### Analytics

Watch the network tab for `trackEvent` calls. Expect:

- [ ] `tutorial_started` fires once on overlay open.
- [ ] `tutorial_step_viewed` fires once per step (with `step: 1..7`).
- [ ] `tutorial_completed` fires when Start is tapped.
- [ ] `tutorial_skipped` fires when Skip / Escape is triggered, with the current step index.
- [ ] Events do **not** double-fire on re-renders.

### Edge cases

- [ ] Landing on `/dashboard/schedule` directly from a push notification does **not** trigger the tour.
- [ ] User signs out mid-tour → overlay closes, `tutorial-seen-v1` is **not** set.
- [ ] Private browsing mode (Safari): tour still works, but re-appears next session — expected degraded mode.
- [ ] Two browser tabs open; dismiss in tab A → tab B still shows until next navigation; no errors.
- [ ] Network offline during the tour: no errors, analytics events queue silently.

---

## Playwright — `tests/e2e/tutorial.spec.ts`

```ts
import { test, expect } from '@playwright/test';

test.describe('Onboarding tutorial', () => {
  test.beforeEach(async ({ page, context }) => {
    // Seed a completed-setup profile, clear tutorial key
    await context.addInitScript(() => {
      localStorage.removeItem('tutorial-seen-v1');
    });
  });

  test('appears ~600ms after dashboard mount for fresh users', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByTestId('tutorial-overlay')).toBeVisible({ timeout: 2000 });
    await expect(page.getByTestId('tutorial-step-welcome')).toBeVisible();
  });

  test('Skip sets localStorage and does not re-appear', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByTestId('tutorial-skip').click();
    await expect(page.getByTestId('tutorial-overlay')).toBeHidden();
    const seen = await page.evaluate(() => localStorage.getItem('tutorial-seen-v1'));
    expect(seen).toBe('true');
    await page.reload();
    await expect(page.getByTestId('tutorial-overlay')).toBeHidden({ timeout: 2000 });
  });

  test('advances through all 7 steps and shows coachmark on completion', async ({ page }) => {
    await page.goto('/dashboard');
    for (let i = 0; i < 6; i++) {
      await page.getByTestId('tutorial-next').click();
    }
    await expect(page.getByTestId('tutorial-step-ready')).toBeVisible();
    await page.getByTestId('tutorial-next').click(); // "Start"
    await expect(page.getByTestId('tutorial-overlay')).toBeHidden();
    await expect(page.getByTestId('tutorial-coachmark')).toBeVisible();
  });

  test('does not render on desktop viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/dashboard');
    await expect(page.getByTestId('tutorial-overlay')).toBeHidden({ timeout: 2000 });
  });

  test('Escape key closes the tour', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByTestId('tutorial-overlay')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('tutorial-overlay')).toBeHidden();
  });
});
```

Place alongside `tests/e2e/03-dashboard.spec.ts`.

---

## Visual Regression

If the project uses Chromatic / Percy / Playwright screenshots, add snapshots for:

- Tutorial step 1 (welcome — verifies name interpolation and stagger entry settled)
- Tutorial step 6 stage C (PayNow bank icon with check — the headline visual)
- Tutorial step 7 (ready — Start button + glow)
- Coachmark active state

Take snapshots **after** entry animations complete — use `await page.waitForTimeout(400)` after the step is visible.

---

## Performance Budget

- Overlay mount → first paint: **< 120 ms** on a mid-tier Android (Moto G Power).
- Slide transition jank: **0 dropped frames** on `spring.settle` at 60 Hz.
- Bundle size increase: tutorial folder should add **< 25 KB gzipped** (check via `npm run build` + bundle analyzer).
- No new network requests — all assets inline.

---

## 6. Language Picker (`LocalePicker`)

### Manual — chip variant (landing / signup)

1. Visit `/` (landing) with no `NEXT_LOCALE` cookie set.

- [ ] Chip shows current locale's **native** label (e.g. 中文, Bahasa, தமிழ்) — not the English label.
- [ ] Tapping the chip opens a listbox with **all 4 locales**, ordered as `en-SG`, `zh-Hans-SG`, `ms-SG`, `ta-SG`.
- [ ] Each option shows the native name on top + English label below (when they differ).
- [ ] Tapping a locale dismisses the listbox, updates the `NEXT_LOCALE` cookie, and triggers a hard reload.
- [ ] After reload, the landing hero renders in the new locale — **no FOUC** (English text doesn't flash before switching).
- [ ] On a logged-out session, switching locale shows **no "couldn't save" toast** (UNAUTHORIZED is silently swallowed).

### Manual — cards variant (wizard step 1, profile re-run)

1. Visit `/dashboard/onboarding` as an authenticated user.

- [ ] Four cards render in a responsive grid (`grid-cols-1 sm:grid-cols-2`).
- [ ] Each card is ≥ **72 px tall** (touch-target rule).
- [ ] Active locale has the blue ring + `aria-checked="true"`.
- [ ] Tapping an inactive card: ring moves, a spinner replaces the check icon while the DB write is in flight, then the page hard-reloads into the new locale.

### Accessibility

- [ ] Chip: `aria-haspopup="listbox"`, `aria-expanded` toggles on open.
- [ ] Listbox: `role="listbox"`, each option has `role="option"` + `aria-selected`.
- [ ] Cards: `role="radiogroup"` on the wrapper; each card has `role="radio"` + `aria-checked`.
- [ ] All interactive elements ≥ 44 × 44 px.
- [ ] Focus ring visible on keyboard tab; no outline loss in chip menu.
- [ ] Loading state announces (spinner + disabled=true on the pending option).

### Analytics (masterplan §9)

- [ ] `onboarding_language_selected` fires on every commit.
- [ ] Payload includes `locale` (e.g. `zh-Hans-SG`) and `stage` (one of `landing`/`signup`/`wizard`/`profile`).
- [ ] Default stage is `profile` when no `stage` prop is passed.
- [ ] No event fires when the user re-selects the **already-active** locale.

### Persistence

- [ ] After committing a new locale as an authenticated user, `profiles.preferred_locale` is updated in the DB.
- [ ] Clearing cookies then signing back in restores the DB locale (cookie repopulated by server).
- [ ] Signing out does not remove the cookie — anonymous sessions continue in the last-chosen locale.

---

## 7. Activation Checklist (`OnboardingChecklist`)

### Manual — first view

1. Complete the tour on a fresh account; land on `/dashboard`.

- [ ] Checklist renders below the main content as a glass card.
- [ ] Title reads "Finish setting up" / `checklist.title` in the user's locale.
- [ ] Progress pill shows **"0 of 3 done"**.
- [ ] Three rows visible, in order: **service → client → paynow**, each with the correct Lucide icon (Briefcase / Users / QrCode).
- [ ] Each row body row is ≥ **72 px** tall.
- [ ] Chevron `>` is visible on all three rows.

### Manual — deep-link flows

- [ ] Tapping **service** row navigates to `/dashboard/services/new`.
- [ ] After saving a service, returning to `/dashboard` shows the service row **ticked** (strikethrough + blue check), and progress pill reads **"1 of 3 done"**.
- [ ] Tapping **client** row navigates to `/dashboard/clients/new`.
- [ ] After saving a client, row ticks off; progress updates to **"2 of 3 done"**.
- [ ] Tapping **paynow** row opens the PayNow preview modal (§8), NOT a navigation.
- [ ] Closing the modal via **Got it** or **Close** ticks the paynow row; progress reads **"3 of 3 done"**.

### Manual — complete-state

- [ ] When all 3 are done, title changes to **"You're all set"** / `checklist.completeTitle`.
- [ ] Body copy swaps to `checklist.completeBody`.
- [ ] Rows remain visible but all ticked (muted + strikethrough).

### Manual — hide / resume

- [ ] Tapping the **X** icon in the card header hides the card and replaces it with a pill-shaped "Show setup checklist" resume CTA.
- [ ] Reloading the page: card stays hidden, resume CTA persists (DB-backed via `hiddenAt`).
- [ ] Tapping the resume CTA restores the full card with the same progress state.
- [ ] Hiding an empty checklist (0 of 3 done) is allowed.

### Manual — idempotency / replay

- [ ] Adding a **second** service does not re-trigger any animation or analytics event on the checklist.
- [ ] Deleting the only service does **not** un-tick the row (`serviceAddedAt` is latched — first-completion-wins).
- [ ] After Re-run Setup Wizard (§9), checklist resets to **"0 of 3 done"** and rehydrates to the un-hidden state.

### Accessibility

- [ ] Progress pill has `role="status"` and `aria-live="polite"`.
- [ ] Hide button has an `aria-label` ("Hide for now") and `.sr-only` fallback.
- [ ] Row buttons have `data-state="todo" | "done"` for assistive-tech styling.
- [ ] `prefers-reduced-motion`: stagger + `layout` animation are disabled, rows appear instantly.
- [ ] Keyboard tab order: title → progress → hide → row 1 → row 2 → row 3.

### Analytics (masterplan §9)

- [ ] `onboarding_checklist_item_completed` fires **exactly once** per row when its timestamp transitions from null → set.
- [ ] Payload includes `item` as one of `first_service`/`first_client`/`paynow_preview`.
- [ ] Event fires for **server-side auto-marking** (creating a service via `/dashboard/services/new` with no checklist UI open).
- [ ] Event fires for **direct-mark** (PayNow preview modal confirm).
- [ ] No duplicate fire on re-mount / re-render.
- [ ] `onboarding_checklist_dismissed` fires on hide with `items_completed: number`.
- [ ] No `onboarding_checklist_row_tapped` or `onboarding_checklist_hidden` / `_resumed` events (removed in Task 10).

---

## 8. PayNow Preview Modal (`PayNowPreviewModal`)

### Manual — visual

1. From `/dashboard`, tap the **paynow** checklist row.

- [ ] Modal slides in with a backdrop blur; body scroll is locked.
- [ ] Title: "How PayNow works" / `paynowPreview.title`.
- [ ] Subtitle: "Your client scans this QR. Money lands in your bank."
- [ ] Invoice card shows `#SAMPLE-0001` reference and **S$120.00** total.
- [ ] Blue **"SAMPLE"** badge visible top-right of the invoice card.
- [ ] White-background QR is centred, **192 × 192 px** after padding, scannable (use a phone: it should decode to the static EMVCo payload — scanner may show a PayNow phone number `+65 88888888`, expected).
- [ ] Caption below QR: "This is a demo — no money will move."
- [ ] Footer legal line visible.
- [ ] **Got it** button is primary blue, with a check icon; **Close** (X) top-right.

### Manual — interactions

- [ ] Tapping **Got it** dismisses the modal **and** ticks the paynow checklist row.
- [ ] Tapping **Close** (X) also dismisses and ticks the row (dismiss is treated the same as confirm for checklist purposes).
- [ ] Tapping **outside the card** (on the backdrop) dismisses.
- [ ] Tapping **inside the card** does NOT propagate to the backdrop (no accidental dismiss).
- [ ] Pressing **Escape** dismisses.

### Manual — replay

- [ ] After dismissing once, tapping the resume CTA → re-opening the checklist → tapping the paynow row again: the modal reopens but the row stays ticked (first-completion-wins preserves the original timestamp).

### Accessibility

- [ ] Modal has `role="dialog"` + `aria-modal="true"` + `aria-labelledby="paynow-preview-title"`.
- [ ] Initial focus lands on the **Close** button.
- [ ] Tab cycles between Close and Got it without escaping to the page behind.
- [ ] QR has `alt="Sample PayNow QR code"`.
- [ ] Loading state has `aria-label="Generating QR code"` (visible for first ~50 ms while `qrcode` resolves).
- [ ] `prefers-reduced-motion`: card enters without the scale spring; fade only.

### Analytics

- [ ] `paynow_preview_opened` fires once per modal mount (not per open-call if re-mounted within the same session — guard via `openedRef`).
- [ ] `paynow_preview_closed` fires with `reason: 'confirmed' | 'dismissed'`.
- [ ] Taxonomy event `onboarding_checklist_item_completed { item: 'paynow_preview' }` fires via checklist diff-detection after the tRPC `markChecklistItem` invalidates the query — not from the modal directly (prevents duplicates).

---

## 9. Re-run Setup Wizard

### Manual — trigger

1. Visit `/dashboard/profile` as an authenticated user with a completed wizard.

- [ ] "Re-run setup wizard" row is visible with the `profile.rerunWizardTitle` + `rerunWizardBody` copy.
- [ ] Tapping **Start over** navigates to `/dashboard/onboarding?rerun=true` (or equivalent trigger).

### Manual — idempotent reset

On wizard mount when `rerun=true`:

- [ ] Wizard opens on **step 1** (language picker) regardless of current progress.
- [ ] Existing values (name, UEN, base, fee) are **pre-filled** — user can tap Continue to keep them.
- [ ] Locale picker shows the current locale as active (blue ring / check).
- [ ] Completing the wizard again does NOT duplicate any rows in `profiles` (UPDATE, not INSERT).

### Manual — tour + checklist reset

- [ ] After re-running the wizard and tapping Finish: tour fires automatically (~600 ms), starting at step 1.
- [ ] Checklist on `/dashboard` is rehydrated to **"0 of 3 done"** — all timestamps cleared.
- [ ] `hiddenAt` is cleared — card is visible again even if previously hidden.
- [ ] Tutorial localStorage cache (`tutorial-seen-v1`) is cleared.

### Manual — audit trail

- [ ] Each step's field changes (name, UEN, preferred_locale, base_fee, service) create an `audit_events` row with actor = user, reason containing `"rerun-wizard"`.
- [ ] Server-side `markTutorialComplete.reset` and `resetOnboardingChecklist` calls are logged.

---

## 10. Analytics Taxonomy (masterplan §9)

Watch `[Analytics] Event:` console.debug lines in dev (`NODE_ENV=development`). Expect the following events in order on a full funnel walkthrough, one event per stage:

### Stage 0 — Landing

- [ ] `onboarding_landing_viewed` on landing hero mount (once per session).
- [ ] `onboarding_language_selected { locale, stage: 'landing' }` if user switches locale.

### Stage 1 — Signup

- [ ] `onboarding_signup_started { locale }` on signup form mount.
- [ ] `onboarding_signup_submitted { locale }` on submit success.
- [ ] `onboarding_language_selected { locale, stage: 'signup' }` if user switches locale here.

### Stage 2 — Verify / PWA

- [ ] `onboarding_email_verified { delay_seconds }` once the verify link lands back on the app — `delay_seconds` measured from signup submit to verify click.
- [ ] `onboarding_pwa_installed` fires if and only if the browser's `appinstalled` event fires.

### Stage 3 — Wizard

- [ ] `onboarding_wizard_started { locale }` on wizard step 1 mount.
- [ ] `onboarding_language_selected { locale, stage: 'wizard' }` if user switches on step 1.
- [ ] `onboarding_wizard_completed { locale, duration_seconds }` on Finish.

### Stage 4 — Tour (pre-existing, see §Analytics above)

- [ ] `tutorial_started`, `tutorial_step_viewed`, `tutorial_completed` / `tutorial_skipped`.

### Stage 5 — Checklist

- [ ] `onboarding_checklist_item_completed { item: 'first_service' }` when the first service is saved.
- [ ] `onboarding_checklist_item_completed { item: 'first_client' }` when the first client is saved.
- [ ] `onboarding_checklist_item_completed { item: 'paynow_preview' }` when the PayNow modal is confirmed/dismissed.
- [ ] `onboarding_checklist_dismissed { items_completed }` if the user hides the card.

### Stage 6 — Activation

- [ ] `onboarding_first_invoice_sent { amount_cents, currency: 'SGD' }` on first successful invoice send.
- [ ] `onboarding_first_booking_received { source: 'public_link' | 'manual' }` on first booking.

### Type-safety sanity check

- [ ] Grep for `trackEvent(` across `apps/web/src/**` — all onboarding-funnel call sites route through `trackOnboardingEvent()` from `lib/analytics-events.ts` (typed). Diagnostic events (`tutorial_*`, `paynow_preview_*`) may still use the raw `trackEvent()` stub.
- [ ] Adding a new event to the taxonomy without updating the discriminated union fails `tsc`.

---

## Playwright — `tests/e2e/07-onboarding-checklist.spec.ts`, `08-language-switching.spec.ts`, `09-paynow-preview.spec.ts`

Auth-gated specs follow the same pattern as `02-onboarding.spec.ts` / `03-dashboard.spec.ts`: the unauthenticated smoke check is enabled; the positive-path tests are `.skip()` with a TODO pointing at `tests/e2e/fixtures/auth.ts`. Enable them once a Supabase test project is wired.

See the three spec files for details.

---

## Sign-Off

Full onboarding flow is ready to ship when:

1. All manual checklist items above (§tutorial + §6–§10) are checked on a physical iPhone + a mid-tier Android.
2. All Playwright tests in `tests/e2e/0{2,3,7,8,9}-*.spec.ts` pass in CI — including the `.skip()` ones once the auth fixture is live.
3. Analytics events verified in the staging dashboard; event volume on the beta cohort matches expected funnel shape (see §4.4).
4. Visual regression snapshots approved for the tour (existing) + PayNow modal + checklist default/complete states.
5. Product + Marketing have reviewed `content.md` + all i18n files and signed off on copy.
6. Concierge playbook (`concierge-playbook.md`) reviewed with the founder — they can run through the 12-step tap-by-tap from memory on a recorded dry-run call.
