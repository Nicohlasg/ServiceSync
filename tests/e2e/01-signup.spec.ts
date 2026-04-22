import { test, expect } from '@playwright/test';

/**
 * LR-2.4 journey 1/5 — Signup form renders and validates client-side.
 *
 * Smoke test only: no Supabase user is created (that would need a disposable
 * mailbox + cleanup). Proves the page loads, LR-4.4 CRO structure holds
 * (no mobile-number field on this step), and inline validation rejects bad
 * input before hitting the network.
 */

test.describe('Signup', () => {
  test('renders the join-the-beta form', async ({ page }) => {
    await page.goto('/signup');
    await expect(page.getByRole('heading', { name: /Join the beta/i })).toBeVisible();
    await expect(page.getByLabel(/Full Name/i)).toBeVisible();
    await expect(page.getByLabel(/Email Address/i)).toBeVisible();
    await expect(page.getByLabel(/Password/i)).toBeVisible();
    // LR-4.4: phone was removed from the signup step — collected in onboarding.
    await expect(page.getByLabel(/Mobile Number/i)).toHaveCount(0);
  });

  test('rejects a too-short password client-side', async ({ page }) => {
    await page.goto('/signup');
    await page.getByLabel(/Full Name/i).fill('Test User');
    await page.getByLabel(/Email Address/i).fill('test@example.com');
    await page.getByLabel(/Password/i).fill('short');
    // Trade selector is required — skip selecting it to also test that gate.
    await page.getByRole('button', { name: /Join the beta/i }).click();
    await expect(page.getByText(/(at least 8 characters|trade)/i).first()).toBeVisible();
  });
});
