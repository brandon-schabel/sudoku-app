import { test, expect } from '@playwright/test';
import { openGame, shot, tid } from './helpers.mjs';

test('reload remains available offline after service worker installation', async ({ page, context }, info) => {
  await openGame(page);
  await page.evaluate(async () => { if ('serviceWorker' in navigator) await navigator.serviceWorker.ready; });
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator(tid('board'))).toBeVisible();
  await context.setOffline(false);
  await shot(info, page, 'offline-reload');
});
