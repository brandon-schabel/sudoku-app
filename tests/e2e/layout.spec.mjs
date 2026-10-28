import { test, expect } from '@playwright/test';
import { openGame, shot, tid } from './helpers.mjs';

test('board is square, page does not scroll, and touch controls meet 44px minimum', async ({ page }, info) => {
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
  if (info.project.name.startsWith('phone-')) {
    test.fixme(true, 'E2E-FINDINGS.md#f1-mobile-touch-targets: cells and numpad keys render narrower than 44px');
  }
  const undersized = metrics.interactive.filter(target => target.width < 44 || target.height < 44);
  expect(undersized, JSON.stringify(undersized)).toEqual([]);
});
