# ServiceSync SG — Vertical SaaS Beta Masterplan (Living Document)

> **For maintainers:** This file is the single source of truth for **milestones, acceptance criteria, and operating rituals** for the ServiceSync PWA beta (independent Singapore tradesmen). Update it **incrementally** (Kaizen): small, frequent edits; one logical change per commit when possible; note significant shifts in the [Changelog](#changelog) at the bottom.
>
> **Related implementation plans:** Feature-level execution plans may live under `docs/plans/YYYY-MM-DD-<feature-name>.md` when using a bite-sized implementation workflow.

| Field | Value |
|--------|--------|
| **Version** | 1.0 |
| **Last updated** | 2026-04-01 |
| **Owner** | (assign: product / founder) |
| **Product** | ServiceSync V2 — `servicesync-v2` monorepo |

---

## Related documentation index

| Document | Purpose |
|----------|---------|
| [audit-tracker.md](../audit-tracker.md) | Pre-launch audit phases (security through polish); tracks code-level remediation. |
| [BACKEND_IMPLEMENTATION.md](./BACKEND_IMPLEMENTATION.md) | Architecture: Supabase, tRPC, RLS, routers, payment flows, env vars. |
| [AGENTS.md](../../AGENTS.md) (parent ServiceSync SG guide) | High-level value proposition, stack summary, domain concepts (when not duplicated here). |
| [.env.example](../.env.example) | Deployment and integration environment variables. |

---

## 1. Roadmap vs repository (source of truth)

Strategic documents sometimes name vendors or auth products before a final decision. **The codebase is authoritative** for what is implemented today. This section prevents the masterplan from contradicting the repo while preserving **business intent** (regulated PayNow, merchant approval, Singapore operators).

| Strategic / slide-deck wording | **Implemented in ServiceSync V2 today** |
|--------------------------------|----------------------------------------|
| “Clerk authentication” | **Supabase Auth** — email/password, session handling, `auth.users` + `profiles`. Routes: `/login`, `/signup`, `/auth/callback`, etc. See [BACKEND_IMPLEMENTATION.md](./BACKEND_IMPLEMENTATION.md). |
| “HitPay sandbox / staging PayNow QR” | **Roadmap / integration decision.** Today: **NETS-oriented** configuration (`NETS_*` in [.env.example](../.env.example)), PayNow QR generation services, webhook route for payment callbacks. **HitPay** may be adopted as the primary acquiring path or run as a **dual-path** (document the decision before changing production secrets). |
| “Next.js + Supabase + auth by date X” | **Delivered stack:** Next.js App Router (`apps/web`), Supabase Postgres + RLS (`packages/db`), tRPC API (`packages/api`), Supabase Auth. |

**Action when vendor changes:** Update [.env.example](../.env.example), webhook handlers, and this table in the same change set; re-run security and payment regression checks.

---

## 2. North Star and ideal customer profile (ICP)

**North Star (beta):** Independent home-service technicians in **Singapore** (aircon, plumbing, electrical, and adjacent trades) can run daily operations—**schedule**, **CRM**, **invoicing**, **PayNow/cash collection**, and **retention touchpoints**—from a **mobile-first PWA** without paying platform commission on the job itself (zero-commission positioning vs marketplace models).

**ICP traits:**

- Solo or small crew; owner-operator mindset.
- High mobile usage on-site; intermittent connectivity (basements, lifts).
- Variable digital literacy; UI must tolerate error and support guided onboarding.
- Compliance context: PDPA for personal data; IRAS-relevant record-keeping for invoices (see backend doc).

**Non-goals for this beta masterplan (scope boundary):**

- Building a consumer marketplace or auto-assigning jobs (regulatory positioning: technicians self-select work).
- Multi-country expansion beyond SG-specific payments and norms in this phase.
- White-label reseller program before partnerships milestone exit criteria are met.
- Promising HitPay/Clerk in copy **unless** the integration is live in production (copywriting rule: no unverified claims).

---

## 3. Milestone 1 — Product development (MVP completion)

**Theme:** Develop and deploy a **fully functional MVP** tailored for independent tradesmen, then harden for field use.

### 3.1 Prototyping and design

| Target | Detail |
|--------|--------|
| **Date** | 15 April 2026 |
| **Intent** | “Clickable” prototype approved before engineering locks final UX for beta. |

**Acceptance criteria**

- [ ] **Clickable definition:** All primary technician journeys are navigable with realistic copy: sign-up → onboarding → dashboard → schedule → invoice creation → payment path (QR/cash) → client detail; plus homeowner **public booking** path to `/p/{slug}` (or UUID) where applicable.
- [ ] **Owner sign-off:** Named approver (e.g. founder + design) records approval (email, Notion, or ticket link).
- [ ] **Artifact link:** Figma / Framer / hosted HTML — URL stored in this section when available: _(add link)_.

**Validation:** Walkthrough recorded (Loom) ≤ 15 minutes covering the flows above.

---

### 3.2 Core infrastructure (aligned to actual stack)

| Target (original wording) | **Aligned acceptance** |
|---------------------------|-------------------------|
| “Next.js + Supabase + Clerk by 5 May 2026” | **By 5 May 2026:** Production-capable deployment of **Next.js** + **Supabase** (DB + Auth + Storage as used) + **tRPC** API boundary; no requirement to ship Clerk unless product reopens auth migration. |

**Acceptance criteria**

- [ ] **Auth:** Supabase Auth flows work end-to-end (signup, login, password reset, session expiry behavior per [audit-tracker.md](../audit-tracker.md) Phase 5).
- [ ] **Data:** RLS enforced on tenant data; `profiles` and core entities match [BACKEND_IMPLEMENTATION.md](./BACKEND_IMPLEMENTATION.md).
- [ ] **API:** tRPC procedures used for dashboard-critical paths as per audit completion.
- [ ] **Optional future epic:** If **Clerk** is still desired, log a separate epic with **RICE** score (reach, impact, confidence, effort) before engineering spends >1 sprint on migration.

**Validation:** `npm run build` at monorepo; smoke test on staging URL with a test account.

---

### 3.3 Payments integration (HitPay vs current stack)

| Target | Detail |
|--------|--------|
| **Date** | 15 May 2026 |
| **Intent** | Validate **core payment flow and data integrity** using a **sandbox/staging** path; move toward **dynamic PayNow QR** on real invoices. |

**Acceptance criteria**

- [ ] **Sandbox test:** At least one **end-to-end** run: create invoice → generate PayNow QR payload / link → **simulate or receive** sandbox webhook → invoice status transitions correctly → audit fields (`paynow_ref`, timestamps) populated as designed.
- [ ] **Data integrity checks:** Amounts remain **integer cents** end-to-end; no double application of fees; webhook idempotency considered for duplicate posts.
- [ ] **If HitPay is the chosen provider:** Document API keys scope (test vs live), rotation, and failure modes in `docs/` and [.env.example](../.env.example).
- [ ] **Rollback plan:** If HitPay slips, **continue** on current NETS/webhook integration for internal dogfood; do not block beta recruitment on a single vendor if sandbox is unstable—document the fallback in the [Dependencies / risks](#63-dependencies-and-risks-register) table.

**Validation:** Written test script or checklist + screenshot/log of one successful sandbox run; code review on `apps/web/app/api/webhooks/` (or equivalent).

---

### 3.4 Internal testing and observability

| Target | Detail |
|--------|--------|
| **Date** | 30 May 2026 |
| **Intent** | Closed-loop testing; **critical** pre-launch defects resolved; errors visible in production via **Sentry**. |

**Acceptance criteria**

- [ ] **Sentry:** `NEXT_PUBLIC_SENTRY_DSN` (and server DSN if split) set in production; errors from `error.tsx` / `global-error.tsx` and server paths reach Sentry.
- [ ] **Quality gate (every release):** `npm run lint`, `npx tsc --noEmit` / workspace `typecheck`, `npm run build` — no merge to `main` / production branch with failures (see project CLAUDE rules).
- [ ] **Security-sensitive changes:** Run `npx @claude-flow/cli@latest security scan` or project-prescribed scan after auth/payment/RLS changes.
- [ ] **Triage discipline:** For production issues, follow **systematic debugging** — reproduce → root cause → fix → regression check; avoid symptom-only patches.

**Validation:** Sentry “smoke” error triggered in staging and resolved; checklist attached to release ticket.

---

### 3.5 Dependencies and risks register (Milestone 1)

**Dependencies**

| Dependency | Needed for | Owner | Status |
|------------|------------|-------|--------|
| HitPay (or chosen) merchant account | Live PayNow settlement branding / API access | | |
| ACRA / business registration | Trust, invoicing, bank onboarding | | |
| Supabase project + secrets | All environments | | |

**Risks**

| Risk | Mitigation | Review date |
|------|------------|-------------|
| Payment API slips | Sandbox first; fallback path; narrow beta scope | Monthly |
| Assumption: stack “just works” with local gateways | Integration tests + one manual E2E per release | Per release |

---

### 3.6 Link to engineering audit baseline

The [audit-tracker.md](../audit-tracker.md) phases **1–7** are largely **complete** in the repository snapshot used for this masterplan. Treat that as the **technical baseline** for starting beta: security, tRPC wiring, UX, launch-critical items, high-priority polish, Sentry, Upstash rate limiting, etc. New beta work should **append** new tickets rather than reopen closed audit items unless regression is found.

**Expected outcome (Milestone 1):** A **stable, production-ready web application** capable of **authentication**, **scheduling**, and **PayNow invoice generation** (subject to the payment provider row in the reconciliation table above).

---

## 4. Milestone 2 — User feedback and testing (beta launch and iteration)

**Theme:** Onboard an initial **cohort** of early adopters, run **field testing**, and iterate from **direct feedback**.

### 4.1 Beta recruitment

| Target | Detail |
|--------|--------|
| **Date** | 1 June 2026 |
| **Cohort size** | 20 local independent technicians (aircon, plumbers, etc.). |
| **Channel** | Direct hardware-store outreach (see Milestone 3 synergy). |

**Acceptance criteria**

- [ ] **Cohort roster** exists with minimum fields: `name`, `trade`, `phone`, `onboarding_date`, `tech_literacy_flag` (low/med/high), `consent_recorded` (PDPA), `notes`.
- [ ] **Activation definition:** e.g. first **login** + **profile complete** (name + phone) within 7 days of invite — adjust if product changes.

**Validation:** 20 rows with signed-up dates; export stored in owned system (not only personal devices).

---

### 4.2 Concierge onboarding and guided testing

| Target | Detail |
|--------|--------|
| **Intent** | “Concierge onboarding” — human-assisted first runs; observe real-world usage. |

**Acceptance criteria**

- [ ] **Playbook:** One-page checklist: install PWA → login → create first client → first invoice → first payment path (or booking if that’s the lead use case).
- [ ] **Success proxy (pick one primary):** e.g. **first invoice marked paid** OR **first booking completed** within 14 days of signup — document which metric is the beta KPI driver.
- [ ] **Support channel:** WhatsApp or phone with SLA expectation for beta (e.g. same-day during business hours).

**Validation:** Sample of 5 users completes checklist with facilitator notes.

---

### 4.3 Tutorial videos (local language)

| Target | Detail |
|--------|--------|
| **Date** | 15 June 2026 |
| **Count** | 3 videos, each **under 60 seconds**. |
| **Language** | Local vernacular / Mandarin as appropriate for ICP. |

**Acceptance criteria**

- [ ] Topics driven by **top 3 friction themes** from **weeks 1–2** of guided testing (synthesize from call notes — do not invent themes).
- [ ] **Copy rule:** No fabricated statistics or testimonials; scripts cite **observed** friction only.

**Validation:** Links hosted (YouTube unlisted / internal) + embedded from help surface or WhatsApp.

---

### 4.4 Weekly feedback calls

| Target | Detail |
|--------|--------|
| **End date** | 30 June 2026 |
| **Cadence** | Weekly call with **each** of the 20 users (or structured small groups if agreed). |

**Standing agenda (template)**

1. Jobs completed / invoices issued (rough counts).
2. Failures: app errors, confusion, payment misses.
3. Feature requests (capture verbatim).
4. Next week’s focus.

**Acceptance criteria**

- [ ] Call notes stored per user per week (lightweight: spreadsheet or CRM).

**Validation:** At least **4 weeks** of notes for ≥80% of cohort before scaling marketing spend.

---

### 4.5 Version 1.1 deployment

| Target | Detail |
|--------|--------|
| **Date** | 15 July 2026 |
| **Content** | Major update: **top 5** improvements + bug fixes from beta. |

**Prioritization**

- Use **RICE** (Reach, Impact, Confidence, Effort) for candidate items — see [Product toolkit](#85-product-toolkit-rice--discovery).

| # | Item | R | I | C | E | Score (manual) |
|---|------|---|---|---|---|------------------|
| 1 | | | | | | |
| 2 | | | | | | |
| 3 | | | | | | |
| 4 | | | | | | |
| 5 | | | | | | |

**Validation:** Release notes + Sentry error budget not worse than prior sprint.

---

### 4.6 Success metrics (beta cohort)

| Metric | Target | **How to measure (define before beta starts)** |
|--------|--------|-----------------------------------------------|
| **DAU / MAU** | > 40% among beta cohort | **DAU:** distinct users with ≥1 session/day (define: Supabase auth activity, Vercel Analytics page views, or custom event — pick one and instrument consistently). **MAU:** distinct users with ≥1 session in rolling 28 days. Timezone: **Asia/Singapore**. |
| **Invoices per user per week** | Average ≥ 5 | Query: count `invoices` rows per `provider_id` per calendar week (SG), status in paid states; denominator = active beta users that week. |

**Acceptance criteria**

- [ ] Measurement SQL or tRPC report documented and runnable by founder.
- [ ] Baseline week 0 captured before calling success.

---

### 4.7 Dependencies and risks (Milestone 2)

**Dependencies:** Successful recruitment of willing testers; devices that can run a modern PWA.

**Risks**

| Risk | Mitigation |
|------|------------|
| Low tech literacy → false-negative feedback | Concierge onboarding; video; simplify default paths; separate “could not use app” from “does not need product” in notes |
| Technicians avoid real-client invoicing | Incentivize first real invoice; support on first client conversation |

**Expected outcome:** **Validated product** with measured engagement and invoicing behavior in the cohort, plus a prioritized v1.1 backlog.

---

## 5. Milestone 3 — Business development and partnerships

**Theme:** **Strategic collaborations** (hardware suppliers, later property networks) to build a **distribution pipeline** for acquisition after beta proves retention.

### 5.1 Channel strategy (ORB framing)

Per launch-strategy thinking: use **borrowed** attention (hardware stores, agents) to drive prospects to **owned** assets (WhatsApp opt-in, landing page, in-app signup).

| Channel type | Examples for ServiceSync |
|--------------|--------------------------|
| **Owned** | Technician email/SMS list, WhatsApp templates you control, website, in-app |
| **Rented** | Social posts, paid ads (use sparingly pre-validation) |
| **Borrowed** | Hardware store counters, property agent networks |

---

### 5.2 Targets and definitions of done

| Target | Date | **Definition of done** |
|--------|------|------------------------|
| Identify and pitch **5** hardware stores (Ubi + Kaki Bukit) for affiliate pilot | 30 Jun 2026 | List of 5 stores with contact person + pitch date + outcome note |
| **2** signed partnership agreements or **LOIs** | 15 Jul 2026 | LOI = signed PDF or email from authorized owner + named contact for referrals |
| **Marketing asset kit** (digital + physical) | 20 Jul 2026 | Kit checklist below completed + stored in shared drive |
| **3** property management agencies contacted; **≥1** follow-up meeting | 31 Jul 2026 | Log of outreach + meeting held (calendar invite counts) |

**Marketing asset kit checklist**

- [ ] One-pager PDF: who it’s for, zero-commission line, how to sign up.
- [ ] Flyer printable A5 (SG English + short Chinese if targeting hawker/store notice boards).
- [ ] WhatsApp broadcast **templates** (3 variants: intro, follow-up, reminder) — **no fabricated claims** (copywriting rule).
- [ ] QR code to `/signup` or partner-specific UTM link for attribution.

---

### 5.3 Competitive and alternatives (living)

**Positioning:** ServiceSync is **tooling for independents** (schedule, CRM, invoice, PayNow), not a job marketplace taking a cut. Detailed competitor matrix may live in a separate brief; until then, record **only verified** facts. If naming competitors, cite public sources.

---

### 5.4 Dependencies and risks (Milestone 3)

**Dependencies:** Store owners willing to act as affiliates; clarity on referral incentive (if any).

**Risks**

| Risk | Mitigation |
|------|------------|
| High rejection from brick-and-mortar | Start with stores already selling to contractors; lead with “help your regulars get paid faster” not “software affiliate” |
| Unfamiliarity with SaaS affiliate models | Simple poster + WhatsApp handoff; pay per activated technician if budget allows |

**Expected outcome:** **Strategic partnerships** that expand reach and establish a **B2B2C distribution** path toward Q4 scale; **target completion** for this milestone block: **31 July 2026**.

---

## 6. Cross-cutting operating model

### 6.1 Release quality gate

Before merging or deploying:

1. `npm run lint` (workspace / app as applicable)
2. `npm run typecheck` or `tsc --noEmit`
3. `npm run build`
4. Sentry release health spot-check after deploy

### 6.2 Beta incident and bug process

1. **Capture:** Sentry issue or user report with steps.
2. **Investigate:** Reproduce; identify root cause before code change.
3. **Fix:** Minimal change + test or manual verification.
4. **Communicate:** Note in weekly beta summary if user-facing.

### 6.3 Kaizen cadence

- **Monthly:** Review this masterplan — dates, risks, metrics.
- **Quarterly:** RICE refresh for backlog; prune non-goals.
- **After each major learn:** Update Expected outcomes if the strategy shifts.

---

## 7. Idea parking lot (non-committing backlog)

_Use this section to capture ideas without derailing milestones. Promote to RICE only after discovery._

| Idea | Captured | Notes |
|------|----------|-------|
| OneMap SG address autocomplete for client/booking forms | 2026-04-02 | KI-7: Free API, reduces manual entry friction for technicians. Phone formatting already done (task 6.3). |

---

## 8. Product toolkit (RICE and discovery)

**RICE** (from PM toolkit practice): **Reach** × **Impact** × **Confidence** ÷ **Effort**. Use relative impact (e.g. massive/high/medium/low) and effort (person-weeks) consistently.

**Customer discovery:** Weekly beta calls feed themes; group similar pain before building.

---

## 9. Appendix A — Audit tracker snapshot (reference)

The repository [audit-tracker.md](../audit-tracker.md) lists phases **1–7** with items marked complete, including: security, tRPC wiring, data integrity, UX, launch-critical (terms, privacy, deletion, session, `.env.example`), high-priority UX/error handling, and polish (PWA, analytics, Sentry, Redis rate limit, booking confirmation URL, onboarding guard, schedule delete guard, earnings empty state, cookie consent).

**Open known issues** at time of writing: KI-6 (client address in booking form) is now resolved. KI-7 (address autocomplete via OneMap SG) is deferred to post-launch product backlog. KI-8 (specific client UUID not found) was confirmed as expected behavior, not a code bug. All known issues are now resolved or triaged.

---

## 10. Appendix B — Glossary

| Term | Meaning |
|------|---------|
| **DAU / MAU** | Daily / monthly active users — use one consistent activity definition. |
| **Concierge onboarding** | Human-assisted first setup for low-literacy users. |
| **LOI** | Letter of Intent — non-binding unless legal says otherwise. |
| **PWA** | Progressive Web App; installable on home screen. |
| **PayNow** | Singapore fast payment; QR often shown as SGQR. |
| **Escrow (in-app)** | Deposit holding narrative in product copy — align with actual ledger tables (`escrow_releases`, etc.). |
| **RLS** | Row-Level Security (Supabase Postgres). |
| **tRPC** | Typed API layer between Next.js and backend procedures. |

---

## Changelog

| Date | Version | Summary |
|------|---------|---------|
| 2026-04-01 | 1.0 | Initial masterplan: three milestones, acceptance criteria, stack reconciliation, ORB/RICE/quality gates, appendices. |
