import { defineConfig } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const screenshotDir = process.env.SCREENSHOT_DIR || 'test-results/screenshots';
mkdirSync(screenshotDir, { recursive: true });
const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  outputDir: 'test-results/e2e',
  use: { baseURL, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  projects: [
    { name: 'phone-portrait', use: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true } },
    { name: 'phone-landscape', use: { viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true } },
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
    { name: 'tablet', use: { viewport: { width: 820, height: 1180 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true } }
  ],
  webServer: process.env.BASE_URL ? undefined : { command: 'node tools/serve.mjs', url: baseURL, reuseExistingServer: !process.env.CI, timeout: 30_000 }
});
