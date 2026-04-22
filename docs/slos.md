# Service Level Objectives (LR-3.2)

Three SLOs gate the beta launch. Each has an error budget expressed as a
rolling 30-day window and an alerting threshold that fires before the
budget is exhausted.

## 1. API Latency — p95 < 500 ms

**Scope:** All `/api/*` and tRPC procedures served by `apps/web`, excluding
webhook ingestion (`/api/webhooks/*` has its own 2 s SLO because PayNow
itself is the upstream).

**Measurement:** Vercel Analytics `Server Response Time` metric, p95,
15-minute bucket.

**Error budget:** 5 % of requests may exceed 500 ms in any rolling
30-day window.

**Alerts:**
- Warning: p95 > 400 ms sustained 30 min (Sentry performance alert).
- Page: p95 > 500 ms sustained 15 min (Sentry → founder channel).

**Owner:** backend on-call (founder during beta).

## 2. Error Rate — < 1 %

**Scope:** Unhandled exceptions captured by Sentry (`apps/web`, all
runtimes: client + server + edge).

**Measurement:** Sentry `errors` / `sessions` in the release-health
dashboard, 60-minute bucket.

**Error budget:** 1 % of sessions may contain ≥ 1 unhandled error per
30-day rolling window.

**Alerts:**
- Warning: error-rate > 0.5 % sustained 30 min.
- Page: error-rate > 1 % sustained 15 min, **or** any new-issue first
  seen in prod within 10 min of deploy.

**Owner:** founder (during beta); auto-rolls back via Vercel "Instant
Rollback" if threshold is breached within 30 min of a new deploy.

## 3. Availability — ≥ 99.5 %

**Scope:** `GET /` and `GET /api/health` respond 2xx within 2 s.

**Measurement:** Vercel Monitoring uptime checks from 3 regions (SGP +
2 fallbacks), 1-minute cadence.

**Error budget:** 3 h 36 min downtime per 30-day window.

**Alerts:**
- Warning: 2 consecutive failures from any region.
- Page: 3 consecutive failures from ≥ 2 regions (excludes single-region
  flake).

**Owner:** founder; escalation path = Supabase status page → Vercel
status page → DNS registrar (Cloudflare).

## Error Budget Policy

When any SLO's budget is > 50 % consumed within the window:

1. Halt non-critical feature work in `apps/web`.
2. Prioritise the remediation backlog in `audit-tracker.md`.
3. Do not ship new deploys to prod except for the fix itself.

When budget is > 90 % consumed:

1. Freeze `main` until the root cause is resolved.
2. Founder declares an incident, opens a runbook from
   `docs/runbooks/`, and notifies any active beta cohort via WhatsApp.

## Dashboards

- Sentry — `Releases` tab: per-release crash-free rate.
- Vercel Analytics — `Web Vitals`: LCP/FID/CLS (Lighthouse SLO, LR-3.3).
- Vercel Monitoring — uptime board.

Wire links here after the Sentry project is provisioned.
