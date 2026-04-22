# Motion & UX Specification

> Animation timings, easing, gestures, and reduced-motion fallbacks for the onboarding tutorial. All primitives already exist in `apps/web/src/lib/motion.ts` — **do not introduce new ones**.

## Motion Tokens (Existing)

Imported from `apps/web/src/lib/motion.ts`:

| Token | Damping | Stiffness | Feel | Used For |
|-------|---------|-----------|------|----------|
| `spring.press` | 15 | 400 | Snappy rebound | Button tap |
| `spring.lift` | 22 | 320 | Confident overshoot | Modal entrance |
| `spring.settle` | 28 | 260 | Soft, settled | Slide transitions, card hover |
| `spring.gentle` | 35 | 180 | Barely perceptible | Page transitions |
| `exitEase` | — | — | 0.18 s linear-ish | Decisive close, no bounce |
| `stagger` / `staggerItem` | — | — | `delayChildren: 0.08`, `staggerChildren: 0.05` | Orchestrated cascades |

---

## Container (Modal)

| Property | Value |
|----------|-------|
| **Class** | `glass-modal glass-inner-light` |
| **Position** | `fixed inset-0` on mobile; centred `max-w-md` + 90vw padding on ≥ md |
| **Backdrop** | Match Dialog `modalBackdrop` variant — `bg-black/60 backdrop-blur-md` |
| **z-index** | `z-[300]` (above `PwaInstallPrompt` at `z-[200]` and `CookieConsent` at `z-[250]`) |
| **Entry** | `initial={{ opacity: 0, scale: 0.96 }}` → `animate={{ opacity: 1, scale: 1 }}` with `spring.lift` |
| **Exit** | `exit={{ opacity: 0, scale: 0.98 }}` with `exitEase` (0.18 s) |
| **Safe areas** | Honour `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)` on iOS |

---

## Slide Transitions Between Steps

| Property | Value |
|----------|-------|
| **Direction forward** | `x: 100% → 0%` (incoming), `x: 0% → -100%` (outgoing) |
| **Direction backward** | mirrored |
| **Easing** | `spring.settle` |
| **Opacity** | `0 → 1` in parallel with `x`, crossfade feel |
| **AnimatePresence mode** | `"wait"` — outgoing slide finishes before incoming starts |
| **Duration proxy** | ~280 ms perceived (spring-driven, so actual duration varies) |

---

## Gestures

| Gesture | Behaviour |
|---------|-----------|
| **Swipe left** | Advance one step |
| **Swipe right** | Go back one step (no-op on step 1) |
| **Drag threshold** | framer-motion `dragConstraints={{ left: 0, right: 0 }}`, elastic `0.2`, velocity threshold `500`, distance threshold `100 px` |
| **Tap Next** | `spring.press` on the button, advance |
| **Tap Back** | ghost button, subtle press |
| **Tap Skip** | Fades modal out with `exitEase`, sets `tutorial-seen-v1` |
| **Escape key** | Treated as Skip |
| **Tap outside** | Disabled — prevents accidental dismissal |

---

## Progress Indicator

| Property | Value |
|----------|-------|
| **Layout** | 7 horizontal pills, `gap-1.5`, centred, top of modal below Skip button |
| **Inactive pill** | `h-1 w-6 bg-white/15 rounded-full` |
| **Active pill** | `h-1 w-10 bg-white/90 rounded-full` — fills from left to right over the step's dwell time |
| **Completed pill** | `h-1 w-6 bg-white/60 rounded-full` |
| **Fill animation** | Linear over dwell duration (15 s or 20 s), `from scaleX(0) to scaleX(1)` with `transform-origin: left` |
| **Pause on interaction** | Pause fill + auto-advance timer while user is mid-drag or has just tapped Back |
| **ARIA** | `role="progressbar"`, `aria-valuenow={currentStep}`, `aria-valuemin={1}`, `aria-valuemax={7}` |

---

## Controls

