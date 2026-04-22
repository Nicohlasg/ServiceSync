# Implementation Guide

> Engineer-facing reference for building the tutorial components. Pair this with `motion-spec.md` (animation tokens) and `content.md` (copy).

## Component Tree

```
<DashboardLayout>
  ├── <main>{children}</main>
  ├── <MobileNav />
  └── <TutorialOverlay />         ← new
        ├── <TutorialProgress />
        ├── <AnimatePresence mode="wait">
        │     <TutorialStep />    ← one per active slide
        │ </AnimatePresence>
        └── <TutorialCoachmark /> ← fires after overlay closes
```

Mount `<TutorialOverlay />` in `apps/web/app/dashboard/layout.tsx` as a sibling to `<MobileNav />`. Mark the file `"use client"` if it isn't already (it currently isn't — the overlay must be a client component but the layout can stay a server component as long as the overlay file has `"use client"` at the top).

---

## State Machine — `TutorialOverlay`

```
hidden ──(mount + trigger passes)──▶ opening
opening ──(entry animation complete)──▶ active
active ──(advance)──▶ active (step+1)
active ──(skip / complete)──▶ closing
closing ──(exit animation complete)──▶ done
done ──(post-exit)──▶ coachmark-visible
coachmark-visible ──(3s timeout OR tap)──▶ unmounted
```

Implement with `useState<'hidden' | 'opening' | 'active' | 'closing' | 'done'>`. Coachmark renders when state is `done` and `completionReason === 'completed'` (not `'skipped'`).

---

## `steps.ts` Shape

```ts
import type { LucideIcon } from 'lucide-react';
import { Sparkles, Home, Calendar, Briefcase, Users, QrCode } from 'lucide-react';

export type TutorialStep = {
  id: string;
  icon: LucideIcon;
  title: string;
  body: string;
  cta: 'Next' | 'Start';
  dwellMs: number | null;          // null = wait for tap (step 7)
  Illustration: React.ComponentType;
};

export const TUTORIAL_STEPS: ReadonlyArray<TutorialStep> = [
  // populate from docs/onboarding-tutorial/content.md
];
```

Keep `steps.ts` under 200 lines by extracting each illustration into its own module inside `apps/web/src/components/tutorial/illustrations/`.

---

## `TutorialOverlay.tsx` — Trigger Hook

```tsx
const STORAGE_KEY = 'tutorial-seen-v1';
const TRIGGER_DELAY_MS = 600;

function useTutorialTrigger() {
  const [shouldShow, setShouldShow] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== '/dashboard') return;
    if (localStorage.getItem(STORAGE_KEY) === 'true') return;
    const t = setTimeout(() => setShouldShow(true), TRIGGER_DELAY_MS);
    return () => clearTimeout(t);
  }, [pathname]);

  const markSeen = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setShouldShow(false);
  }, []);

  return { shouldShow, markSeen };
}
```

Tutorial assumes `OnboardingGuard` has already gated access — if the user reaches `/dashboard`, their profile is complete.

---

## Swipe Gesture Skeleton

```tsx
<motion.div
  drag="x"
  dragConstraints={{ left: 0, right: 0 }}
  dragElastic={0.2}
  onDragEnd={(_, info) => {
    const velocity = info.velocity.x;
    const offset = info.offset.x;
    if (offset < -100 || velocity < -500) goNext();
    else if (offset > 100 || velocity > 500) goBack();
  }}
>
  {/* step content */}
</motion.div>
```

---

## Auto-Advance with Pause

```tsx
useEffect(() => {
  const step = TUTORIAL_STEPS[currentIndex];
  if (!step.dwellMs) return;
  if (prefersReducedMotion) return;
  if (isPaused) return;
  if (document.visibilityState === 'hidden') return;

  const t = setTimeout(goNext, step.dwellMs);
  return () => clearTimeout(t);
}, [currentIndex, isPaused, prefersReducedMotion]);

// Pause on visibility change
useEffect(() => {
  const handler = () => setIsPaused(document.visibilityState === 'hidden');
  document.addEventListener('visibilitychange', handler);
  return () => document.removeEventListener('visibilitychange', handler);
}, []);
```

---

## Analytics Wiring

Use whatever `trackEvent` helper `onboarding/page.tsx` uses (it already fires `onboarding_complete`). Events:

```ts
trackEvent('tutorial_started');
trackEvent('tutorial_step_viewed', { step: index + 1 });  // on each step change
trackEvent('tutorial_completed');                         // step 7 Start tapped
trackEvent('tutorial_skipped', { step: index + 1 });      // skip / escape
```

Fire `tutorial_step_viewed` from a `useEffect` keyed on `currentIndex` so it fires exactly once per view.

---

## Profile Replay Link (Step 11)

In `apps/web/app/dashboard/profile/page.tsx`, add a row:

```tsx
<button
  onClick={() => {
    localStorage.removeItem('tutorial-seen-v1');
    router.push('/dashboard');
  }}
  className="glass-btn w-full text-left p-3 rounded-lg"
>
  Replay the quick tour
</button>
```

Place under the profile-management section, near the sign-out row.

---

## Edge Cases to Handle

| Case | Handling |
|------|----------|
| User is on `/dashboard/schedule` on first launch | Don't show — only `/dashboard` root triggers it. |
| User is on a tablet (≥ md) | Don't show — tutorial is scoped to mobile-first layout. Gate with `md:hidden` wrapper or a media-query hook. |
| User reloads mid-tour | Treat as fresh mount — if `tutorial-seen-v1` is unset, tour restarts from step 1. Acceptable; most users finish in one sitting. |
| localStorage throws (private browsing on Safari) | Wrap in `try/catch`. If writes fail, the tour re-appears each session — acceptable degraded mode. |
| User clicks a link inside the modal | There shouldn't be any. Body copy is plain text only. |
| Deep-linked navigation while tour is open | `pathname` change → close tour, don't mark seen. User can replay later. |
| Two tabs open, user dismisses in tab A | Tab B still shows the tour until next navigation; localStorage only reads on mount. Acceptable. |

---

## Testing Hooks

Add `data-testid` attributes for Playwright:

- `data-testid="tutorial-overlay"` on the root modal
- `data-testid="tutorial-skip"` on the Skip button
- `data-testid="tutorial-next"` on the Next/Start button
- `data-testid="tutorial-back"` on the Back button
- `data-testid={`tutorial-step-${id}`}` on each `<TutorialStep>`
- `data-testid="tutorial-coachmark"` on the pulse ring

---

## Non-Goals (v1)

Explicitly **not** doing in v1:

- Coachmark/spotlight on live UI elements.
- Video playback inside steps.
- Multi-language copy (English-only; Malay/Tamil/Mandarin deferred).
- Cross-device sync via Supabase (`localStorage` only — flagged in README).
- A/B testing different content variants.
- Replay button on the dashboard itself (only in `/dashboard/profile`).
