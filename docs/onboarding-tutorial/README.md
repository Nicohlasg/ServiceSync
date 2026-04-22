# Onboarding Tutorial — First-Run Product Tour

> A 2-minute, 7-step swipeable tour that introduces non-tech-savvy technicians to ServiceSync SG after they finish the setup wizard.

## Context

ServiceSync SG already has a **setup wizard** at `apps/web/app/dashboard/onboarding/page.tsx` — it collects business name, bio, UEN, service area, and base fee. That is *data capture*, not a *feature tour*.

This document describes a **separate, gentle product tour** that runs the first time a technician lands on the dashboard after setup is complete.

### Goals

- Finish in **≤ 2 minutes** and **≤ 10 steps** (we use 7).
- Feel professional, modern, glassy — match the existing `glass-*` design system.
- Animate smoothly using framer-motion presets already defined in `apps/web/src/lib/motion.ts`.
- Skippable at any time; never re-shown unless explicitly reset.

### Intended outcome

By the end of the tour, a new technician knows:

- Where to find Schedule, Services, Clients, Invoices
- How PayNow collection works
- How the bottom navigation moves them around the app

…without reading any help docs.

---

## Approach

**Fullscreen swipeable carousel.** Not a coachmark/spotlight overlay.

Reasoning:

- Non-tech users struggle with contextual overlays that require scrolling or tapping exact UI targets. A dedicated modal removes ambiguity.
- Easier to localise later (no pixel-accurate positioning against live UI).
- 7 slides × ~17 s each = ~120 s; comfortably under the 2-minute ceiling.
- We already have `glass-modal`, `spring.lift`, stagger variants, and `AnimatePresence` patterns in use — nothing new to introduce.

A small **secondary coachmark** fires once after the carousel closes, pointing to the bottom nav to anchor "this is how you move around". It uses a single `motion.div` with a pulsing ring — no new library.

---

## Trigger & Dismissal Logic

### Persistence

Mirror the existing `PwaInstallPrompt.tsx` pattern — `localStorage` key `tutorial-seen-v1` (versioned so we can re-trigger after a major redesign).

### Trigger condition

Fire after a **600 ms delay** on mount when **all** of the following are true:

1. `OnboardingGuard` has passed (profile has `name` and `phone`).
2. `localStorage.getItem('tutorial-seen-v1') !== 'true'`.
3. `pathname === '/dashboard'` (root of the dashboard, not sub-routes).

### Dismissal

Any of these sets `tutorial-seen-v1 = 'true'`:

- Tapping **Skip** (any step).
- Swiping past step 7.
- Tapping the **Start** CTA on step 7.
- Pressing **Escape**.

### Re-trigger path

Add a "Replay tutorial" row in `/dashboard/profile` that clears the key. Optional for v1.

### Analytics

Fire via the existing `trackEvent` helper (same one used by `onboarding_complete`):

- `tutorial_started`
- `tutorial_step_viewed` (payload: `{ step: 1–7 }`)
- `tutorial_completed`
- `tutorial_skipped` (payload: `{ step: 1–7 }`)

---

## File Structure

### New tutorial component files

Under `apps/web/src/components/tutorial/`:

| File | Responsibility |
|------|----------------|
| `TutorialOverlay.tsx` | Top-level component; trigger logic, localStorage, `AnimatePresence`. |
| `TutorialStep.tsx` | Reusable slide (icon + title + body + illustration slot). |
| `TutorialProgress.tsx` | Pill progress indicator with animated fill. |
| `TutorialCoachmark.tsx` | Post-tour pulse ring anchored to bottom nav. |
| `steps.ts` | Content source of truth — array of `{ id, title, body, Illustration }`. |

### This folder

| File | Purpose |
|------|---------|
| `README.md` (this file) | Overview, trigger rules, QA reset, implementation checklist, verification. |
| `content.md` | Finalised copy for all 7 steps (marketing can edit without touching code). |
| `motion-spec.md` | Animation timings, easing, gestures, reduced-motion fallbacks. |
| `illustrations.md` | Per-step visual specs (composition + motion). |
| `implementation-guide.md` | Engineer-facing reference: component tree, state machine, code skeletons, edge cases. |
| `qa-checklist.md` | Manual checklist + Playwright spec + performance budget + sign-off criteria. |

