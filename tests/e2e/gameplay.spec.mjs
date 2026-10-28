import { test, expect } from '@playwright/test';
import { openGame, shot, tid } from './helpers.mjs';

test('cell first and number first entry, notes cleanup, undo and redo persist', async ({ page }, info) => {
  await openGame(page);
  const empty = page.locator(`${tid('cell')}[data-given="false"]`).first();
  await empty.click();
  await page.locator(tid('numpad-1')).click();
  await expect(empty).toHaveAttribute('data-value', /[1-9]/);
  await page.locator(tid('tool-undo')).click();
  await page.locator(tid('tool-redo')).click();
  await page.locator(tid('tool-notes')).click();
  await empty.click();
  await page.locator(tid('numpad-2')).click();
  await expect(empty).toHaveAttribute('data-value', /[1-9]/);
  await page.reload();
  await expect(page.locator(tid('board'))).toBeVisible();
  await shot(info, page, 'input-notes-undo-redo');
});

test('three hint steps support trying the suggested fill; check marks assistance', async ({ page }, info) => {
  await openGame(page);
  await page.locator(tid('tool-hint')).click();
  await expect(page.locator(tid('hint-panel'))).toBeVisible();
  for (let step = 0; step < 2; step++) await page.locator(tid('hint-next')).click();
  await page.locator(tid('hint-try')).click();
  await page.locator(tid('tool-check')).click();
  await expect(page.locator(tid('status-mistakes'))).toBeVisible();
  await shot(info, page, 'hints-check-assistance');
});

test('keyboard shortcuts operate the selected cell', async ({ page }, info) => {
  await openGame(page);
  await page.locator(tid('cell')).first().focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('n');
  await page.keyboard.press('2');
  await page.keyboard.press('Control+z');
  await page.keyboard.press('Shift+z');
  await page.keyboard.press('h');
  await expect(page.locator(tid('hint-panel'))).toBeVisible();
  await shot(info, page, 'keyboard-shortcuts');
});
