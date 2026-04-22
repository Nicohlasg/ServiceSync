# Concierge Onboarding Playbook (LR-4.7)

One page. Hands-on. Pre-launch cohort only. The goal of a concierge session is **a working first invoice** by the end of the call — not a tutorial.

## Target
- **Time to first issued invoice:** ≤ 30 min from joining the call.
- **Time to first paid invoice (PayNow sandbox):** ≤ 45 min.
- **WhatsApp response SLA during beta:** 2 h within business hours (09:00–19:00 SGT, Mon–Sat).

## Pre-session (the evening before)

- [ ] Confirm the session on WhatsApp; include the meeting link (Google Meet or in-person location).
- [ ] Check the roster (`docs/beta/cohort-roster-template.csv`): `tech_literacy` ≤ 2 → allow 60 min slot instead of 30.
- [ ] Pre-email the PDPA consent copy (`docs/beta/pdpa-consent.md`) so they can read it without the clock ticking.
- [ ] Open a fresh Sentry tab so any errors during the call are visible in real time.

## In-session checklist

1. **Consent (5 min)** — walk through PDPA consent clause 2 aloud (per script). Sign + file.
2. **Account (3 min)** — watch them complete `/signup` on their own phone. Do not take over.
3. **Onboarding wizard (7 min)** — business name, phone, ACRA if applicable, one service. Skip the rest.
4. **First client (3 min)** — add a real upcoming customer.
5. **First invoice (5 min)** — issue a real invoice to that customer, small amount. Generate PayNow QR.
6. **Sandbox payment (5 min)** — walk them through what a paid invoice looks like using a sandbox transaction. Do not take real payment.
7. **WhatsApp handshake (2 min)** — send the auto-generated `wa.me` link from the invoice. Show what the customer sees.
8. **Wrap (≤ 5 min)** — offline mode, where settings live, how to reach us.

If you hit 60 min and aren't at step 5: **stop and schedule a second session**. A flustered first session is worse than a short one.

## Post-session

- [ ] Update the roster row: `status=onboarded`, `onboarding_date`, any friction themes in `notes`.
- [ ] Log any real bug or UX issue in the `audit-tracker.md` "Post-launch / Parking Lot" section with a `KI-*` number. Do not fix mid-session.
- [ ] Send a WhatsApp follow-up within 24 h: "How did the first real invoice go? Anything felt clunky?"

## Response-time SLA (beta)

| Channel | Response time | Fallback |
|---|---|---|
| WhatsApp (09:00–19:00 SGT Mon–Sat) | 2 h | Acknowledge within 2 h; resolve within 24 h. |
| WhatsApp (out of hours) | Next business morning | Escalate to founder if payment-blocking. |
| Email (`help@servicesync.sg`) | 24 h | Escalate to founder at 48 h. |
| In-app error (Sentry page) | Same day | Page founder immediately if SLO breach (see `docs/slos.md`). |

## When to escalate to founder immediately

- Any payment-handling bug where the user thinks money has moved but the system disagrees.
- Any PDPA-adjacent incident (unauthorised access, visible data leak).
- Any report that ServiceSync charged them commission — this violates the positioning and must be investigated within the hour.

## Session cadence
- Week 1 post-onboarding: daily WhatsApp check-in.
- Week 2–4: twice weekly.
- Month 2+: weekly until they've completed 10 paid invoices.

After 10 paid invoices they graduate from concierge to standard support.
