import { defineConfig } from '@playwright/test';

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  outputDir: 'test-results/e2e',
  use: { baseURL, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  projects: [
    { name: 'phone-portrait', use: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true } },
    { name: 'phone-landscape', use: { viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true } },
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
    { name: 'tablet', use: { viewport: { width: 820, height: 1180 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true } }
  ],
  webServer: process.env.BASE_URL ? undefined : { command: 'node tests/e2e/server.mjs', url: baseURL, reuseExistingServer: false, timeout: 30_000 }
});
