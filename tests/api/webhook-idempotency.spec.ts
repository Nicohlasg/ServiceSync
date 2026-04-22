import { test, expect } from '@playwright/test';
import { createHmac } from 'crypto';

/**
 * LR-2.3 — Prove PayNow webhook idempotency (SEC-L4 contract).
 *
 * Replay the exact same NETS callback twice. The first call must process the
 * payment (or short-circuit on a known failure path); the second call must
 * return `action: "duplicate"` because the (source, event_id) tuple is
 * UNIQUE in `webhook_events`.
 *
 * Requires:
 *   - NETS_WEBHOOK_SECRET present in the environment of both this test
 *     runner AND the Next.js server it's hitting (otherwise the HMAC check
 *     in route.ts:181 fails closed and we'd be testing the auth path).
 */

const SECRET = process.env.NETS_WEBHOOK_SECRET;

test.describe('PayNow webhook — idempotency (LR-2.3 / SEC-L4)', () => {
  test.skip(
    !SECRET,
    'NETS_WEBHOOK_SECRET not set — cannot sign a payload the server will accept'
  );

  test('replaying the same transactionId returns action=duplicate', async ({ request }) => {
    // Use a unique transactionId per test run so we don't trip on stale state
    // from a previous run. Replays within this test reuse it.
    const transactionId = `pw-test-${Date.now()}`;
    const body = {
      reference: 'PW-TEST-REF-DOES-NOT-EXIST',
      amount: 10_000,
      status: 'SUCCESS' as const,
      timestamp: new Date().toISOString(),
      transactionId,
      hmac: '',
    };
    const payload = `${body.reference}|${body.amount}|${body.status}|${body.timestamp}`;
    body.hmac = createHmac('sha256', SECRET!).update(payload).digest('hex');

    // First delivery — webhook accepts the event. Because the reference
    // doesn't match a real invoice the action will be `invoice_not_found`,
    // which still inserts the webhook_events row (server inserts BEFORE the
    // invoice lookup so a missing invoice is still a "seen" event).
    const first = await request.post('/api/webhooks/paynow', { data: body });
    expect(first.status(), 'first delivery should be accepted').toBe(200);
    const firstJson = await first.json();
    expect(firstJson.received).toBe(true);
    expect(['payment_processed', 'invoice_not_found', 'ignored']).toContain(firstJson.action);

    // Second delivery — same payload byte-for-byte. The UNIQUE (source,
    // event_id) constraint on webhook_events should raise 23505 and the
    // route should short-circuit with action=duplicate.
    const second = await request.post('/api/webhooks/paynow', { data: body });
    expect(second.status()).toBe(200);
    const secondJson = await second.json();
    expect(secondJson).toMatchObject({ received: true, action: 'duplicate' });
  });

  test('a tampered payload (wrong HMAC) is rejected with 401', async ({ request }) => {
    const body = {
      reference: 'PW-TEST-BAD-HMAC',
      amount: 5_000,
      status: 'SUCCESS' as const,
      timestamp: new Date().toISOString(),
      transactionId: `pw-bad-${Date.now()}`,
      hmac: 'deadbeef'.repeat(8),
    };
    const res = await request.post('/api/webhooks/paynow', { data: body });
    expect(res.status()).toBe(401);
  });
});
