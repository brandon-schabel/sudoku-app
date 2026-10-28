import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

export const testMode = '?test=1&seed=e-quality&difficulty=easy';
export const tid = (id) => `[data-testid="${id}"]`;

/** Wait for finite CSS transitions/animations before measuring or capturing. */
export async function settleAnimations(page) {
  await page.evaluate(() => Promise.all(document.getAnimations({ subtree: true })
    .filter(animation => animation.effect?.getComputedTiming().iterations !== Infinity)
    .map(animation => animation.finished.catch(() => {}))));
}

/** Open a seeded game and dismiss first-run onboarding for ordinary flows. */
export async function openGame(page) {
  await page.goto(`/${testMode}`);
  await page.locator(tid('board')).waitFor();
  const skip = page.getByRole('button', { name: 'Skip introduction' });
  if (await skip.isVisible().catch(() => false)) await skip.click();
}

/** Capture a full-page screenshot under SCREENSHOT_DIR/project/name.png. */
export async function shot(testInfo, page, name) {
  const dir = resolve(process.env.SCREENSHOT_DIR || 'test-results/screenshots', testInfo.project.name);
  await mkdir(dir, { recursive: true });
  await settleAnimations(page);
  await page.screenshot({ path: resolve(dir, `${name}.png`), fullPage: true });
}

export async function openMenu(page, view = null) {
  await page.locator(tid('pause')).click();
  if (view) await page.locator(tid(`menu-${view}`)).click();
}

export async function testState(page) { return page.evaluate(() => window.__sudoku.state()); }
