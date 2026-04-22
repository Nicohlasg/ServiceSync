# PDPA Consent Copy (v1.0)

Shown during the concierge onboarding session, **before** any personal data
is entered into the app. A copy is co-signed by the beta user (physical or
digital signature) and filed in the founder's encrypted vault.

## Version history
- **v1.0** — 2026-04-14 — initial drafting, not yet reviewed by counsel.

> **⚠️ Legal review required before the first real beta user is onboarded.**
> This copy is a *good-faith engineering draft* aligned with PDPC guidance
> and Singapore's PDPA (Cap. 26); it has not been reviewed by a qualified
> legal advisor. Do not distribute externally until it has.

## Consent text (shown to user)

> **Personal data consent — ServiceSync SG private beta**
>
> I, the undersigned, am joining the ServiceSync SG private beta ("the
> Service"). I understand and agree to the following:
>
> 1. **What ServiceSync collects about me.** My full name, mobile number,
>    email address, and the business details I enter into the app (business
>    name, ACRA UEN if provided, trade category). These are stored
>    encrypted-at-rest on Supabase infrastructure.
>
> 2. **What ServiceSync collects about my customers.** When I create an
>    invoice or booking, I enter my customer's name, mobile number, and
>    service address. I warrant that I have obtained my customer's consent
>    to share this information with ServiceSync for the purpose of running
>    my business.
>
> 3. **How my data is used.** Solely to provide the Service: sending
>    invoices, collecting PayNow, generating booking confirmations, and
>    issuing tax-relevant receipts. ServiceSync will **not** sell my data
>    or my customers' data to third parties, and will not send marketing
>    communications to my customers.
>
> 4. **Data location.** Data is stored in Singapore (Supabase `ap-southeast-1`
>    region) and processed in Singapore. I will be notified in advance if
>    this changes.
>
> 5. **My rights.** I may request a copy of my data, corrections to my data,
>    or deletion of my data at any time by emailing
>    `privacy@servicesync.sg`. ServiceSync will respond within 30 days per
>    PDPA guidance.
>
> 6. **Beta nature.** The Service is in private beta. There may be downtime,
>    data loss, or behaviour changes. ServiceSync will notify me of any
>    incident affecting my data within 72 hours of discovery (per PDPA data
>    breach notification rules where applicable).
>
> 7. **Withdrawing consent.** I may withdraw consent at any time by writing
>    to `privacy@servicesync.sg`. On withdrawal, my account will be
>    deactivated and my data deleted within 30 days, unless a business-
>    records retention obligation (e.g., IRAS tax records) requires
>    otherwise; in that case, data is retained only to meet that obligation
>    and for no longer than required.
>
> Signature: ___________________________    Date: ______________

## Concierge-operator script (not shown to user)

When walking a user through the consent form:

1. Read clause 2 out loud. "This is the one we want you to really think
   about — ServiceSync holds your customers' contact details. If they ever
   ask where their number came from, your answer needs to be that you used
   ServiceSync to keep your books. That is a consent obligation that belongs
   to you under the PDPA, and we're helping you meet it."
2. Offer to email the user a copy in advance (file in `docs/beta/pdpa-consent.md`).
3. If they decline: **do not** proceed with onboarding.
