import { test, expect } from '@playwright/test';

/**
 * LR-3.4 journey 6/6 — Offline-first resync.
 *
 * Contract: the app registers a service worker (apps/web/public/sw.js +
 * task 7.6 offline banner) and queues invoice writes while `navigator.onLine`
 * is false. When the network returns, queued writes drain and the banner
 * flips off.
 *
 * Without an auth fixture we can only prove the passive half of the contract —
 * the offline banner appears and disappears in response to `context.setOffline`.
 * The positive-path (queued invoice drains after reconnect) is held back until
 * `tests/e2e/fixtures/auth.ts` + seed are wired.
 */

test.describe('Offline resync', () => {
  test('offline banner appears when network drops and clears on reconnect', async ({
    page,
    context,
  }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\//);

    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));

    const offlineBanner = page.getByText(/offline|no connection|reconnecting/i);
    await expect(offlineBanner).toBeVisible({ timeout: 5_000 });

    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));

    await expect(offlineBanner).toBeHidden({ timeout: 5_000 });
  });

  test.skip('queued invoice drains after reconnect', async () => {
    // 1. login(page, TEST_USER)
    // 2. context.setOffline(true)
    // 3. visit /dashboard/invoices/new, fill + submit — writes queue in IDB
    // 4. expect toast "Saved offline — will sync when you reconnect"
    // 5. context.setOffline(false); dispatch 'online'
    // 6. expect eventual redirect to /dashboard/invoices/[id] (background sync drained)
  });
});