### Skip

- Top-right corner of modal, `p-2`, `text-slate-400 hover:text-slate-200`
- Text: `Skip`
- `aria-label="Skip tutorial"`

### Back

- Bottom-left of modal content area, ghost variant
- Hidden on step 1
- Icon: `ChevronLeft` + text `Back`
- `aria-label="Previous step"`

### Next / Start

- Bottom-right, primary glass button (`glass-btn` + `bg-primary/80`)
- Text: `Next` on steps 1–6, `Start` on step 7
- `spring.press` on tap (inherited from `Button` component)
- `aria-label="Next step"` / `aria-label="Start using ServiceSync"`

---

## Coachmark (Post-Tour)

Fires once immediately after the carousel closes with `tutorial_completed`.

| Property | Value |
|----------|-------|
| **Anchor** | Home icon in `MobileNav` (`apps/web/src/components/layout/MobileNav.tsx`) |
| **Element** | `motion.div` absolutely positioned over the Home icon |
| **Size** | `h-12 w-12` rounded-full, centred on the icon |
| **Style** | `border-2 border-blue-400` with `box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4)` |
| **Animation** | Pulse ring — `box-shadow` scales from `0 0 0 0` to `0 0 0 20px rgba(…,0)` over 1.4 s, repeats twice (total ~2.8 s), then fades out 200 ms |
| **Dismiss** | Auto after 3 s, or on any tap anywhere |
| **Reduced motion** | Skip coachmark entirely |

---

## Reduced-Motion Fallbacks

Gate with `useReducedMotion()` from framer-motion (already used in `page-transition.tsx`).

| Element | Normal | Reduced |
|---------|--------|---------|
| Modal entry | scale + fade with `spring.lift` | fade only, 150 ms |
| Slide between steps | horizontal slide + fade | crossfade only, 180 ms |
| Progress fill | animated scaleX | snap to full instantly |
| Auto-advance timer | **on** (15 / 20 s) | **off** — user must tap Next |
| Coachmark pulse | 2× pulse + fade | skip coachmark entirely |
| Button press | `spring.press` scale 0.97 | instant, no scale |
| Illustration animations | stagger, flip, morph | static final state |

---

## Auto-Advance Timer

```ts
// Pseudocode — actual impl in TutorialOverlay.tsx
const dwell = steps[currentStep].dwellMs ?? 15_000; // step 6 = 20_000; step 7 = null
if (dwell && !prefersReducedMotion && !isPaused) {
  const t = setTimeout(() => goNext(), dwell);
  return () => clearTimeout(t);
}
```

Pause conditions:

- User currently dragging
- User tapped Back within last 500 ms
- Document is `hidden` (tab switched away — `document.visibilityState`)
- Reduced motion is on

---

## Responsive Breakpoints

| Viewport | Layout |
|----------|--------|
| 375 px (iPhone SE) | Full viewport modal, 16 px side padding, illustration shrinks to 160 px tall |
| 390 px (iPhone 14) | Same as 375 with 176 px illustration |
| 768 px (iPad portrait) | Modal centred, `max-w-md` (~28 rem), 24 px side padding, 240 px illustration |
| ≥ 1024 px (desktop) | Tour **does not render** (`md:hidden` on trigger) — dashboard is mobile-first and tour is scoped to mobile |

---

## Accessibility Checklist

- [ ] Focus trap: Tab cycles within modal only
- [ ] Initial focus: on the Skip button (least destructive)
- [ ] Escape closes (treated as Skip)
- [ ] Every icon-only control has `aria-label`
- [ ] Progress indicator has `role="progressbar"` + `aria-valuenow`
- [ ] Respects `prefers-reduced-motion` (see fallbacks above)
- [ ] All text meets WCAG AA contrast (4.5:1) on the glass background
- [ ] Swipe gestures have keyboard equivalents (Next/Back buttons)
- [ ] Tour does not block `Escape`-to-close even during auto-advance
