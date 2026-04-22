import { test, expect } from '@playwright/test';

/**
 * LR-2.4 journey 2/5 — Onboarding requires auth.
 *
 * Without a session, /dashboard/onboarding must redirect to /login (proves
 * the middleware auth gate from middleware.ts is wired up).
 *
 * A full positive-path onboarding test requires a seeded test user — see
 * tests/e2e/fixtures/auth.ts (TODO once a Supabase test project is set up).
 */

test.describe('Onboarding', () => {
  test('unauthenticated visit redirects to /login with redirect param', async ({ page }) => {
    await page.goto('/dashboard/onboarding');
    await expect(page).toHaveURL(/\/login\?redirect=%2Fdashboard%2Fonboarding/);
    await expect(page.getByRole('heading', { name: /Welcome back|Log in/i })).toBeVisible();
  });
});
