# Illustration Specs

> Per-step visual specifications. Keep illustrations **CSS / SVG only** — no raster assets, no external requests. Every illustration component lives in `apps/web/src/components/tutorial/illustrations/`.

## Global Rules

- **Size envelope**: 160 px tall on 375 px viewports, 176 px on 390 px, 240 px on ≥ md.
- **Palette**: stick to the existing design tokens — `slate-900` base, `blue-400/500/600` accents, `white` at varying opacities. No new colours.
- **Depth**: use `glass-card` + subtle `shadow-lg shadow-blue-500/10` for floating elements. One layer of depth max — no parallax stacks.
- **Motion**: every illustration has an entry animation (stagger, flip, morph). Entry runs once when the step becomes active. Idle state is static after entry to avoid looping distractions.
- **Reduced motion**: skip entry animation, render final state directly.

---

## Step 1 — Welcome (`WelcomeIllustration`)

**Composition**

- Centred app logo (80 px).
- Three overlapping translucent glass discs behind the logo (60%, 40%, 20% opacity blue).
- A small "👋" hand emoji to the top-right of the logo.

**Motion**

- Discs fade in with stagger (`staggerChildren: 0.08`), scaling from 0.7 → 1 with `spring.settle`.
- Logo fades in last with `spring.lift`.
- Hand emoji does a single 15° wave (rotate -15° → 15° → 0°) over 600 ms, delayed 400 ms after logo entry.

---

## Step 2 — Your Home Base (`DashboardIllustration`)

**Composition**

- Miniature dashboard mock — one rounded glass card (`glass-card`) showing:
  - A job tile with time (`9:00 AM`), service name (`AC Service`), and a green "confirmed" dot.
  - An earnings chip below (`$420 today`) with an upward-arrow icon.
- Slight 3° tilt (isometric feel) via `transform: rotateX(6deg) rotateY(-2deg)`.

**Motion**

- Card slides up 24 px with fade, `spring.lift`.
- Earnings chip number counts up from `$0 → $420` over 800 ms (ease-out), starting 300 ms after card entry.

---

## Step 3 — Schedule (`ScheduleIllustration`)

**Composition**

- A horizontal timeline (a thin `bg-white/15` line spanning 240 px).
- Three dots on the timeline at 20%, 50%, 80% — each a `6 px` filled circle in `bg-blue-400`.
- Above the middle dot, a small glass tooltip reading `10:30 — Aircon Srv`.

**Motion**

- Line draws in left-to-right over 400 ms (`clip-path` or `scaleX` with `transform-origin: left`).
- Dots pop in with stagger (120 ms apart) using `spring.press`.
- Tooltip slides up + fades in from 12 px below its final position with `spring.lift`, anchored to the middle dot, 200 ms after the last dot.

---

## Step 4 — Services & Prices (`ServicesIllustration`)

**Composition**

- Three stacked glass chips, each showing a sample service + price:
  - `Aircon Service · $80`
  - `Plumbing Repair · $120`
  - `Electrical Fix · $95`
- Chips overlap vertically with 12 px offset, creating a stacked card feel.

**Motion**

- Chips enter from the left with stagger (`staggerChildren: 0.08`), sliding in 40 px and fading in, each with `spring.settle`.
- After all three land, the stack gently settles down 4 px (`spring.press`) — a tiny "landing" bounce.

---

## Step 5 — Clients (`ClientsIllustration`)

**Composition**

- A single glass client card, 220 px wide, 120 px tall.
- Front face: avatar circle (initial `A`) + name `Ah Chong` + number `+65 9123 4567`.
- Back face (after flip): three history rows — `15 Feb — Aircon`, `22 Jan — Plumbing`, `8 Jan — Aircon`.

**Motion**

- Card enters with `spring.lift`, scale 0.95 → 1.
- After a 600 ms pause, flips on the Y-axis (rotateY 0 → 180°) over 700 ms with `spring.settle` — revealing the history side.
- Stays on the history side for the remainder of the step.

---

## Step 6 — PayNow (`PayNowIllustration`)

> Headline visual. Give it the most polish. Three-stage morph sequence.

**Stage A — Invoice paper (0 – 6 s)**

- A glass rectangle shaped like a receipt, 180 px tall, 140 px wide.
- Three horizontal lines inside representing invoice rows.
- `$180.00` total at the bottom in bold `text-blue-300`.

**Stage B — QR code (6 – 13 s)**

- Invoice morphs into a QR code — transition via `AnimatePresence mode="wait"`, exit fades + scales to 0.95, enter scales from 1.05 + fades.
- QR is a stylised SVG (not a real code — purely decorative); 140 × 140 px with a small PayNow logo chip in the centre.

**Stage C — Bank building (13 – 20 s)**

- QR morphs into a bank icon — a simple glass-styled building silhouette (four pillars, a triangular roof).
- A small green `✓` pops in at the top-right with `spring.press`, indicating "received".

**Timing note**: If the user swipes Next early, the sequence skips ahead but still shows the final bank+check state for at least 400 ms before the slide transition — so they see the punchline.

---

## Step 7 — Ready (`ReadyIllustration`)

**Composition**

- A single oversized glass button (not interactive — the real CTA is below) with the word `Start` and a sparkle icon.
- A soft radial glow behind the button (`bg-blue-500/20 blur-3xl`).

**Motion**

- Button scales in from 0.9 with `spring.lift`.
- Glow pulses gently — `opacity: 0.6 → 1 → 0.6` over 2 s, repeats indefinitely (this is the one exception to "no idle loops" because the whole point of step 7 is to draw the eye to the real CTA).
- Reduced motion: no glow pulse, static 0.8 opacity.

---

## Asset Implementation Checklist

| # | Component | Complexity | Est. LOC |
|---|-----------|------------|----------|
| 1 | `WelcomeIllustration.tsx` | Low | ~40 |
| 2 | `DashboardIllustration.tsx` | Medium | ~80 |
| 3 | `ScheduleIllustration.tsx` | Low | ~50 |
| 4 | `ServicesIllustration.tsx` | Low | ~45 |
| 5 | `ClientsIllustration.tsx` | Medium | ~90 (flip logic) |
| 6 | `PayNowIllustration.tsx` | High | ~130 (3-stage morph) |
| 7 | `ReadyIllustration.tsx` | Low | ~35 |

Keep each under 200 lines. If `PayNowIllustration` balloons, split it into `PayNowInvoice.tsx`, `PayNowQR.tsx`, `PayNowBank.tsx` and orchestrate from a parent.
