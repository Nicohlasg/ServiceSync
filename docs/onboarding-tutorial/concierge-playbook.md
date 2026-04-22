# Concierge Onboarding Playbook

> One-pager for the founder or support agent running a **live assisted onboarding call** with a new ServiceSync SG technician. Derived from masterplan `docs/masterplan_onboarding_plan.md` §4.2 + §4.5 (NEW — MEDIUM PRIORITY).

| Field | Value |
|---|---|
| **Version** | 1.0 |
| **Last updated** | 2026-04-15 |
| **Owner** | Founder |
| **Audience** | Whoever answers the new-user WhatsApp number |
| **Parent** | [masterplan_onboarding_plan.md §4.5](../masterplan_onboarding_plan.md#45-concierge-onboarding-playbook-new--medium-priority) |

---

## 0. Ground rules for the facilitator

- **Same business day SLA.** Every new signup gets a WhatsApp message or call within the same business day. Not 24 hours. If signup is after 6pm, first touch is next morning by 9am.
- **Call, don't type.** Non-tech users will ghost a long WhatsApp thread. Offer a 15-minute call. If they decline, follow the tap-by-tap below over voice notes — never a wall of text.
- **Screen-share is optional.** Most Singapore tradesmen won't know how. Default to voice + "now tap the blue button at the bottom."
- **Their language, their pace.** If the user picked Mandarin on the landing page, run the whole call in Mandarin. Check `profiles.preferred_locale` before dialling.
- **Never take control of their device.** Even if AnyDesk is offered. This is their invoicing system; trust must be earned, not shortcut.

---

## 1. Tap-by-tap facilitator sequence

Total elapsed time target: **15 minutes**. Budget 2 minutes slippage per step; anything longer is a red flag (§3).

| Step | What the user taps | Your prompt to them | Pass criterion |
|---|---|---|---|
| **1. Install the PWA** | Share link in WhatsApp → tap **"Add to Home Screen"** (Safari) / **"Install app"** (Chrome) | "I just sent you the link. Tap it, then tap the square-with-arrow icon and choose Add to Home Screen. Tell me when you see the ServiceSync icon on your home screen." | Icon visible on home screen |
| **2. Open the app from the icon** | Tap ServiceSync icon (not browser) | "Close everything. Now tap the ServiceSync icon on your home screen. It should open without the browser bar at the top." | App opens fullscreen |
| **3. Pick a language** | Language picker card on landing page | "You'll see four boxes with language names. Tap the one you're most comfortable reading invoices in. You can change it later." | Landing page hero re-renders in chosen language |
| **4. Sign up** | Email + password + phone, tap **Create account** | "Type your email, make a password you can remember, put your mobile number. Tap the blue button at the bottom." | Email verification screen shown |
| **5. Verify email** | Tap verification link in their mailbox | "Check your email — there's a link from ServiceSync. Tap it. Come back to the app." | Dashboard route redirects to setup wizard |
| **6. Setup wizard — name + UEN + base + fee** | 5 steps; wizard handles most | "Just follow the screen. If UEN confuses you, tap Skip — not everyone has one." | Wizard completion toast |
| **7. Watch the 2-minute tour** | Swipe or tap Continue through 7 tutorial slides | "This is just a tour. You can swipe left to go forward or tap Skip at the top right if you prefer." | `tutorial_completed` or `tutorial_skipped` event fires |
| **8. Add their first service** | Checklist row 1 → `/dashboard/services/new` → Save | "You offer plumbing, right? Add one service called 'Toilet leak repair' — put whatever you normally charge. Say 80 dollars." | Service row appears; checklist row 1 ticks off |
| **9. Add their first client** | Checklist row 2 → `/dashboard/clients/new` → Save | "Pick a real customer you trust — someone you've already done a job for. Put their name, their number, their address. Tap Save." | Client row appears; checklist row 2 ticks off |
| **10. Preview PayNow** | Checklist row 3 → modal with sample QR | "This is a sample invoice. Nothing will happen when you tap Got it — it's just so you can see what the client will see." | Checklist row 3 ticks off |
| **11. Send one real invoice** | Dashboard → Invoices → New → pick client + service → Send | "Now the real one. Pick the customer we just added. Pick the service. Tap Send — it'll WhatsApp them the link and the QR." | `onboarding_first_invoice_sent` event fires |
| **12. Close the call** | — | "If the customer pays, the app marks it done on its own. Text me on this number if anything looks wrong. I'll call you in 3 days to check." | Callback scheduled on your calendar |

**Stop conditions** (end the call early, don't push on):
- User expresses frustration ≥ twice ("I don't understand / this is too much").
- Device battery < 20% and they're on the road.
- They pass Step 10 — it's fine to defer Step 11 to a day they have a real job to bill.

---

## 2. Drop-off reasons — call-notes checklist

Fill this out **during** the call, not after. Copy-paste into the cohort spreadsheet (masterplan §4.1) — these fields feed the weekly Week 1–2 friction analysis that seeds §4.4 video topics.

```
Call ID: _______  Date: _______  Duration: ___ min
User: _______________  Locale selected: ___________
Step reached: 1 / 2 / 3 / 4 / 5 / 6 / 7 / 8 / 9 / 10 / 11 / 12
Outcome: completed | deferred | abandoned

Where they stuck:
[ ] Couldn't find install prompt (Step 1)
[ ] Email didn't arrive / landed in spam (Step 5)
[ ] UEN field confused them (Step 6.3)
[ ] Service price dialog was unclear (Step 6.5)
[ ] Skipped tour — why? __________________________
[ ] Didn't know what "service" vs "client" meant (Steps 8–9)
[ ] PayNow preview raised questions I couldn't answer on the spot
[ ] "Real invoice" felt too risky on first call (Step 11 — expected, OK)

Language issues:
[ ] Needed a translation I didn't have ready — word: _______
[ ] User switched language mid-call — reason: _______

Device / connectivity:
[ ] Android vs iOS confusion on install step
[ ] Connection dropped (basement / lift / HDB dead zone)
[ ] Browser was Chrome / Safari / other: _______

Emotional cues:
[ ] User thanked the tour (positive)
[ ] User questioned fees/commission (reassure: free, no card)
[ ] User mentioned existing WhatsApp invoicing — did they say why they'd switch?

Next action:
[ ] Call back in 3 days — date: _______
[ ] Send video link (P1 Task 12) — topic: _______
[ ] Flag for founder review
[ ] No action needed
```

---

## 3. Red-flag signs — escalate vs. re-educate

Not every stuck user needs patience. Some indicate a product bug or a fit problem. Use this table to decide.

| Signal | Likely cause | Action |
|---|---|---|
| User cannot find the install prompt after 3 minutes | iOS 16 Safari UI changed OR Chrome Lite on low-end Android | **Escalate to rebuild** — log Linear ticket "install prompt breakage on X device/OS"; don't ask 2nd user to fight it. |
| Verification email doesn't arrive after 5 minutes | SendGrid reputation or spam-folder routing | **Escalate to ops** — manually resend via Supabase admin; if >3 calls this week, file infra ticket. |
| User types their password in the email field (or vice versa) | Form labels too small OR label hidden by autofill | **Re-educate** once — then **escalate to design** if ≥ 3 users hit this. |
| User asks "how much will ServiceSync charge me" more than once | Trust gap — marketing copy isn't landing | **Re-educate** — restate "free, no commission, no card." Flag the call for founder review: copy on landing needs work. |
| User refuses to add a real client "in case it calls them" | They don't trust the app yet — expected behaviour, not a bug | **Re-educate** — walk through Step 11 without actually sending. Reassure them manually. Log as "deferred Step 11"; re-engage in 3 days. |
| Tour slide 6 (PayNow morph animation) causes motion sickness | Reduced-motion preference not detected | **Escalate** — file ticket "reduced-motion not respected on device X"; verify `useReducedMotion` is wired end-to-end. |
| Dashboard crashes or shows English when user picked Mandarin | Hydration mismatch or cookie read failed | **Escalate to rebuild** — file P0 bug. Do not work around. |
| User installs, signs up, and ghosts before Step 6 | Signup friction — likely wizard length | Log "wizard abandon at step N"; roll into masterplan §4.1 cohort data — if > 30% cohort hits this, shorten wizard in v1.1. |
| User asks to pay for the app | Marketing positioning is working *too* well — they assume paid = trustworthy | **Re-educate** — ServiceSync is free during beta; we'll share the roadmap when there's something paid to charge for. |
| User finishes Steps 1–12 in < 10 minutes, no questions | Either a ringer (fellow tradesman tester) or a very tech-literate unicorn | Capture them as a **beta champion** — ask if they'll introduce you to two friends. |

**Escalation paths:**
- **Rebuild** (product defect) → Linear ticket, P0 tag, founder CC'd within 1 hour.
- **Re-educate** (user stuck, product fine) → follow-up WhatsApp in 24 hours with a 30-second voice note; queue for P1 video topic.
- **Route to ops** (SendGrid, DNS, Supabase) → separate ticket in ops channel.

---

## 4. After the call — within 1 hour

1. Copy the Section 2 checklist into the cohort spreadsheet row.
2. If any red flag fired, open the ticket before closing your laptop.
3. Set a WhatsApp reminder to check on them in 3 days (Step 12 callback).
4. If the user reached Step 11 (first real invoice sent), send a congratulatory voice note — *not a template*. This is the emotional high from masterplan §2 "First invoice moment is emotional." Don't ruin it with boilerplate.

---

## 5. What this playbook is not

- **Not a sales script.** No upsell during onboarding, ever (masterplan §2 trust model).
- **Not a support knowledge base.** Ongoing questions ("how do I change my PayNow key?") belong in Help, not here.
- **Not self-service.** This is a human-assisted flow. When we have 1,000 weekly signups we'll rebuild it with videos (P1 Task 12). Until then, one founder on one call is cheaper than one unhappy cohort.

---

## Change log

| Date | Version | Summary |
|---|---|---|
| 2026-04-15 | 1.0 | Initial playbook — masterplan §4.5 P0 Task 9 deliverable. Tap-by-tap sequence, SLA, drop-off checklist, red-flag escalation table. |
