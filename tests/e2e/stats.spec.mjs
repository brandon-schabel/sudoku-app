import { test, expect } from '@playwright/test';
import { openGame, shot, tid } from './helpers.mjs';

test('win flow updates stats and displays the win dialog', async ({ page }, info) => {
  await openGame(page);
  await page.evaluate(() => window.__sudoku.fillAllBut(1));
  const state = await page.evaluate(() => window.__sudoku.state());
  const index = state.values.findIndex((value) => value === 0);
  await page.locator(tid(`cell`)).nth(index).click();
  const solution = await page.evaluate(() => window.__sudoku.state().solution);
  await page.locator(tid(`numpad-${solution[index]}`)).click();
  await expect(page.locator(tid('win-dialog'))).toBeVisible();
  await page.locator(tid('menu')).click();
  await page.locator(tid('menu-stats')).click();
  await expect(page.locator(tid('stats-tab-all'))).toBeVisible();
  await shot(info, page, 'win-stats');
});

test('daily calendar has no streak text', async ({ page }, info) => {
  await openGame(page);
  await page.locator(tid('menu')).click();
  await page.locator(tid('menu-daily')).click();
  await expect(page.locator(tid('daily-calendar'))).toBeVisible();
  await expect(page.getByText(/streak/i)).toHaveCount(0);
  await shot(info, page, 'daily-calendar');
});
