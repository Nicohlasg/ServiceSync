# Marketing Asset Kit (LR-4.5)

Source copy and specs for pre-launch collateral. The design artifacts (PDF,
A5 flyer, QR image) are produced by the founder or a designer; this doc is
the single source of truth for the *words* and *layout requirements* so the
same positioning flows through every channel.

Ground rule (same as LR-4.1): **no fabricated stats, no fake testimonials**.
If a piece of collateral needs a number, it lands here only after we have
actual usage data from the beta cohort.

## 1. One-pager PDF (A4, EN)

### Headline
> **Keep every dollar you earn. Get paid the same day.**

### Sub-headline
> Zero-commission business-in-a-box for Singapore tradesmen.

### Three-panel body

| Panel | Headline | Body (≤ 25 words) |
|---|---|---|
| 1 | Invoice in under 60 seconds | Pick a client, pick a service, hit send. PayNow QR is already on the invoice. |
| 2 | Paid while you're still on site | Customer scans the QR. The invoice flips to paid. You're handed the next job. |
| 3 | Yours to keep — forever | Flat monthly subscription. No percentage cuts. No transaction fees beyond what the bank charges. |

### Footer
> Join the private beta at **servicesync.sg** · PDPA-compliant · Built in Singapore

**Design notes.** Dark background, single accent colour, large touch-friendly
QR at the bottom-right linking to `/signup?utm_source=flyer&utm_medium=pdf&utm_campaign=beta`.

## 2. A5 flyer (EN + 简体中文)

Half-sheet, portrait. EN on the front, 中文 on the back — same headline, same CTA.

### EN
- Headline: **Zero commission. PayNow ready. Built for SG trades.**
- Body: We do invoices, bookings, and payment collection so you can focus on the work.
- CTA: Scan to join the beta → `/signup?utm_source=flyer&utm_medium=a5&utm_campaign=beta-sgp`

### 中文 (简体)
- Headline: **零抽成。PayNow 收款。新加坡师傅专属。**
- Body: 发账单、排工、收款 — 一个 App 就搞定。你专心做工，剩下的我们来。
- CTA: 扫码加入内测 → 同上

Translation reviewed by a native speaker **before** print (add reviewer name +
date to `docs/marketing/translation-log.md` when that review happens).

## 3. WhatsApp broadcast templates (3)

Each template is ≤ 600 chars (WhatsApp recommended cap) and uses
language that matches the cohort's existing group culture. **Do not** use
gratuitous emojis. Never use auto-generated testimonials.

### Template A — Cold intro to a trade WhatsApp group

> Hi bros, sharing something that might help with the paperwork side. 
> 
> ServiceSync is a free beta for SG tradesmen — PayNow QR on every invoice, clients pay on the spot, we take zero commission. Monthly flat fee when we launch, beta users get 3 months free.
> 
> If you want to try: servicesync.sg/signup
> 
> No pressure. Happy to answer questions here.

### Template B — Warm intro after a coffee / chat

> Hey {name}, thanks for the kopi earlier. Here's the link we talked about: servicesync.sg/signup
> 
> Remember — beta is free, I'll sit with you for the first invoice to make sure it works. Just ping me when you're ready to set up.

### Template C — Trade association / SFA-adjacent channel

> Hi all, ServiceSync is a Singapore-built tool for home-service pros: invoicing, bookings, and PayNow collection in one mobile app. 
> 
> We're looking for 20 beta users (any trade) to shape the first release. Zero commission, flat subscription, first 3 months free.
> 
> Interested? servicesync.sg/signup. We'll reach out for a 15-min onboarding session.

## 4. UTM'd QR code

### Spec
- **URL:** `https://servicesync.sg/signup?utm_source={channel}&utm_medium={medium}&utm_campaign=beta`
- **Format:** SVG (scales to any print size without artefacts).
- **Error correction:** level H (30 %) — survives fold marks and scuffs.
- **Minimum print size:** 2.5 cm × 2.5 cm (under that, mid-range phones start to struggle).
- **Colour:** solid black on white in the module; a single-tone brand fill is acceptable if the logo block inside the QR stays ≥ 10 % of module area.

### Channels we generate distinct codes for
- `flyer-a5-en`
- `flyer-a5-zh`
- `pdf-onepager`
- `whatsapp-broadcast-a` / `-b` / `-c`
- `trade-expo-booth` (even if we don't book one — reserved)

Track generation in `docs/marketing/qr-codes.md` with filename + generation
date so we don't accidentally re-use a UTM'd code for a different channel.

## 5. Handoff checklist

Before any asset is printed or shared:

- [ ] Copy reviewed against `docs/masterplan.md` §3.1 (positioning) and §5.2 (launch assets).
- [ ] Every stat on the asset is either cited from source data or removed.
- [ ] UTM'd QR scans correctly on both iOS and Android physical devices.
- [ ] Translation review signed off in `docs/marketing/translation-log.md`.
- [ ] PDPA footer present on anything that touches personal data.
