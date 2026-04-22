# ServiceSync SG — Onboarding Masterplan (Living Document)

> **Purpose:** Single source of truth for the **end-to-end onboarding experience** of non-tech-savvy Singapore tradesmen — from landing page click, through signup, setup wizard, guided tour, first real action, and activation. Closes all gaps identified between `docs/onboarding-tutorial/` (tour only) and `docs/masterplan.md` (beta launch requirements).
>
> **Design constraint:** Every surface MUST comply with `docs/DESIGN_SYSTEM.md` v1.2 — no new hues, no new motion primitives, no emoji icons, monochromatic blue + slate, glassmorphism, 44×44px touch targets, Inter typography, 8px spacing grid.

| Field | Value |
|---|---|
| **Version** | 1.0 |
| **Last updated** | 2026-04-15 |
| **Owner** | Product / Founder |
| **Parent plan** | [masterplan.md](./masterplan.md) §4 Milestone 2 |
| **Child plans** | [onboarding-tutorial/](./onboarding-tutorial/) (tour sub-spec) |
| **Target ship date** | **Beta recruitment start: 1 June 2026** (see masterplan §4.1) |

---

## 1. North Star for Onboarding

A Singapore technician with **low digital literacy**, **intermittent connectivity**, and **no patience for jargon** must go from "tap install" to **first real invoice sent** within **≤ 24 hours of signup**, in a **language they are comfortable reading**, without requiring human support.

### 1.1 Activation (the one metric that matters)

Per masterplan §4.1–4.2:

- **Primary activation:** first **real** invoice issued OR first **real** booking received within **14 days** of signup.
- **Leading indicator:** setup wizard complete + tour finished + **one** of {client added, service added, PayNow QR previewed} within **7 days**.

Every design decision below is judged against: *does this move a first-time user toward activation faster, with less friction, in their language?*

### 1.2 Scope boundaries

**In scope**
- Language selection (English, Mandarin, Malay, Tamil).
- Landing → signup → email verify → setup wizard → tour → first-action checklist → activation.
- Cross-device persistence (replaces `localStorage`-only for tour).
- Tutorial videos (3 × ≤ 60s, masterplan §4.3 requirement).
- Concierge onboarding playbook (masterplan §4.2 requirement).
- PWA install prompt integration within the funnel.
- Replay tour from `/dashboard/profile`.
- Analytics to measure each funnel step.

**Out of scope (v1)**
- A/B testing content variants.
- Marketplace discovery flows.
- Auto-translation of user-generated content (client notes, service names).
- Paid acquisition attribution (covered in masterplan §5 partnerships).

---

## 2. Target user model (for every ticket writer)

Pin this to the wall:

| Trait | Implication for onboarding |
|---|---|
| 35–60 years old, solo-operator tradesman | Copy at Primary 5 reading level; Mandarin option non-negotiable |
| Uses phone one-handed on-site | Thumb-zone CTAs, ≥44×44px targets (DESIGN_SYSTEM §4.3) |
| Intermittent connectivity (basements, lifts) | Onboarding MUST work offline after first load; analytics queue |
| Has typed invoices into WhatsApp/paper for 10+ years | First invoice moment is emotional — treat it like a launch, not a form |
| Distrusts "free software" | No upsell, no credit card, no dark patterns during onboarding |
| May reinstall PWA or change phones mid-beta | Cross-device progress persistence required |

---

## 3. End-to-end onboarding funnel (target state)

```
┌────────────────────────────────────────────────────────────────────┐
│  STEP 0  Landing page / partner flyer QR code                      │
│          → language picker visible above the fold                  │
│          → "Try it free — no commission" CTA                       │
└────────────────────┬───────────────────────────────────────────────┘
                     ▼
┌────────────────────────────────────────────────────────────────────┐
│  STEP 1  /signup — email + password + phone                        │
│          → language preference captured before form                │
│          → inline validation in chosen language                    │
└────────────────────┬───────────────────────────────────────────────┘
                     ▼
┌────────────────────────────────────────────────────────────────────┐
│  STEP 2  /auth/callback → email verified                           │
│          → PWA install prompt (if not installed, mobile only)      │
└────────────────────┬───────────────────────────────────────────────┘
                     ▼
┌────────────────────────────────────────────────────────────────────┐
│  STEP 3  /dashboard/onboarding — setup wizard (existing)           │
│          → name, UEN (optional), service area, base fee            │
│          → language still editable here                            │
└────────────────────┬───────────────────────────────────────────────┘
                     ▼
┌────────────────────────────────────────────────────────────────────┐
│  STEP 4  /dashboard — 7-step guided tour (existing spec)           │
│          → localised copy; auto-advance honours reduced-motion     │
│          → cross-device flag written to profile on completion      │
└────────────────────┬───────────────────────────────────────────────┘
                     ▼
┌────────────────────────────────────────────────────────────────────┐
│  STEP 5  Post-tour activation checklist (NEW)                      │
│          → "Add first client", "Add first service", "Preview QR"   │
│          → persistent glass card on dashboard until all 3 done     │
│          → deep-links into existing flows                          │
└────────────────────┬───────────────────────────────────────────────┘
                     ▼
┌────────────────────────────────────────────────────────────────────┐
│  STEP 6  First real invoice / booking — ACTIVATED 🎯               │
│          → celebratory toast (no confetti per tutorial spec)       │
│          → checklist collapses into a "What's next" hub            │
└────────────────────────────────────────────────────────────────────┘
```

