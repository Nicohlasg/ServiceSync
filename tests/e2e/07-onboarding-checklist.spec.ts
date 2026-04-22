import { test, expect } from '@playwright/test';

/**
 * P0 Task 11 — Onboarding activation checklist.
 *
 * The checklist lives on `/dashboard` and is auth-gated, so the only
 * always-runnable assertion here is the middleware redirect. Positive-path
 * specs (row ticks, hide/resume, deep-link flows, taxonomy event emission)
 * depend on a seeded Supabase test project — see `tests/e2e/fixtures/auth.ts`
 * and enable the `.skip()` blocks once that lands.
 *
 * Coverage goals (masterplan §9 + qa-checklist §7):
 *   • Fresh load → 3 todo rows, progress pill "0 of 3 done"
 *   • Deep-link: service row → `/dashboard/services/new`
 *   • Deep-link: client row → `/dashboard/clients/new`
 *   • PayNow row opens modal (not navigation)
 *   • Hide/resume round-trips via DB (`hiddenAt` latch)
 *   • Re-run Setup Wizard clears all 4 fields incl. `hiddenAt`
 *   • Analytics taxonomy: `onboarding_checklist_item_completed` fires
 *     once per item across both direct-mark + server-side auto-mark paths
 */

test.describe('Onboarding activation checklist', () => {
  test('unauthenticated /dashboard redirects to /login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login\?redirect=%2Fdashboard/);
  });

  test.skip('fresh dashboard shows all three todo rows', async ({ page }) => {
    // Requires auth fixture. Asserts:
    //   - page.getByTestId('onboarding-checklist') visible
    //   - three rows rendered with data-state="todo"
    //   - progress pill reads "0 of 3 done"
  });

  test.skip('tapping service row navigates to /dashboard/services/new', async () => {
    // await page.getByTestId('onboarding-checklist-row-service').click();
    // await expect(page).toHaveURL(/\/dashboard\/services\/new/);
  });

  test.skip('tapping client row navigates to /dashboard/clients/new', async () => {
    // await page.getByTestId('onboarding-checklist-row-client').click();
    // await expect(page).toHaveURL(/\/dashboard\/clients\/new/);
  });

  test.skip('tapping paynow row opens modal and ticks row on confirm', async () => {
    // await page.getByTestId('onboarding-checklist-row-paynow').click();
    // await expect(page.getByTestId('paynow-preview-modal')).toBeVisible();
    // await page.getByTestId('paynow-preview-confirm').click();
    // await expect(page.getByTestId('onboarding-checklist-row-paynow')).toHaveAttribute('data-state', 'done');
    // await expect(page.getByTestId('onboarding-checklist-progress')).toContainText(/1 of 3/);
  });

  test.skip('hide → resume round-trip persists across reload', async ({ page }) => {
    // await page.getByTestId('onboarding-checklist-hide').click();
    // await expect(page.getByTestId('onboarding-checklist-resume')).toBeVisible();
    // await page.reload();
    // await expect(page.getByTestId('onboarding-checklist-resume')).toBeVisible();
    // await page.getByTestId('onboarding-checklist-resume').click();
    // await expect(page.getByTestId('onboarding-checklist')).toBeVisible();
  });

  test.skip('server-side auto-mark ticks service row when saving via /services/new', async () => {
    // Proves masterplan §4.3: creating entities from other surfaces still
    // advances the checklist. Add a service, navigate back to /dashboard,
    // assert service row data-state="done" without ever touching the
    // checklist UI directly.
  });

  test.skip('Re-run Setup Wizard clears all 4 checklist fields', async () => {
    // Visits /dashboard/profile, clicks Re-run Setup Wizard, finishes the
    // wizard, returns to /dashboard. Asserts all three rows back to
    // data-state="todo" and hiddenAt cleared (card visible, not in
    // resume-pill mode).
  });

  test.skip('`onboarding_checklist_item_completed` fires exactly once per item', async ({ page }) => {
    // Hook `trackEvent` via window before nav; assert the event array
    // has exactly one item-completed per row after saving one service +
    // one client + confirming paynow. Duplicate fires on re-renders are
    // a regression guarded by the useRef diff in OnboardingChecklist.
  });

  test.skip('`onboarding_checklist_dismissed` payload includes items_completed', async () => {
    // After completing 2 of 3 rows, click hide. Assert the event fired
    // with { items_completed: 2 }.
  });
});
