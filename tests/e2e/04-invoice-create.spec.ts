import { test } from '@playwright/test';

/**
 * LR-2.4 journey 4/5 — Invoice creation flow.
 *
 * Requires an authenticated session + at least one client + one service to
 * pre-fill the invoice form. Skipped until tests/e2e/fixtures/auth.ts +
 * tests/e2e/fixtures/seed.ts are wired to a Supabase test project.
 */

test.describe('Invoice creation', () => {
  test.skip('logged-in technician can issue an invoice for an existing client', async () => {
    // 1. login(page, TEST_USER)
    // 2. await page.goto('/dashboard/invoices/new')
    // 3. select client, select service, set amount
    // 4. submit
    // 5. expect redirect to /dashboard/invoices/[id] and 'Issued' badge
  });
});
