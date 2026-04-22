import { test, expect } from '@playwright/test';

/**
 * LR-2.4 journey 3/5 — Dashboard auth gate + bottom nav stability (KI-13).
 *
 * Guards two regressions:
 *   - Unauthenticated /dashboard hits redirect to /login (middleware contract).
 *   - The mobile bottom nav reserves a stable height across pages — the
 *     test navigates between three dashboard routes (after auth) and asserts
 *     the nav's bounding box is identical, since hard-coded `pb-20` was the
 *     KI-13 root cause.
 */

test.describe('Dashboard', () => {
  test('unauthenticated /dashboard redirects to /login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login\?redirect=%2Fdashboard/);
  });

  // The nav-stability assertion needs an authenticated session. Skipped
  // until tests/e2e/fixtures/auth.ts is wired to a Supabase test project.
  test.skip('mobile bottom nav has a stable height across dashboard pages (KI-13)', async () => {
    // const navOnHome = await page.locator('nav.glass-nav').boundingBox();
    // await page.goto('/dashboard/schedule');
    // const navOnSchedule = await page.locator('nav.glass-nav').boundingBox();
    // expect(navOnSchedule?.height).toBe(navOnHome?.height);
  });
});
