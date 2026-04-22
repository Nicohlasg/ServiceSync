import { test } from '@playwright/test';

/**
 * LR-2.4 journey 5/5 — Cash payment + WhatsApp handshake.
 *
 * Requires an authenticated session + an issued invoice with a non-zero
 * balance. Skipped until tests/e2e/fixtures/auth.ts + seed are wired.
 *
 * The PayNow webhook leg of the payment story is covered by the API test
 * tests/api/webhook-idempotency.spec.ts (LR-2.3).
 */

test.describe('Cash payment confirmation', () => {
  test.skip('technician records cash payment and sees handshake link', async () => {
    // 1. login(page, TEST_USER)
    // 2. seed invoice with balance 25_000 cents
    // 3. visit /dashboard/invoices/[id]
    // 4. click "I Collected Cash"
    // 5. enter amount, submit
    // 6. expect status badge "Paid (cash)" + wa.me link rendered
  });
});
