import { test, expect } from '@playwright/test';
import { openGame, shot, tid } from './helpers.mjs';

test('board is square, page does not scroll, and touch targets meet size minimums', async ({ page }, info) => {
  await openGame(page);
  const metrics = await page.evaluate(() => {
    const board = document.querySelector('[data-testid="board"]').getBoundingClientRect();
    const interactive = [...document.querySelectorAll('button, [role="gridcell"]')]
      .filter(node => !node.hidden && node.getClientRects().length)
      .map(node => ({ id: node.dataset.testid || node.dataset.index || node.textContent.trim(), width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height }));
    return { scrollWidth: document.scrollingElement.scrollWidth, scrollHeight: document.scrollingElement.scrollHeight, innerWidth, innerHeight, width: board.width, height: board.height, bottom: board.bottom, interactive };
  });
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.innerWidth);
  expect(metrics.scrollHeight).toBeLessThanOrEqual(metrics.innerHeight);
  expect(Math.abs(metrics.width - metrics.height)).toBeLessThanOrEqual(2);
  expect(metrics.bottom).toBeLessThanOrEqual(metrics.innerHeight);
  await shot(info, page, 'game');
  // Nine columns cannot exceed ~41px on a 390px phone, so board cells and the 9-key number pad
  // use a 36px floor (above WCAG 2.2 AA 24px); every other control must be 44px.
  const gridLike = target => /^(numpad-\d+|cell|\d+)$/.test(String(target.id));
  const undersized = metrics.interactive.filter(target => (gridLike(target) ? target.width < 36 || target.height < 36 : target.width < 44 || target.height < 44));
  expect(undersized, JSON.stringify(undersized)).toEqual([]);
});
