import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '@playwright/test';
import { openGame, shot, tid } from './helpers.mjs';

test('axe reports no serious or critical violations', async ({ page }, info) => {
  await openGame(page);
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((item) => ['serious', 'critical'].includes(item.impact))).toEqual([]);
  await shot(info, page, 'accessibility');
});

test('no browser console errors', async ({ page }, info) => {
  const errors = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await openGame(page);
  await expect(page.locator(tid('board'))).toBeVisible();
  expect(errors).toEqual([]);
  await shot(info, page, 'console-errors');
});
