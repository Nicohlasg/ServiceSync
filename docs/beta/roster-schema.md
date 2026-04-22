# Beta Cohort Roster — schema (LR-4.6)

`docs/beta/cohort-roster-template.csv` is the canonical row shape. This file
documents what each column means and the allowed values, so nobody has to
guess when the roster gets handed between founder and concierge operator.

| Column | Required | Allowed values / format | Notes |
|---|---|---|---|
| `id` | yes | integer, monotonic | Never reuse; if a user drops, leave the row and set `status=churned`. |
| `full_name` | yes | UTF-8 string | Encrypted at rest in prod; here for the concierge spreadsheet only. Not committed to git. |
| `trade` | yes | `aircon` / `plumbing` / `electrical` / `handyman` / `cleaning` | Must match the `service_category` enum in the product. |
| `phone_e164` | yes | `+65XXXXXXXX` | E.164 format for direct WhatsApp deep-links. |
| `onboarding_date` | yes | `YYYY-MM-DD` | Date of the concierge session, not signup. |
| `tech_literacy` | yes | 1–5 (self-reported during intake) | 1 = needs paper instructions; 5 = already using SaaS tools. |
| `pdpa_consent_date` | yes | `YYYY-MM-DD` | Date the user clicked through the consent copy in `docs/beta/pdpa-consent.md`. |
| `pdpa_consent_version` | yes | `vX.Y` | Matches the header version in `pdpa-consent.md`; bump on any wording change. |
| `referral_source` | no | free text | e.g., `whatsapp-a` (UTM), `word-of-mouth`, `trade-expo`. |
| `status` | yes | `pending` / `onboarded` / `active` / `paused` / `churned` | Drives the concierge playbook's follow-up cadence. |
| `notes` | no | free text | Friction themes, device quirks, anything the next session lead should know. |

## Handling

- **Not committed to git.** Store in the founder's encrypted cloud (e.g., 1Password vault or an encrypted Drive folder). The template CSV in this repo is field-shape only — no rows.
- **Access control.** Founder + concierge operator only during beta. If that expands, log the additional access in `docs/beta/access-log.md` with date + scope.
- **Retention.** Rows are retained for the user's active lifetime + 2 years (PDPA business-records retention). On churn, null out `phone_e164` + `full_name` after 2 years; keep aggregate columns for cohort analysis.

## Import path to the product

The CSV is an **intake** artifact, not a source of truth for product state. After onboarding completes, the user exists in Supabase `profiles` + `auth.users`; the CSV is only the concierge operator's session log.