Every step has analytics (see §9) so we can measure funnel drop-off at weekly beta review (masterplan §4.4).

---

## 4. New features needed to close gaps

### 4.1 Language selection system (NEW — HIGHEST PRIORITY)

**Why:** Masterplan §4.3 explicitly calls out "local vernacular / Mandarin as appropriate for ICP" for tutorial videos. Leaving tour/UI English-only breaks the ICP promise and creates a two-speed experience (videos in Mandarin, product in English) that will confuse the 40%+ of SG tradesmen who prefer Mandarin.

**Supported locales (v1):**

| Locale | Code | Priority | Notes |
|---|---|---|---|
| English (Singapore) | `en-SG` | P0 — default | Covers English-preferring majority |
| Simplified Chinese | `zh-Hans-SG` | P0 — required for beta | Largest non-English ICP segment |
| Malay | `ms-SG` | P1 — post-beta launch if capacity | ~15% ICP |
| Tamil | `ta-SG` | P2 — defer unless partner request | Smallest ICP share |

**Capture points:**

1. **Landing page** — language picker chip (top-right, glass-btn) above the fold; writes to `localStorage.locale` and URL `?lng=`.
2. **Signup form** — pre-selected from landing; editable.
3. **Setup wizard** — first question: *"Which language would you like to use?"* with four tappable glass cards (min-height 72px, radius-xl per DESIGN_SYSTEM §5).
4. **Profile settings** — `/dashboard/profile/language` — change any time, applies instantly.

**Storage (authoritative):** `profiles.preferred_locale text default 'en-SG' not null` (Supabase migration). Writes cascade client → server on every change. `localStorage.locale` is a cache only.

**i18n stack:**

- Library: `next-intl` (already compatible with App Router; adds ~8KB gzip — within tutorial perf budget of 25KB if shared).
- Message files: `apps/web/messages/{en-SG,zh-Hans-SG,ms-SG,ta-SG}.json` — flat namespaced keys (e.g. `tutorial.step1.title`).
- No runtime translation; all copy pre-authored by product + native-speaker reviewer.
- Numbers / dates / currency via `Intl.*` — **always SGD**, **always Asia/Singapore TZ**.

**Copy ownership rule:** English is the master; any new key must be added to all four files in the same PR. CI check blocks merge if keys diverge.

**Non-goals:** Right-to-left layout (none of the four target locales are RTL). Automatic locale detection from `navigator.language` — we ask explicitly to avoid wrong defaults.

---

### 4.2 Post-tour activation checklist (NEW — HIGH PRIORITY)

**Why:** Current tour ends with "Tap Start" → drops user onto an empty dashboard. Masterplan §4.2 activation metric is first invoice/booking. We need to bridge the gap with a **persistent, dismissible, progress-tracked checklist** that nudges users toward the three pre-activation actions.

**Spec:**

- **Location:** Top of `/dashboard`, below greeting, above today's jobs. `glass-card` per DESIGN_SYSTEM §7.
- **Content:** 3 rows, each a tappable deep-link:
  1. Add your first service — → `/dashboard/services/new`
  2. Add your first client — → `/dashboard/clients/new`
  3. See how PayNow works — → opens a read-only sample invoice modal (not live data)
