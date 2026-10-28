import { test, expect } from '@playwright/test';
import { openGame, openMenu, shot, tid, testState } from './helpers.mjs';

test('six themes and dark appearance persist after reload', async ({ page }, info) => {
  await openGame(page);
  await openMenu(page, 'settings');
  await page.locator(`${tid('setting-colorMode')} input[value="light"]`).check();
  for (const theme of ['graphite', 'ocean', 'lavender', 'sand', 'rose', 'sage']) {
    await page.locator(tid(`theme-${theme}`)).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'light');
    expect(await page.evaluate(() => window.__sudoku.settings().theme)).toBe(theme);
  }
  await page.locator(`${tid('setting-colorMode')} input[value="dark"]`).check();
  for (const theme of ['graphite', 'ocean', 'lavender', 'sand', 'rose', 'sage']) {
    await page.locator(tid(`theme-${theme}`)).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark');
  }
  await page.locator(tid('menu-return')).click();
  await page.reload();
  await expect(page.locator(tid('board'))).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'sage');
  await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark');
  const settings = await page.evaluate(() => window.__sudoku.settings());
  expect(settings.colorMode).toBe('dark');
  expect(settings.theme).toBe('sage');
  await shot(info, page, 'themes');
});

test('continue archive preserves active puzzle when starting another game', async ({ page }, info) => {
  await openGame(page);
  const originalId = (await testState(page)).id;
  await openMenu(page, 'new');
  await page.locator(tid('new-easy')).click();
  const confirm = page.locator(tid('menu-confirm'));
  if (await confirm.isVisible().catch(() => false)) await confirm.click();
  await expect.poll(async () => (await testState(page)).id).not.toBe(originalId);
  await openMenu(page, 'continue');
  await expect(page.locator(tid('continue-entry'))).toHaveCount(2);
  await expect(page.locator(`${tid('continue-entry')}[data-entry-id="${originalId}"]`)).toBeVisible();
  await shot(info, page, 'continue-archive');
});

test('real v1 storage envelope migrates the game and theme without deleting legacy keys', async ({ page }) => {
  await openGame(page);
  const current = await testState(page);
  const game = Object.fromEntries(['difficulty', 'puzzle', 'solution', 'values', 'notes', 'mistakes', 'elapsedMs', 'running', 'completed', 'history', 'createdAt'].map(key => [key, current[key]]));
  Object.assign(game, { hints: 0, gameOverShown: false });
  await page.addInitScript(({ game }) => {
    localStorage.clear();
    localStorage.setItem('sudoku-app:game', JSON.stringify({ version: 1, savedAt: 1700000000000, game }));
    localStorage.setItem('sudoku-app:settings', JSON.stringify({ theme: 'dark' }));
  }, { game });
  await page.goto('/?test=1');
  await page.locator(tid('board')).waitFor();
  const restored = await testState(page);
  expect(restored.puzzle).toEqual(current.puzzle);
  expect(restored.solution).toEqual(current.solution);
  expect(restored.values).toEqual(current.values);
  expect(restored.assist.hints).toBe(0);
  await expect.poll(() => page.evaluate(() => window.__sudoku.settings().colorMode)).toBe('dark');
  expect(await page.evaluate(() => localStorage.getItem('sudoku-app:game'))).not.toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('sudoku-app:settings'))).not.toBeNull();
});

test('settings include default-off sound and haptics plus accessibility controls', async ({ page }, info) => {
  await openGame(page);
  let settings = await page.evaluate(() => window.__sudoku.settings());
  expect(settings.sounds).toBe(false);
  expect(settings.haptics).toBe(false);
  await openMenu(page, 'settings');
  for (const [key, value] of [['colorblind', true], ['showTimer', false], ['sounds', true], ['haptics', true]]) {
    const control = page.locator(tid(`setting-${key}`));
    if (await control.isVisible()) {
      if (await control.isChecked() !== value) await control.click();
    }
  }
  await page.locator(`${tid('setting-textSize')} input[value="large"]`).check();
  await page.locator(`${tid('setting-reducedMotion')} input[value="on"]`).check();
  await expect(page.locator('html')).toHaveAttribute('data-cb', '1');
  await expect(page.locator('html')).toHaveAttribute('data-text', 'large');
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduce');
  settings = await page.evaluate(() => window.__sudoku.settings());
  expect(settings.showTimer).toBe(false);
  expect(settings.sounds).toBe(true);
  expect(settings.haptics).toBe(true);
  await shot(info, page, 'settings');
});
