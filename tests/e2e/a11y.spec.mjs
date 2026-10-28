import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '@playwright/test';
import { openGame, openMenu, settleAnimations, shot, tid } from './helpers.mjs';

async function scan(page, label) {
  await settleAnimations(page);
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter(({ impact }) => ['serious', 'critical'].includes(impact)), label).toEqual([]);
}

test('captures menu, stats, calendar, settings, themes, and dark surfaces', async ({ page }, info) => {
  await openGame(page);
  await shot(info, page, 'game');
  await openMenu(page);
  await shot(info, page, 'menu');
  for (const [view, name] of [['stats', 'stats'], ['daily', 'daily-calendar'], ['settings', 'settings']]) {
    await page.locator(tid('menu-return')).click();
    await openMenu(page, view);
    await shot(info, page, name);
    if (view === 'settings') {
      await shot(info, page, 'themes');
      await page.locator(`${tid('setting-colorMode')} input[value="dark"]`).check();
      await shot(info, page, 'dark');
    }
  }
});

test('axe finds no serious or critical issue on game and every menu view in light and dark', async ({ page }, info) => {
  await openGame(page);
  await scan(page, 'game light');
  await shot(info, page, 'game');
  const views = ['menu', 'continue', 'daily', 'new', 'stats', 'settings', 'howto', 'tools'];
  for (const mode of ['light', 'dark']) {
    for (const view of views) {
      await openMenu(page);
      if (mode === 'dark') {
        await page.locator(tid('menu-settings')).click();
        await page.locator(`${tid('setting-colorMode')} input[value="dark"]`).check();
        if (view !== 'settings') {
          await page.locator(tid('menu-back')).click();
          if (view !== 'menu') await page.locator(tid(`menu-${view}`)).click();
        }
      } else if (view !== 'menu') {
        await page.locator(tid(`menu-${view}`)).click();
      }
      await scan(page, `${view} ${mode}`);
      if (mode === 'dark' && view === 'menu') await shot(info, page, 'dark');
      if (mode === 'light' && view === 'menu') await shot(info, page, 'menu');
      await page.locator(tid('menu-return')).click();
    }
    if (mode === 'dark') {
      await openMenu(page, 'settings');
      await page.locator(`${tid('setting-colorMode')} input[value="light"]`).check();
      await page.locator(tid('menu-return')).click();
    }
  }
});

test('no browser console errors on the real app', async ({ page }) => {
  const errors = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await openGame(page);
  await expect(page.locator(tid('board'))).toBeVisible();
  expect(errors).toEqual([]);
});