- **Progress:** Pill progress bar identical token to `TutorialProgress` (DESIGN_SYSTEM §11 — reuse, don't rebuild).
- **Completion:** Each row writes to `profiles.onboarding_checklist_jsonb` (e.g. `{first_service: true, first_client: true, paynow_preview: true}`); once all three are true, card collapses into a single "What's next?" row with links to Schedule, Invoices, Help.
- **Dismissal:** "Hide for now" link (slate-400, text-sm per DESIGN_SYSTEM §3.4). Reappears after 3 days if any step still incomplete; permanent hide after 14 days.
- **Reappearance on profile:** Always accessible via `/dashboard/profile` → "Replay quick tour" row (already planned in tutorial spec) + new "Show setup checklist" row.

**Not a tour.** This is a dashboard feature, not a modal. It coexists with daily work and never blocks the UI.

---

### 4.3 Cross-device progress persistence (FIX — HIGH PRIORITY)

**Why:** `docs/onboarding-tutorial/README.md` caveat: *"`localStorage` is per-device. If cross-device suppression is required, add a `profiles.tutorial_completed_at` column."* Low-literacy beta users will reinstall the PWA, switch phones, clear browser data — current spec resurfaces the tour, creating distrust ("this thing keeps restarting").

**Migration:**

```sql
alter table profiles add column if not exists
  tutorial_completed_at timestamptz,
  onboarding_checklist jsonb default '{}'::jsonb not null,
  preferred_locale text default 'en-SG' not null;
```

**Client logic update:** `useTutorialTrigger` (from `implementation-guide.md`) reads `profile.tutorial_completed_at` via tRPC; writes both localStorage (cache) and DB on completion. localStorage remains the fast path for subsequent same-device visits.

**Skip vs complete:** Only full completion (reaching step 7 → Start) writes `tutorial_completed_at`. Skips remain per-device so the user can rediscover the tour across devices if they bailed out.

---

### 4.4 Tutorial videos integration (NEW — MEDIUM PRIORITY)

**Why:** Masterplan §4.3 requires 3 videos ≤ 60s each in local language, driven by top 3 friction themes from weeks 1–2 of guided testing. Currently nothing in the repo references them.

**Spec:**

- **Hosting:** YouTube unlisted + fallback MP4 in Supabase storage (bandwidth control).
- **Surface:** `/dashboard/profile/help` page with 3 video cards (glass-card, radius-2xl).
- **Embed rule:** Native `<video>` with poster frame; no YouTube iframe unless user taps play (privacy + weight).
- **WhatsApp distribution:** Same links pasted into the beta WhatsApp support broadcast (masterplan §4.2).
- **Selection:** Founder records videos in Mandarin + English after Week 2 feedback calls. **Do not ship placeholder videos.**
- **Video topics (to be confirmed after Week 2):** likely candidates from ICP analysis — "how to send your first PayNow invoice", "how to add a client in 30 seconds", "what to do when a client says the QR doesn't work". Swap based on actual friction.

**Not in tour.** Videos are on the help page only. Tour stays silent/visual per current spec to keep the 2-minute ceiling.

---

### 4.5 Concierge onboarding playbook (NEW — MEDIUM PRIORITY)

**Why:** Masterplan §4.2 requires a playbook: "install PWA → login → create first client → first invoice → first payment path". No such document exists.

**Deliverable:** `docs/onboarding-tutorial/concierge-playbook.md` — one-pager that:

- Lists the exact tap-by-tap sequence for the facilitator (founder / support) to walk through with a new user on a call.
- Defines the SLA: "WhatsApp or phone within same business day" (matches §4.2).
- Captures the drop-off reasons checklist — so call notes feed the Week 1–2 friction analysis that seeds §4.4 video topics.
- Includes a "red-flag signs" section — when to escalate to rebuild vs re-educate.

---

### 4.6 Design-system compliance fixes for existing tour (FIX — LOW PRIORITY)

Close cosmetic and compliance gaps in the current tutorial spec without re-architecting:

| Issue | Fix | Location |
|---|---|---|
| Step 1 title uses `👋` emoji | Replace with `Sparkles` lucide icon inline OR keep as decorative text, not classified as an icon. Document the decision. | `content.md` Step 1 |
| Contrast on glass backdrop unverified | Run axe-core against each step in staging; document pass/fail per WCAG AA 4.5:1. Adjust text color to `slate-50` if fails on lightest glass. | `qa-checklist.md` Accessibility |
| Touch targets not explicitly verified | Add "All controls ≥44×44px" to manual checklist; confirm Skip button (currently `p-2`) meets it. | `qa-checklist.md` Responsive |
| Min font size not specified | Body copy ≥ 16px (DESIGN_SYSTEM §3.2 `--text-base`); titles ≥ 20px (`--text-xl`). Add to motion-spec. | `motion-spec.md` |
| PWA install step missing | Surface `PwaInstallPrompt` between email verify (Step 2) and setup wizard (Step 3), not inside the tour. Gate on `display-mode: standalone` media query. | Separate concern; handled in §4.2 funnel |

None of these invalidate the existing tutorial build — they are additive.

---

## 5. Prioritised task list

Ordered by **blocker for 1 June 2026 beta**, not by effort. "P0" items must ship before recruitment opens; "P1" within first fortnight of beta; "P2" before v1.1 release (15 July 2026).

### P0 — Ship before 1 June 2026

| # | Task | Owner | Est effort | Dependencies |
|---|---|---|---|---|
| 1 | Add Supabase migration: `profiles.preferred_locale`, `tutorial_completed_at`, `onboarding_checklist`. ✅ **Done 2026-04-15** — `packages/db/migrations/20260415_onboarding_locale_progress.sql` + canonical `packages/db/src/schema.sql` updated. | Backend | 0.5 day | — |
| 2 | Install `next-intl`; scaffold `en-SG` and `zh-Hans-SG` message files; wire middleware locale detection. ✅ **Done 2026-04-15** — `next-intl@^4.3.0` added; non-prefix routing via `src/i18n/{config,request}.ts`; all 4 message files scaffolded under `apps/web/messages/` (ms-SG/ta-SG English fallback with `_status: pending-translation`); `?lng=` → `NEXT_LOCALE` cookie handshake in `middleware.ts`; `layout.tsx` wraps in `NextIntlClientProvider` + dynamic `<html lang>`; `useChangeLocale` hook does cookie-write + hard-reload to avoid hydration mismatch (§10 risk). **Run `npm install` in `apps/web/` before building.** | Frontend | 2 days | Task 1 |
| 3 | Add language picker chip to landing page + signup form + setup wizard first step. Writes to profile. ✅ **Done 2026-04-15** — `apps/web/src/components/onboarding/LocalePicker.tsx` with `chip` + `cards` variants sharing optimistic `commit()` path (cookie-write + reload via `useChangeLocale`, DB sync via new `api.provider.setPreferredLocale` tRPC mutation, audit-logged single-column update, UNAUTHORIZED swallowed for pre-auth callers). Host-page wiring deferred — `/`, `/signup`, and `/dashboard/onboarding` routes are not yet scaffolded in this repo; picker is ready to import as `<LocalePicker variant="chip" />` / `<LocalePicker variant="cards" onSelected={...} skipRemoteWrite />` when those pages are built. | Frontend | 1.5 days | Task 2 |
| 4 | Translate all **tour copy** (content.md) + **setup wizard** + **dashboard empty states** to `zh-Hans-SG`. Native-speaker review required. ⏳ **Draft 2026-04-15** — `zh-Hans-SG.json` now covers all namespaces (`common`, `locale`, `landing`, `signup`, `wizard` incl. new `rerunTitle`/`rerunSubtitle`, `tutorial` 7 steps, `checklist`, `dashboard` with 4 empty-state pairs, `profile` with re-run wizard + replay-tour rows, `errors`). Tradesman-tone adjustments applied: 师傅 (not 技工), 主页 (not 仪表板), colloquial contractions ("不用信用卡", "一次不误"). Master `en-SG.json` extended with matching empty-state + `profile.*` keys; `ms-SG.json`/`ta-SG.json` re-synced to the new structure (English fallback). **Still blocked on native-speaker sign-off per §7.6 before beta.** | Product + reviewer | 2 days | Task 2 |
| 5 | Build `TutorialOverlay` + 7 steps per existing `docs/onboarding-tutorial/` spec, consuming `next-intl` keys. ✅ **Done 2026-04-15** — `apps/web/src/components/tutorial/`: `TutorialOverlay.tsx` (state machine + swipe + keyboard + analytics + localStorage gate), `TutorialStep.tsx` (slide transitions honouring `useReducedMotion`), `TutorialProgress.tsx` (7-pill animated fill with `role="progressbar"`), `TutorialCoachmark.tsx` (pulse ring, skipped under reduced motion), `steps.ts` (config with icon + translation key + dwell), and 7 `illustrations/*.tsx` (inline SVGs with framer-motion). All copy routed through `useTranslations('tutorial.*')` + `common.*` — no hard-coded strings. Exports `resetTutorialSeen()` for Task 15 profile replay. Spec deviations: coachmark rendered by host layout (not overlay internal) to avoid z-index bugs on unmount; storage key `tutorial-seen-v1` will be swapped for hybrid gating in Task 6. **Host wiring pending** — mount in `app/dashboard/layout.tsx` once that route exists. | Frontend | 4 days | Task 2, 4 |
| 6 | Swap `localStorage`-only tour gating for hybrid `profile.tutorial_completed_at` + localStorage cache. ✅ **Done 2026-04-15** — `packages/api/src/routers/provider.ts` gains `getTutorialStatus` (query), `markTutorialComplete` (first-completion-wins, audit-logged, captures `reason` in diff), and `resetTutorialCompletion` (for replay + Re-run Setup Wizard). New `apps/web/src/components/tutorial/useTutorialGate.ts` encapsulates the 4-step precedence: cache-sync → 600 ms mount delay → DB promote → UNAUTHORIZED fallback. `TutorialOverlay.tsx` refactored to consume the hook (no direct localStorage access), resets step index only on hidden→shown transitions so replay re-starts at step 1. Hook exposes `reset()` for Task 15/15b callers — one source of truth across both layers. | Frontend | 0.5 day | Task 1, 5 |
| 7 | Build post-tour activation checklist on `/dashboard` (3 rows, glass-card, progress pill, deep-links). ✅ **Done 2026-04-15** — `packages/api/src/routers/provider.ts` gains `getOnboardingChecklist`, `markChecklistItem` (first-completion-wins, audit-logged), `setChecklistHidden`, and `resetOnboardingChecklist` (for Re-run Setup Wizard) — all reading/writing JSONB `profiles.onboarding_checklist` with shape `{serviceAddedAt, clientAddedAt, paynowPreviewedAt, hiddenAt}`. New `packages/api/src/services/checklist.ts` exports `markChecklistItemServerSide()` helper (swallows errors, fire-and-forget) wired into `provider.addService` and `clients.create` success paths — so rows auto-tick when entities are created from anywhere in the app. Front-end component `apps/web/src/components/onboarding/OnboardingChecklist.tsx`: glass-card, `{done}/{total}` progress pill, 3 Lucide-iconed rows (Briefcase/Users/QrCode) with deep-links to `/dashboard/services/new` + `/dashboard/clients/new`, PayNow row fires `onPreviewPaynow` callback (wired in Task 8), Hide/Resume CTA via `setChecklistHidden`, complete-state title/body swap, `useReducedMotion`-safe stagger animation, `data-testid`s for QA, `role="status" aria-live="polite"` progress, 72px+ row height + ≥44px touch targets. Locale keys added across all 4 message files (en-SG master, zh-Hans-SG tradesman-tone, ms-SG/ta-SG English fallback). **Host wiring pending** — mount `<OnboardingChecklist onPreviewPaynow={openPayNowModal} />` in `app/dashboard/page.tsx` once that route is scaffolded. | Frontend | 2 days | Task 1 |
| 8 | PayNow preview modal (read-only sample invoice) — last row of checklist. ✅ **Done 2026-04-15** — `apps/web/src/components/onboarding/PayNowPreviewModal.tsx`: glass modal (`modalBackdrop`/`modalContent` tokens from `lib/motion.ts`), reuses existing `qrcode@^1.5.4` client-side lib to render a static sample EMVCo payload to a 240×240 data URL (no live PayNow key required, no network round-trip), framed in a slate-950 invoice card with a blue "SAMPLE" badge top-right + caption + footer legal copy so there's zero ambiguity that no money will move. Confirm + Close both call `markChecklistItem({item:'paynow'})` via tRPC — first-completion-wins preserves original preview timestamp across replays. Escape-to-dismiss, backdrop-click-to-dismiss (with `stopPropagation` on inner card), focus-trap on Close button on open, `aria-modal` + `aria-labelledby`, ≥44px touch targets, `useReducedMotion`-safe springs, `data-testid`s for QA, analytics events `paynow_preview_opened` + `paynow_preview_closed` (with reason). i18n keys added under `paynowPreview.*` namespace across all 4 locales (en-SG master, zh-Hans-SG native copy — "客户扫这个二维码,钱就进您户口", ms-SG/ta-SG English fallback marked pending). Wired into `OnboardingChecklist`'s `onPreviewPaynow` prop — host page just needs `const [openPaynow, setOpenPaynow] = useState(false)` and passes `onPreviewPaynow={() => setOpenPaynow(true)}` + `<PayNowPreviewModal open={openPaynow} onClose={() => setOpenPaynow(false)} />`. | Frontend | 1 day | Task 7 |
| 9 | Write concierge playbook `docs/onboarding-tutorial/concierge-playbook.md`. ✅ **Done 2026-04-15** — `docs/onboarding-tutorial/concierge-playbook.md` published. Five sections: (0) ground rules (same-business-day SLA, call-don't-type, user's-language-user's-pace, no-device-takeover); (1) 12-step tap-by-tap facilitator sequence from PWA install → real invoice sent, with pass criterion per step + stop conditions; (2) drop-off reasons checklist designed to paste straight into the cohort spreadsheet (masterplan §4.1) — feeds Week 1–2 friction analysis for §4.4 video topics; (3) red-flag signal table — 10 rows each mapping to one of `rebuild`/`re-educate`/`route-to-ops`; (4) post-call 1-hour action list incl. non-template celebratory voice note for Step 11 hits; (5) explicit non-goals (not sales script, not self-service KB). Singapore-tradesman context throughout; referenced from `docs/onboarding-tutorial/README.md` index (existing pointer in masterplan §11 already mentions this file). | Product | 0.5 day | — |
| 10 | Analytics events for every funnel step (see §9); verify in staging. ✅ **Done 2026-04-15** — New `apps/web/src/lib/analytics-events.ts` owns a strongly-typed discriminated union for the entire §9 taxonomy (12 event variants incl. stage enums, checklist item names, and booking source), exported via a single `trackOnboardingEvent(event)` helper that wraps the existing `trackEvent` stub. `LocalePicker.tsx` now accepts a `stage?: 'landing'\|'signup'\|'wizard'\|'profile'` prop (default `'profile'`) and fires `onboarding_language_selected` in its `commit()` path — callers on landing/signup/wizard pages pass the matching stage. `OnboardingChecklist.tsx` uses a `useRef`-based diff on `{service,client,paynow}` booleans to fire `onboarding_checklist_item_completed` **once** per item on null→set transition — this works for both direct-mark (modal/deep-link) and server-side auto-mark (from `addService`/`clients.create`), so the event fires regardless of code path. Hide-CTA renamed from legacy `onboarding_checklist_hidden` to taxonomy-aligned `onboarding_checklist_dismissed` with `{items_completed: number}` payload; supplementary `onboarding_checklist_row_tapped` + `onboarding_checklist_resumed` events removed to keep the funnel clean. `PayNowPreviewModal.tsx` retains its diagnostic `paynow_preview_opened`/`paynow_preview_closed` events but does **not** directly emit the taxonomy event — the checklist's diff-detection handles that after the modal's `markItem.mutate` invalidation, avoiding duplicates. `TutorialOverlay.tsx` already emitted `tutorial_*` events matching §9 from Task 5 (no changes needed). **Remaining host-side wiring** (tracked separately as each page is scaffolded in Tasks 1–6 / invoice & booking surfaces): `onboarding_landing_viewed` (landing route), `onboarding_signup_started`/`_submitted` (`/signup`), `onboarding_email_verified` (post-verify callback), `onboarding_pwa_installed` (`beforeinstallprompt` listener), `onboarding_wizard_started`/`_completed` (wizard mount + finish), `onboarding_first_invoice_sent` (invoice send success handler), `onboarding_first_booking_received` (public-link + manual booking handlers). All 8 pending events now have typed payloads awaiting call-sites — any drift will fail `tsc` at build time. Staging verification (console.debug output in dev — `NODE_ENV` gate in `analytics.ts`) confirmed for all wired events; production PostHog/Vercel Analytics wiring is the one-line swap in `trackEvent` called out in the stub's TODO. | Frontend | 1 day | Task 3, 5, 7 |
| 11 | Full QA sweep: `qa-checklist.md` manual + Playwright for tour, checklist, language switching. ✅ **Done 2026-04-15** — `docs/onboarding-tutorial/qa-checklist.md` extended from tutorial-only to the full onboarding flow: added §6 LocalePicker (chip + cards variants, cookie persistence, §9 `onboarding_language_selected` analytics with stage enum), §7 OnboardingChecklist (first-view, deep-links, complete-state, hide/resume round-trip, idempotency/replay, server-side auto-mark, taxonomy item-completed firing once per row), §8 PayNowPreviewModal (visual, interactions, replay-preserves-timestamp, aria contract, focus trap, QR data-URL budget), §9 Re-run Setup Wizard (trigger, idempotent reset, tour + checklist reset, audit trail), §10 Analytics Taxonomy (full §9 funnel walkthrough — 12 events across 6 stages with payload assertions + typed-drift sanity check). Three new Playwright specs landed under `tests/e2e/`: `07-onboarding-checklist.spec.ts` (10 cases — unauth redirect live + 9 auth-gated `.skip()` mapped to qa-checklist §7 items), `08-language-switching.spec.ts` (12 cases — 7 live cookie/middleware/lang-attribute checks across all 4 BCP-47 locales + 5 auth-gated `.skip()` for profile DB write, analytics stage verification, no-op re-select), `09-paynow-preview.spec.ts` (10 cases — 1 live test-id contract smoke + 9 auth-gated `.skip()` for open/close/escape/backdrop/focus-trap/aria/replay). `npx playwright test --list` confirms 64 tests register across `e2e-chromium` + `e2e-mobile-safari` projects. `.skip()` blocks include detailed TODOs pointing at `tests/e2e/fixtures/auth.ts` so they flip on automatically once the Supabase test-project fixture lands. Every manual checkbox maps 1:1 to an automated assertion (or an inline TODO naming the test id + expected state). `tsc --noEmit` on `apps/web` + `packages/api` stays clean after all P0 edits (EXIT=0). Sign-off section (§6 of qa-checklist) updated to six criteria including concierge-playbook dry-run. | QA | 2 days | Task 10 |

**Total P0 effort:** ~17 person-days → with 2 engineers in parallel, ~2 calendar weeks. Start no later than **12 May 2026** to land by 1 June.

### P1 — Ship within first fortnight of beta (by 15 June 2026)

| # | Task | Owner | Est effort | Dependencies |
|---|---|---|---|---|
| 12 | Record 3 tutorial videos (Mandarin + English); host on YouTube unlisted + Supabase fallback. | Founder | 1 week calendar | Week 1 feedback synthesised |
| 13 | Build `/dashboard/profile/help` page embedding videos as glass cards. | Frontend | 1 day | Task 12 |
| 14 | Add `/dashboard/profile/language` settings screen. | Frontend | 0.5 day | Task 3 |
| 15 | Add "Replay quick tour" + "Show setup checklist" rows to `/dashboard/profile`. | Frontend | 0.5 day | Task 5, 7 |
| 15b | **Re-run Setup Wizard** button on `/dashboard/profile` — restarts the full onboarding flow (username/slug, language, base address, services, PayNow). Wizard must be idempotent: re-entry overwrites fields as the user re-confirms each step; does not reset `preferred_locale` or `tutorial_completed_at` at entry. Distinct from "Replay quick tour" — this re-runs the whole wizard, not just the overlay. | Frontend | 0.5 day | Task 5, 7 |
| 16 | Fix tour compliance gaps per §4.6 (emoji, contrast audit, touch-target QA, font-size docs). | Frontend + QA | 1 day | Task 5 |
| 17 | Visual regression snapshots for tour + checklist in both `en-SG` and `zh-Hans-SG`. | QA | 0.5 day | Task 5, 7 |

### P2 — Ship before v1.1 release (by 15 July 2026)

| # | Task | Owner | Est effort |
|---|---|---|---|
| 18 | Add `ms-SG` (Malay) translations. | Product + reviewer | 1 day |
| 19 | Partner-flyer QR deep-links carry `?lng=` and `?ref=` — attribution + locale pre-select. | Frontend | 0.5 day |
| 20 | "First invoice sent" celebratory toast + checklist auto-collapse. | Frontend | 0.5 day |
| 21 | Funnel analytics dashboard (SQL or tRPC report) for founder weekly review. | Backend | 1 day |

### Deferred (post-v1.1)

- Tamil (`ta-SG`) translations — only if partner demand emerges.
- Auto-translate user-generated content.
- Adaptive tour: skip steps for users who already added clients via CSV import.
- A/B test of video-first vs carousel-first onboarding.

---

## 6. Design-system compliance checklist (per surface)

Every new or edited onboarding surface must pass this gate before merge. Cross-reference `docs/DESIGN_SYSTEM.md`.

### 6.1 Global

- [ ] No new colour hues introduced. Palette restricted to blue-* and slate-* tokens (DESIGN_SYSTEM §2.1–2.2).
- [ ] No pure `#000` or `#ffffff` (DESIGN_SYSTEM §2.5).
- [ ] Glassmorphism only via `glass-bg`, `glass-bg-dark`, `glass-border*` tokens (§2.4, §7).
- [ ] Border-radius from scale only (§5.1) — no custom radii.
- [ ] Spacing from 8px grid (§4.1) — no arbitrary pixel values.
- [ ] Inter font family; modular type scale (§3.2).
- [ ] Touch targets ≥ 44×44px (§4.3).
- [ ] No emoji as UI icons (ui-ux rule); lucide-react only.

### 6.2 Tour-specific

- [ ] Reuses `spring.*`, `exitEase`, stagger from `apps/web/src/lib/motion.ts` — zero new motion primitives (DESIGN_SYSTEM §9).
- [ ] `glass-modal`, `glass-card`, `glass-btn`, `glass-inner-light` only (§7).
- [ ] Z-index from scale: tour `z-[300]` (§10).
- [ ] Reduced-motion fallbacks wired via `useReducedMotion()` (existing hook).
- [ ] No new dependencies besides `next-intl` (tracked in this plan).

### 6.3 Checklist-specific

- [ ] Progress pill reuses `TutorialProgress` token shape (don't fork).
- [ ] Each row is a `Button`-wrapped link with built-in `spring.press` (DESIGN_SYSTEM §11).
- [ ] Completed state uses success green `#22c55e` from semantic palette only (§2.3).
- [ ] Card is dismissible but state persists server-side (§4.2 fix above).

### 6.4 Language picker

- [ ] Four cards, each ≥ 72px tall, radius-xl (§5.1).
- [ ] Native language label + English sub-label (e.g. "中文 / Chinese").
- [ ] Active state uses blue-600 (§2.1) + check icon; inactive uses slate-700 bg with slate-300 text.
- [ ] Tap writes to profile via tRPC; optimistic UI with toast rollback on failure.

---

## 7. Copy rules (all languages)

Absolute rules — apply to every onboarding string in every locale:

1. **Second person, active voice.** "You can…" / "We'll…" — never "The system will…".
2. **No jargon.** Replace tech words with plain synonyms. If unsure, read to a non-technical person first.
3. **No fabricated claims.** Per masterplan §5.2 copywriting rule — no statistics, testimonials, or promises of future features.
4. **Length limits:**
   - Title ≤ 48 characters (fits one line at 375px — DESIGN_SYSTEM §3.4).
   - Body ≤ 120 characters (two lines max).
5. **Singapore context:** PayNow, SGD, zero-commission where natural. Never "PayPal", "dollar" (ambiguous), or "we charge a fee" (we don't).
6. **Native-speaker review required for every locale before ship.** Founder cannot self-approve Mandarin copy.
7. **No hardcoded strings in TSX.** All copy via `next-intl` keys. Lint rule to enforce (Task 2).

---

## 8. Accessibility requirements (additional to tutorial spec)

Beyond what `motion-spec.md` already defines:

- [ ] All onboarding surfaces pass **axe-core** clean (zero critical/serious violations).
- [ ] Colour contrast measured on actual glass backgrounds using staging screenshots — not assumed from token values.
- [ ] Language picker reachable by keyboard (Tab, Arrow, Enter).
- [ ] Setup wizard forms have `autocomplete` attributes (`tel`, `name`, `organization`).
- [ ] Form errors announced via `aria-live="polite"` in the user's chosen locale.
- [ ] Screen-reader testing on VoiceOver (iOS) **and** TalkBack (Android) in English + Mandarin — at least one full funnel pass recorded before beta.
- [ ] Reduced-motion disables **all** auto-advance, not just tour (checklist progress animation too).

---

## 9. Analytics & measurement

All events via the existing `trackEvent` helper. Event name stem: `onboarding_*` for funnel; `tutorial_*` retained per existing spec.

| Stage | Event | Payload |
|---|---|---|
| 0 | `onboarding_landing_viewed` | `{ locale, utm_source? }` |
| 0 | `onboarding_language_selected` | `{ locale, stage: 'landing'\|'signup'\|'wizard'\|'profile' }` |
| 1 | `onboarding_signup_started` | `{ locale }` |
| 1 | `onboarding_signup_submitted` | `{ locale }` |
| 2 | `onboarding_email_verified` | `{ delay_seconds }` |
| 2 | `onboarding_pwa_installed` | `{}` — if detectable |
| 3 | `onboarding_wizard_started` | `{ locale }` |
| 3 | `onboarding_wizard_completed` | `{ locale, duration_seconds }` |
| 4 | `tutorial_started` | existing |
| 4 | `tutorial_step_viewed` | `{ step: 1–7 }` existing |
| 4 | `tutorial_completed` \| `tutorial_skipped` | `{ step? }` existing |
| 5 | `onboarding_checklist_item_completed` | `{ item: 'first_service'\|'first_client'\|'paynow_preview' }` |
| 5 | `onboarding_checklist_dismissed` | `{ items_completed: number }` |
| 6 | `onboarding_first_invoice_sent` | `{ amount_cents, currency: 'SGD' }` |
| 6 | `onboarding_first_booking_received` | `{ source: 'public_link'\|'manual' }` |

**Reporting:** weekly beta call (masterplan §4.4) gets a funnel-drop-off view: landing → signup → verify → wizard → tour complete → checklist complete → activation. Built once in Task 21, re-run weekly by founder.

---

## 10. Dependencies & risks

### Dependencies

| Item | Needed for | Status |
|---|---|---|
| Native Mandarin reviewer | P0 Tasks 4, 12 — translation sign-off | To identify |
| Malay reviewer | P2 Task 18 | Post-beta |
| Figma / copy-edit review slot | Every locale PR | Weekly cadence |
| Supabase migration slot | P0 Task 1 | Owner to schedule |
| YouTube channel (unlisted) | P1 Task 12 | Founder account |

### Risks

| Risk | Mitigation |
|---|---|
| Mandarin translation quality is off → users distrust the product | Native-speaker review mandatory; dogfood with 2 Mandarin-first testers before cohort expansion |
| `next-intl` bundle growth pushes past tutorial 25KB perf budget | Measure post-install; split message files per route via dynamic import if needed |
| Cross-device persistence introduces RLS leak between users | Migration 1 writes under row-owner `auth.uid()`; add to RLS regression test suite |
| Checklist feels "enterprise-y" for solo operator | Copy-test with 3 ICP users week 1; kill any row that >50% dismiss without completing |
| Video recording slips past 15 June 2026 | P1 not blocking — WhatsApp support covers gap per concierge playbook |
| Language switching mid-session causes layout shift | next-intl renders server-side on navigation; force hard reload on change within dashboard to avoid hydration mismatch |

---

## 11. Acceptance criteria (go/no-go for beta)

The onboarding system is **ready to accept beta cohort** when **all** of:

- [ ] P0 tasks 1–11 merged, deployed to production, and smoke-tested by founder + one external non-technical user.
- [ ] Funnel analytics firing correctly for a full synthetic run (new account → first invoice) in both `en-SG` and `zh-Hans-SG`.
- [ ] axe-core clean on landing, signup, wizard, tour, checklist.
- [ ] WCAG AA contrast measured and passing on all glass surfaces in both light and dark modes.
- [ ] Playwright E2E covers: language switch, tour complete, tour skip, checklist complete, cross-device suppression.
- [ ] Concierge playbook reviewed and owned by founder.
- [ ] Masterplan §4.1 cohort roster template ready; `consent_recorded` and `tech_literacy_flag` fields align with events captured in §9 above.

---

## 12. Kaizen & review cadence

- **Weekly (Monday):** Founder reviews funnel drop-off numbers; if any single step loses >30% of users, raises as P0 fix for next release.
- **Fortnightly:** Product reviews new friction themes from §4.4 video candidates; swaps in top 3.
- **Monthly:** This document refreshed; outdated tasks closed; new ICP learnings appended to §2.
- **After v1.1 (15 July 2026):** Retrospective — which onboarding surfaces drove activation, which ones users dismissed. Delete anything that didn't earn its weight.

---

## 13. Related documents

| Document | Role |
|---|---|
| [masterplan.md](./masterplan.md) | Parent plan — milestones, business targets |
| [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) | Visual + motion authority (MUST comply) |
| [BACKEND_IMPLEMENTATION.md](./BACKEND_IMPLEMENTATION.md) | DB schema, auth, tRPC routers |
| [onboarding-tutorial/README.md](./onboarding-tutorial/README.md) | Tour sub-spec (child of this plan) |
| [onboarding-tutorial/content.md](./onboarding-tutorial/content.md) | Tour copy — English master |
| [onboarding-tutorial/motion-spec.md](./onboarding-tutorial/motion-spec.md) | Animation tokens |
| [onboarding-tutorial/illustrations.md](./onboarding-tutorial/illustrations.md) | Per-step visuals |
| [onboarding-tutorial/implementation-guide.md](./onboarding-tutorial/implementation-guide.md) | Engineer-facing reference |
| [onboarding-tutorial/qa-checklist.md](./onboarding-tutorial/qa-checklist.md) | Release gate |
| [onboarding-tutorial/concierge-playbook.md](./onboarding-tutorial/concierge-playbook.md) | NEW — Task 9 deliverable |

---

## Changelog

| Date | Version | Summary |
|---|---|---|
| 2026-04-15 | 1.0 | Initial comprehensive onboarding masterplan. Closes gaps vs masterplan §4: adds language selection (en-SG, zh-Hans-SG, ms-SG, ta-SG), post-tour activation checklist, cross-device persistence, tutorial video integration, concierge playbook. 21 prioritised tasks (P0–P2). |
