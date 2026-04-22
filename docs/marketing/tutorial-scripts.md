# Tutorial Video Scripts (LR-4.8)

Three 60-second scripts in Singaporean English, intended to be recorded on
a mobile phone — vertical, handheld, spoken by the founder or a beta user
who has consented to appear.

> **Do not record these yet.** Per `docs/masterplan.md` §4.3, tutorial topics
> are chosen *after* the first five concierge sessions surface real friction
> themes. These scripts are the **outlines** the first recordings should
> slot into; specific pain points come from post-session notes in
> `docs/beta/cohort-roster-template.csv`'s `notes` column.

Common rules for all three:

- Vertical (9:16), 1080p min, handheld is fine.
- Open with the problem in 5 s — no intros, no logo stings.
- Close with "Try it free — servicesync.sg" overlay for 3 s.
- Burned-in captions (中文 + EN). Trades watch with sound off on noisy job sites.
- No fabricated testimonials. If a user appears, they have signed a media
  release (template at `docs/beta/media-release-template.md` — todo).

## Script 1 — "Invoice in under 60 seconds"

**Intended viewer.** Tradesman mid-job, skeptical of app-based tools.

**Hook (0–5s).** "Bro, tell me seriously — how long does it take you to issue an invoice? Fifteen minutes? Twenty?"

**Problem (5–15s).** Flip to a messy WhatsApp conversation with a handwritten
photo invoice. "This is what most of us do. Photo of a hand-written receipt,
hope the customer transfers by tonight."

**Solution (15–45s).** Screen-record the real flow: `/dashboard/invoices/new` →
pick client → pick service → hit send → PayNow QR appears. Narrate in real
time, no cuts. Target **completion before 45s elapsed**.

**Close (45–60s).** "Invoice issued. QR sent over WhatsApp. She'll pay
before I leave the carpark. Try it free — servicesync.sg."

## Script 2 — "Get paid on the spot"

**Intended viewer.** Tradesman who has done an invoice but is stuck chasing
payment.

**Hook (0–5s).** "Issued the invoice already. Now I'm chasing lah."

**Problem (5–15s).** Show messages: "Auntie, just a reminder…", "Any update
on payment?". "Every one of us has typed this a thousand times."

**Solution (15–45s).** Show an invoice with a live PayNow QR. Customer scans
(use a second phone), a toast appears: "Payment confirmed". Show the invoice
flipping to "Paid" in real time.

**Close (45–60s).** "Same customer, same job, paid before I walked to the
lift. Try it free — servicesync.sg."

## Script 3 — "Works in the carpark"

**Intended viewer.** Tradesman who has tried other SaaS and bounced off the
flaky-connection problem.

**Hook (0–5s).** "Most apps give up in the basement. This one doesn't."

**Problem (5–15s).** Open another popular trades app (blurred), show it
spinning forever on a carpark-floor test. "No signal, no invoice."

**Solution (15–45s).** Open ServiceSync on the same carpark floor. Show the
offline banner. Create an invoice anyway. Walk to the exit — the banner
clears, the invoice syncs, a toast confirms. Do this in one take.

**Close (45–60s).** "Wrote the invoice where the signal died. It caught up
the moment I came out. Try it free — servicesync.sg."

## Recording checklist

- [ ] Device is on airplane mode *except* for what the script shows.
- [ ] Real data only — no fabricated invoice amounts for dramatic effect.
- [ ] User (if appearing) has signed a media release.
- [ ] Captions pass through a native Mandarin speaker before publishing.
- [ ] Thumbnail does not include a number that isn't real.

## Measurement

Each video gets its own UTM-tagged link in `docs/marketing/qr-codes.md` so we can see which script drives signups. Re-evaluate all three after 100 signups; pause or re-shoot the weakest performer.
