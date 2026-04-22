# Tutorial Content — Finalised Copy

> Source of truth for the 7-step onboarding tutorial. Marketing / product owns this file; engineering imports it into `steps.ts`.

## Tone Guide

- **Warm, plain English.** Write like you're talking to a tradesperson at a kopitiam.
- **≤ 2 sentences per step.** No jargon. No technical terms.
- **Second person, active voice.** "You can…" / "We'll…" — never "The system will…".
- **Singapore-aware.** Mention PayNow, zero commission, Singapore context where natural.

---

## Step 1 — Welcome

| Field | Value |
|-------|-------|
| **ID** | `welcome` |
| **Icon** | `Sparkles` (lucide-react) |
| **Title** | `Welcome, {name} 👋` |
| **Body** | Let's take a quick 2-minute look around. You can skip anytime. |
| **CTA** | Next |
| **Dwell** | ~15 s |
| **Visual** | Logo centred, illustrated wave. Stagger-fade entry — title fades up first, body fades up 80 ms later. |

---

## Step 2 — Your home base

| Field | Value |
|-------|-------|
| **ID** | `dashboard` |
| **Icon** | `Home` |
| **Title** | Your home base |
| **Body** | See today's jobs, earnings, and what's next — all on one screen. |
| **CTA** | Next |
| **Dwell** | ~15 s |
| **Visual** | Mini glass preview of a dashboard card — one sample job tile, one earnings chip. Soft shadow, subtle float animation. |

---

## Step 3 — Schedule with one tap

| Field | Value |
|-------|-------|
| **ID** | `schedule` |
| **Icon** | `Calendar` |
| **Title** | Schedule with one tap |
| **Body** | Book a job, set a time, add the address — we'll remind you. |
| **CTA** | Next |
| **Dwell** | ~15 s |
| **Visual** | Calendar icon with a timeline sketch. A small dot ticks along the timeline to imply "we remind you". |

---

## Step 4 — Your services & prices

| Field | Value |
|-------|-------|
| **ID** | `services` |
| **Icon** | `Briefcase` |
| **Title** | Your services & prices |
| **Body** | Save your services once. No more typing the same thing every job. |
| **CTA** | Next |
| **Dwell** | ~15 s |
| **Visual** | Stack of 3 service chips animating in from the left with stagger (80 ms between). Each chip shows a sample service name + price. |

---

## Step 5 — Clients remember themselves

| Field | Value |
|-------|-------|
| **ID** | `clients` |
| **Icon** | `Users` |
| **Title** | Clients remember themselves |
| **Body** | We keep your clients' numbers, addresses, and history — so you don't have to. |
| **CTA** | Next |
| **Dwell** | ~15 s |
| **Visual** | Client card that flips to show history on the back — subtle 3D rotate-y animation using `spring.settle`. |

---

## Step 6 — Get paid with PayNow

> **Headline step.** This is the money-moment. Give it the longest dwell and the most polish.

| Field | Value |
|-------|-------|
| **ID** | `paynow` |
| **Icon** | `QrCode` |
| **Title** | Get paid with PayNow |
| **Body** | Send an invoice. They scan. Money lands in your bank. Zero commission. |
| **CTA** | Next |
| **Dwell** | ~20 s |
| **Visual** | QR code morphs into a bank icon — three-stage sequence: invoice paper → QR code → bank building. Uses `AnimatePresence` mode="wait" between stages. |

---

## Step 7 — You're ready

| Field | Value |
|-------|-------|
| **ID** | `ready` |
| **Icon** | `Sparkles` |
| **Title** | You're ready |
| **Body** | Tap **Start** to begin. Need help? You can replay this tour any time from your profile. |
| **CTA** | **Start** (primary glass button, larger than other CTAs) |
| **Dwell** | — (no auto-advance — wait for user action) |
| **Visual** | Big glass CTA button, gentle pulse on the button shadow. Confetti is *not* used — keep it restrained. |

---

## Total Time Budget

```
Step 1 → 15 s
Step 2 → 15 s
Step 3 → 15 s
Step 4 → 15 s
Step 5 → 15 s
Step 6 → 20 s  (headline)
Step 7 → manual (no timer)
───────────────
Total  ≈ 95 s auto  (+ up to ~25 s on step 7 before user taps Start)
```

Well under the 2-minute ceiling.

---

## Editorial Rules for Future Edits

- Never exceed **48 characters** for a title (keeps it on one line at 375 px).
- Never exceed **120 characters** for body copy (keeps it to 2 lines max).
- Do not add a 9th step without revisiting the time budget and the progress indicator layout.
- If a word sounds jargon-y, replace it with the plainest synonym you can think of. When in doubt, show the copy to a non-technical friend.
