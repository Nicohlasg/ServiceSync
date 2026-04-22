import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for ServiceSync (LR-2.3, LR-2.4).
 *
 * Two test groups:
 *   - tests/api  → API/webhook tests (idempotency proof for LR-2.3). Run
 *                  against a started Next.js dev server; no browser needed.
 *   - tests/e2e  → Five critical user journeys for LR-2.4. Run against
 *                  Chromium + Mobile Safari to cover the PWA install path.
 *
 * Environment:
 *   BASE_URL          → defaults to http://localhost:3000.
 *   NETS_WEBHOOK_SECRET → required for tests/api/webhook-idempotency to sign
 *                         the payload the server will accept.
 *
 * CI wires this via .github/workflows/e2e.yml. Locally, run:
 *   npx playwright install --with-deps
 *   npm run test:e2e
 */

const baseURL = process.env.BASE_URL ?? 'http://localhost:3000';
const isCI = Boolean(process.env.CI);
const mobileBrowserName: 'chromium' | 'webkit' =
  process.env.PLAYWRIGHT_MOBILE_BROWSER === 'webkit'
    ? 'webkit'
    : process.env.PLAYWRIGHT_MOBILE_BROWSER === 'chromium'
      ? 'chromium'
      : isCI
        ? 'webkit'
        : 'chromium';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'api',
      testMatch: /tests\/api\/.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'e2e-chromium',
      testMatch: /tests\/e2e\/.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'e2e-mobile-safari',
      testMatch: /tests\/e2e\/.*\.spec\.ts/,
      // Local WSL/dev hosts often lack the full GTK/GStreamer stack WebKit
      // needs. Default to iPhone emulation on Chromium locally, while CI
      // keeps true WebKit coverage. Override with PLAYWRIGHT_MOBILE_BROWSER.
      use: { ...devices['iPhone 14'], browserName: mobileBrowserName },
    },
  ],
  webServer: {
    command: 'npx turbo run dev --filter=@servicesync/web',
    url: baseURL,
    reuseExistingServer: !isCI,
    timeout: 120_000,
  },
});