### Mount point

`apps/web/app/dashboard/layout.tsx` — render `<TutorialOverlay />` as a sibling to `<MobileNav />`. Client-only.

---

## Reuses — Do Not Recreate

| What | Where |
|------|-------|
| `spring.lift`, `spring.settle`, `spring.press`, `exitEase`, stagger variants | `apps/web/src/lib/motion.ts` |
| Glass classes `glass-modal`, `glass-card`, `glass-btn`, `glass-inner-light` | `apps/web/app/globals.css` |
| `Button` with built-in `spring.press` | `apps/web/src/components/ui/button.tsx` |
| Dismiss-persistence pattern (localStorage + version key) | `apps/web/src/components/PwaInstallPrompt.tsx` |
| `useReducedMotion` hook | already used in `apps/web/src/components/page-transition.tsx` |

### Icons

Use existing `lucide-react` (already a dependency): `Home`, `Calendar`, `Briefcase`, `Users`, `FileText`, `QrCode`, `Sparkles`.

### No new dependencies. Keep each component file under 200 lines.

---

## Implementation Checklist

1. Create `docs/onboarding-tutorial/` folder with `README.md`, `content.md`, `motion-spec.md`. ✅ *(this step)*
2. Draft finalised copy in `content.md` (7 steps, tone: warm, plain English, ≤ 2 sentences per step).
3. Build `steps.ts` from `content.md`.
4. Build `TutorialStep.tsx` (pure presentational; takes step object + `isActive` prop).
5. Build `TutorialProgress.tsx` (7 pills, animated fill on active).
6. Build `TutorialOverlay.tsx` (state machine: `hidden | active | closing`; swipe gestures; auto-advance timer; skip / back / next handlers; localStorage).
7. Build `TutorialCoachmark.tsx` (pulse ring; 3 s auto-dismiss).
8. Mount `<TutorialOverlay />` in `apps/web/app/dashboard/layout.tsx`.
9. Wire analytics events through the existing `trackEvent` helper.
10. Add reduced-motion fallbacks (fade-only transitions, no auto-advance).
11. Add a small "Replay tutorial" link in `/dashboard/profile` (clears `tutorial-seen-v1`).

---

## Verification

### Local dev

```bash
cd apps/web
npm run dev
```

Sign in as a fresh technician, complete the setup wizard, land on `/dashboard`. Tour should appear after ~600 ms.

### Skip path

1. Tap **Skip** on step 1.
2. Confirm `localStorage.getItem('tutorial-seen-v1') === 'true'` in devtools.
3. Reload — tour does not reappear.

### Complete path

1. Swipe through all 7 steps.
2. On step 7 tap **Start**.
3. Confirm coachmark pulses on the **Home** icon of the bottom nav for ~3 s, then disappears.

### Reduced motion

1. Toggle OS "Reduce motion".
2. Confirm transitions are fades only, no auto-advance, no pulse ring.

### Cross-device

Same user on a second device should NOT see the tour again if they completed it.

> **Caveat:** `localStorage` is per-device. If cross-device suppression is required, add a `profiles.tutorial_completed_at` column and migrate the check. Raise with product before building.

### Responsive

Test at 375 px (iPhone SE), 390 px (iPhone 14), 768 px (iPad portrait). Modal must stay within safe-area insets.

### Accessibility

- Focus trap inside modal.
- **Escape** key skips.
- Every control has an `aria-label`.
- Progress indicator has `role="progressbar"` with `aria-valuenow`.

### Playwright

Add `tests/e2e/tutorial.spec.ts` — assert tour appears for a fresh user, dismisses correctly, and does not re-trigger.

---

## QA Reset — How to Re-trigger the Tour

In the browser devtools console on any dashboard page:

```js
localStorage.removeItem('tutorial-seen-v1');
location.reload();
```

Or — once the "Replay tutorial" row is added in `/dashboard/profile` — use that.
