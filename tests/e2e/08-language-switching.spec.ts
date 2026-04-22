import { test, expect } from '@playwright/test';

/**
 * P0 Task 11 — Language picker + NEXT_LOCALE cookie handshake.
 *
 * The locale switch is observable at three layers:
 *   1. Cookie:    NEXT_LOCALE set to the chosen BCP-47 tag
 *   2. DOM:       <html lang="..."> reflects the active locale
 *   3. Rendered:  the landing hero translates per locale's messages file
 *
 * Layer 1 + 2 + 3 are testable without auth because the cookie alone is
 * enough for anonymous sessions (§LocalePicker commit() path swallows the
 * UNAUTHORIZED from the profile-write tRPC mutation).
 *
 * Layer-4 (DB write to `profiles.preferred_locale`) requires auth — see
 * the .skip() block. Enable once the Supabase test fixture is wired.
 *
 * Coverage goals (qa-checklist §6):
 *   • Cookie write + hard reload re-renders the page in the chosen locale
 *   • <html lang> updates on every commit
 *   • `?lng=` query-string pre-seeds the cookie (middleware contract)
 *   • Re-selecting the active locale is a no-op (no reload)
 *   • Unauthenticated users see no error toast on switch
 */

const LOCALES: Array<{ tag: string; htmlLang: string }> = [
  { tag: 'en-SG', htmlLang: 'en-SG' },
  { tag: 'zh-Hans-SG', htmlLang: 'zh-Hans-SG' },
  { tag: 'ms-SG', htmlLang: 'ms-SG' },
  { tag: 'ta-SG', htmlLang: 'ta-SG' },
];

test.describe('Language switching', () => {
  test('landing page respects NEXT_LOCALE cookie on first paint', async ({ page, context }) => {
    await context.addCookies([
      { name: 'NEXT_LOCALE', value: 'zh-Hans-SG', url: 'http://localhost:3000' },
    ]);
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-Hans-SG');
  });

  test('?lng= query-string pre-seeds the cookie via middleware', async ({ page, context }) => {
    await page.goto('/?lng=ms-SG');
    const cookies = await context.cookies();
    const nextLocale = cookies.find((c) => c.name === 'NEXT_LOCALE');
    expect(nextLocale?.value).toBe('ms-SG');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ms-SG');
  });

  test('invalid locale in ?lng= falls back to default (en-SG)', async ({ page }) => {
    await page.goto('/?lng=xx-YY');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en-SG');
  });

  for (const { tag, htmlLang } of LOCALES) {
    test(`cookie ${tag} renders <html lang="${htmlLang}">`, async ({ page, context }) => {
      await context.addCookies([
        { name: 'NEXT_LOCALE', value: tag, url: 'http://localhost:3000' },
      ]);
      await page.goto('/');
      await expect(page.locator('html')).toHaveAttribute('lang', htmlLang);
    });
  }

  test.skip('chip variant: tapping a new locale updates cookie + hard reloads', async ({ page }) => {
    // Requires landing page to be scaffolded and render <LocalePicker variant="chip" />.
    // Asserts:
    //   - button with aria-haspopup="listbox" visible
    //   - tapping opens a role="listbox" with 4 role="option" children
    //   - clicking zh-Hans-SG sets cookie + triggers navigation
    //   - new page render has <html lang="zh-Hans-SG">
  });

  test.skip('cards variant on wizard step 1 persists to profile', async ({ page }) => {
    // Requires auth fixture + scaffolded /dashboard/onboarding.
    //   - await page.goto('/dashboard/onboarding');
    //   - await page.getByRole('radio', { name: /Bahasa/i }).click();
    //   - await page.waitForURL(/dashboard\/onboarding/); // hard reload
    //   - verify tRPC setPreferredLocale was called via network assertion
  });

  test.skip('unauthenticated switch swallows UNAUTHORIZED — no error toast', async ({ page }) => {
    // Load landing with a signed-out session; open the chip and switch
    // locale. Assert no Sonner toast with text "Couldn't save".
  });

  test.skip('re-selecting the already-active locale is a no-op', async ({ page }) => {
    // Assert no navigation, no cookie rewrite, no analytics event.
  });

  test.skip('`onboarding_language_selected` fires with correct stage', async () => {
    // Instrument window.__analyticsEvents; switch from chip on landing —
    // expect stage='landing'. Switch on wizard step 1 — expect stage='wizard'.
  });
});
