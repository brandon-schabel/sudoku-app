import { test, expect } from '@playwright/test';
import { openGame, tid, testState } from './helpers.mjs';

test('manifest is linked and the installed service worker serves an intact offline reload', async ({ page, context }) => {
  await openGame(page);
  const manifest = await page.evaluate(async () => {
    const href = document.querySelector('link[rel="manifest"]')?.href;
    if (!href) return null;
    const response = await fetch(href);
    return response.ok ? response.json() : null;
  });
  expect(manifest?.name).toBeTruthy();
  await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) throw new Error('Service workers are unavailable');
    await navigator.serviceWorker.ready;
  });
  if (!(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)))) {
    await page.reload();
  }
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  const before = await testState(page);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator(tid('board'))).toBeVisible();
  const after = await testState(page);
  expect(after.id).toBe(before.id);
  expect(after.values).toEqual(before.values);
  await context.setOffline(false);
});
