import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('legacy harness renders, scans axe, and captures a viewport screenshot', async ({ page }, info) => {
  test.skip(process.env.LEGACY !== '1', 'Runs only against the pre-redesign legacy UI.');
  await page.goto('/');
  await expect(page.locator('#board')).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(Array.isArray(results.violations)).toBe(true);
  const { mkdir } = await import('node:fs/promises');
  const { resolve } = await import('node:path');
  const dir = resolve(process.env.SCREENSHOT_DIR || 'test-results/screenshots', info.project.name);
  await mkdir(dir, { recursive: true });
  await page.screenshot({ path: resolve(dir, 'legacy-smoke.png'), fullPage: true });
});
