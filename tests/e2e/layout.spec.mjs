import { test, expect } from '@playwright/test';
import { openGame, shot, tid } from './helpers.mjs';

test('mobile board stays square and the page has no scroll', async ({ page }, info) => {
  await openGame(page);
  if (!info.project.name.startsWith('phone-')) test.skip();
  const metrics = await page.evaluate(() => {
    const board = document.querySelector('[data-testid="board"]').getBoundingClientRect();
    return { scrollHeight: document.scrollingElement.scrollHeight, innerHeight, width: board.width, height: board.height, bottom: board.bottom };
  });
  expect(metrics.scrollHeight).toBeLessThanOrEqual(metrics.innerHeight);
  expect(Math.abs(metrics.width - metrics.height)).toBeLessThanOrEqual(2);
  expect(metrics.bottom).toBeLessThanOrEqual(metrics.innerHeight);
  await shot(info, page, 'mobile-layout');
});
