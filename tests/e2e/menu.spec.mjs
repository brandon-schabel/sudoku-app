import { test, expect } from '@playwright/test';
import { openGame, shot, tid } from './helpers.mjs';

test('six themes, dark mode, and settings survive reload', async ({ page }, info) => {
  await openGame(page);
  await page.locator(tid('menu')).click();
  for (const theme of ['graphite', 'ocean', 'lavender', 'sand', 'rose', 'sage']) {
    await page.locator(tid(`theme-${theme}`)).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', /.+/);
  }
  await page.locator(tid('setting-dark-mode')).click();
  await page.reload();
  await expect(page.locator(tid('board'))).toBeVisible();
  await shot(info, page, 'themes-settings');
});

test('starting a new game preserves the previous game in Continue', async ({ page }, info) => {
  await openGame(page);
  await page.locator(tid('menu')).click();
  await page.locator(tid('menu-new')).click();
  await page.locator(tid('menu-continue')).click();
  await expect(page.locator(tid('continue-entry')).first()).toBeVisible();
  await shot(info, page, 'continue-archive');
});

test('legacy v1 save migrates on load', async ({ page }, info) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem('sudoku-app:game', JSON.stringify({ version: 1, state: { difficulty: 'easy' } }));
    localStorage.setItem('sudoku-app:settings', JSON.stringify({ theme: 'ocean' }));
  });
  await page.goto('/?test=1&seed=migration&difficulty=easy');
  await expect(page.locator(tid('board'))).toBeVisible();
  await shot(info, page, 'legacy-migration');
});
