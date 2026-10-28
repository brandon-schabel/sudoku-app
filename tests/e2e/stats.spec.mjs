import { test, expect } from '@playwright/test';
import { openGame, openMenu, shot, tid, testState } from './helpers.mjs';

test('winning records one game, shows win flow and appears in statistics', async ({ page }, info) => {
  await openGame(page);
  await page.evaluate(() => window.__sudoku.fillAllBut(1));
  const state = await testState(page);
  const index = state.values.findIndex((value, i) => value !== state.solution[i]);
  await page.locator(`${tid('cell')}[data-index="${index}"]`).click();
  await page.locator(tid(`numpad-${state.solution[index]}`)).click();
  await expect(page.locator(tid('win-dialog'))).toBeVisible();
  await shot(info, page, 'win');
  await page.getByRole('button', { name: /statistics/i }).click();
  await expect(page.locator(tid('stats-tab-all'))).toBeVisible();
  await expect(page.getByRole('table').locator('caption')).toContainText('1 puzzles solved');
  await page.locator(tid('stats-tab-unassisted')).click();
  await expect(page.locator(tid('stats-tab-unassisted'))).toHaveAttribute('aria-selected', 'true');
  await page.locator(tid('stats-tab-assisted')).click();
  await expect(page.locator(tid('stats-tab-assisted'))).toHaveAttribute('aria-selected', 'true');
  await page.locator(tid('stats-tab-all')).click();
  await shot(info, page, 'stats');
});

test('daily calendar has no streak text and offers dates', async ({ page }, info) => {
  await openGame(page);
  await openMenu(page, 'daily');
  await expect(page.locator(tid('daily-calendar'))).toBeVisible();
  await expect(page.getByText(/streak/i)).toHaveCount(0);
  await expect(page.locator(`${tid('daily-calendar')} [data-date]`).first()).toBeVisible();
  await shot(info, page, 'daily-calendar');
});

test('win flow records an assisted result after using a hint', async ({ page }) => {
  await openGame(page);
  await page.locator(tid('tool-hint')).click();
  await expect(page.locator(tid('hint-panel'))).toBeVisible();
  await page.locator(tid('hint-try')).click();
  await page.evaluate(() => window.__sudoku.fillAllBut(1));
  const state = await testState(page);
  const index = state.values.findIndex((value, i) => value !== state.solution[i]);
  await page.locator(`${tid('cell')}[data-index="${index}"]`).click();
  await page.locator(tid(`numpad-${state.solution[index]}`)).click();
  await expect(page.locator(tid('win-dialog'))).toBeVisible();
  await page.getByRole('button', { name: /statistics/i }).click();
  await page.locator(tid('stats-tab-assisted')).click();
  await expect(page.getByRole('table').locator('caption')).toContainText('1 puzzles solved');
});
