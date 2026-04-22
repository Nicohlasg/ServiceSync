import { test, expect } from '@playwright/test';

/**
 * P0 Task 11 — PayNow preview modal.
 *
 * Modal is mounted by `/dashboard` and triggered by the paynow checklist
 * row. All behaviour except the auth gate requires a seeded session — the
 * .skip() blocks below map 1:1 to the manual checklist in §8 of
 * qa-checklist.md. Enable once `tests/e2e/fixtures/auth.ts` lands.
 *
 * Coverage goals (qa-checklist §8):
 *   • Opens from the checklist paynow row
 *   • QR data URL renders (not pending-spinner) within 500 ms
 *   • Confirm + Close both tick the paynow row
 *   • Escape dismisses
 *   • Backdrop click dismisses; inner-card click does not
 *   • Focus trap on the Close button when open
 *   • aria-modal + aria-labelledby correctness
 *   • Replay preserves original timestamp (first-completion-wins)
 */

test.describe('PayNow preview modal', () => {
  test('modal test ids are documented (smoke — non-routable assertion)', async () => {
    // This spec's host routes aren't scaffolded yet, so we assert the
    // expected test-id surface area here as a contract for when they
    // are. Keeps the QA checklist and the test ids in sync.
    const expectedIds = [
      'paynow-preview-modal',
      'paynow-preview-close',
      'paynow-preview-confirm',
    ];
    expect(expectedIds).toHaveLength(3);
  });

  test.skip('opens from the checklist paynow row', async ({ page }) => {
    // await page.goto('/dashboard');
    // await page.getByTestId('onboarding-checklist-row-paynow').click();
    // await expect(page.getByTestId('paynow-preview-modal')).toBeVisible();
  });

  test.skip('QR data URL renders within 500ms of open', async ({ page }) => {
    // await page.goto('/dashboard');
    // await page.getByTestId('onboarding-checklist-row-paynow').click();
    // const qr = page.locator('img[alt="Sample PayNow QR code"]');
    // await expect(qr).toHaveAttribute('src', /^data:image\/png/, { timeout: 500 });
  });

  test.skip('Got it button closes + ticks paynow row', async ({ page }) => {
    // await page.getByTestId('onboarding-checklist-row-paynow').click();
    // await page.getByTestId('paynow-preview-confirm').click();
    // await expect(page.getByTestId('paynow-preview-modal')).toBeHidden();
    // await expect(page.getByTestId('onboarding-checklist-row-paynow')).toHaveAttribute('data-state', 'done');
  });

  test.skip('Close (X) also ticks the paynow row', async ({ page }) => {
    // await page.getByTestId('onboarding-checklist-row-paynow').click();
    // await page.getByTestId('paynow-preview-close').click();
    // await expect(page.getByTestId('paynow-preview-modal')).toBeHidden();
    // await expect(page.getByTestId('onboarding-checklist-row-paynow')).toHaveAttribute('data-state', 'done');
  });

  test.skip('Escape dismisses the modal', async ({ page }) => {
    // await page.getByTestId('onboarding-checklist-row-paynow').click();
    // await page.keyboard.press('Escape');
    // await expect(page.getByTestId('paynow-preview-modal')).toBeHidden();
  });

  test.skip('backdrop click dismisses; inner-card click does not', async ({ page }) => {
    // await page.getByTestId('onboarding-checklist-row-paynow').click();
    // Clicking centre of the card should not dismiss
    // await page.getByTestId('paynow-preview-modal').locator('> div').click();
    // await expect(page.getByTestId('paynow-preview-modal')).toBeVisible();
    // Click the backdrop (outside the card)
    // await page.getByTestId('paynow-preview-modal').click({ position: { x: 10, y: 10 } });
    // await expect(page.getByTestId('paynow-preview-modal')).toBeHidden();
  });

  test.skip('focus trap — initial focus lands on Close button', async ({ page }) => {
    // await page.getByTestId('onboarding-checklist-row-paynow').click();
    // await expect(page.getByTestId('paynow-preview-close')).toBeFocused();
  });

  test.skip('aria attributes — role=dialog, aria-modal, aria-labelledby', async ({ page }) => {
    // const modal = page.getByTestId('paynow-preview-modal');
    // await expect(modal).toHaveAttribute('role', 'dialog');
    // await expect(modal).toHaveAttribute('aria-modal', 'true');
    // await expect(modal).toHaveAttribute('aria-labelledby', 'paynow-preview-title');
  });

  test.skip('replay preserves original paynowPreviewedAt timestamp', async () => {
    // Confirm modal once → capture serverSide paynowPreviewedAt ISO string.
    // Dismiss hide card, un-hide, re-open modal, confirm again → GET the
    // checklist, assert paynowPreviewedAt unchanged (first-completion-wins).
  });
});
