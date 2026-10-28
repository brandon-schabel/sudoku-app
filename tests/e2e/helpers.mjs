import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

export const testMode = '?test=1&seed=e-quality&difficulty=easy';
export const tid = (id) => `[data-testid="${id}"]`;
export async function openGame(page) { await page.goto(`/${testMode}`); await page.locator(tid('board')).waitFor(); }
export async function shot(test, page, name) {
  const dir = resolve(process.env.SCREENSHOT_DIR || 'test-results/screenshots', test.info().project.name);
  await mkdir(dir, { recursive: true });
  await page.screenshot({ path: resolve(dir, `${name}.png`), fullPage: true });
}
