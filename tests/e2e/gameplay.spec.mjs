import { test, expect } from '@playwright/test';
import { openGame, shot, tid, testState } from './helpers.mjs';

test('cell-first entry, notes, undo and redo persist across reload', async ({ page }, info) => {
  await openGame(page);
  const state = await testState(page);
  const index = state.puzzle.findIndex((value, i) => value === 0 && state.solution[i] !== 1);
  const cell = page.locator(`${tid('cell')}[data-index="${index}"]`);
  await cell.click();
  await page.locator(tid('numpad-1')).click();
  await expect(cell).toHaveAttribute('data-value', '1');
  await page.locator(tid('tool-undo')).click();
  await expect(cell).toHaveAttribute('data-value', '0');
  await page.locator(tid('tool-redo')).click();
  await expect(cell).toHaveAttribute('data-value', '1');
  await page.reload();
  await expect(page.locator(`${tid('cell')}[data-index="${index}"]`)).toHaveAttribute('data-value', '1');
  await page.locator(tid('tool-undo')).click();
  await page.locator(tid('tool-notes')).click();
  await page.locator(`${tid('cell')}[data-index="${index}"]`).click();
  await page.locator(tid('numpad-2')).click();
  await expect(page.locator(`${tid('cell')}[data-index="${index}"]`)).toHaveAttribute('data-value', '0');
  expect((await testState(page)).notes[index] & 2).toBeTruthy();
  await shot(info, page, 'game');
});

test('number-first mode selects a digit then places it into a cell', async ({ page }, info) => {
  await openGame(page);
  await page.evaluate(() => {
    const settings = JSON.parse(localStorage.getItem('sudoku:v2:settings'));
    settings.inputMode = 'number-first';
    localStorage.setItem('sudoku:v2:settings', JSON.stringify(settings));
  });
  await page.reload();
  const state = await testState(page);
  const index = state.puzzle.findIndex((value, i) => value === 0 && state.solution[i] !== 1);
  const cell = page.locator(`${tid('cell')}[data-index="${index}"]`);
  await page.locator(tid('numpad-1')).click();
  await expect(page.locator(tid('numpad-1'))).toHaveAttribute('aria-pressed', 'true');
  await cell.click();
  await expect(cell).toHaveAttribute('data-value', '1');
  await shot(info, page, 'game-number-first');
});

test('auto-notes fill candidates and count as assistance', async ({ page }) => {
  await openGame(page);
  await page.locator(tid('tool-autonotes')).click();
  const state = await testState(page);
  expect(state.assist.autoNotes).toBe(1);
  expect(state.notes.some(Boolean)).toBeTruthy();
});

test('placing a digit cleans matching notes from an editable peer', async ({ page }) => {
  await openGame(page);
  const state = await testState(page);
  const target = state.puzzle.findIndex((value, index) => index % 9 < 8 && value === 0 && state.puzzle[index + 1] === 0);
  const peer = target + 1;
  const digit = state.solution[target];
  await page.locator(tid('tool-notes')).click();
  await page.locator(`${tid('cell')}[data-index="${peer}"]`).click();
  await page.locator(tid(`numpad-${digit}`)).click();
  expect((await testState(page)).notes[peer] & (1 << (digit - 1))).toBeTruthy();
  await page.locator(tid('tool-notes')).click();
  await page.locator(`${tid('cell')}[data-index="${target}"]`).click();
  await page.locator(tid(`numpad-${digit}`)).click();
  expect((await testState(page)).notes[peer] & (1 << (digit - 1))).toBe(0);
});

test('three hint steps change explanation and trying it records assistance', async ({ page }, info) => {
  await openGame(page);
  await page.locator(tid('tool-hint')).click();
  const panel = page.locator(tid('hint-panel'));
  await expect(panel).toBeVisible();
  const first = await panel.innerText();
  await page.locator(tid('hint-next')).click();
  const second = await panel.innerText();
  await page.locator(tid('hint-next')).click();
  const third = await panel.innerText();
  expect(new Set([first, second, third]).size).toBe(3);
  await shot(info, page, 'hint');
  await page.locator(tid('hint-fill')).click();
  await expect(panel).toBeHidden();
  await page.locator(tid('tool-check')).click();
  const state = await testState(page);
  expect(state.assist.hints).toBe(1);
  expect(state.assist.checks).toBe(1);
});

test('I’ll try it closes the hint without filling and records assistance', async ({ page }) => {
  await openGame(page);
  const before = await testState(page);
  await page.locator(tid('tool-hint')).click();
  await page.locator(tid('hint-try')).click();
  await expect(page.locator(tid('hint-panel'))).toBeHidden();
  const after = await testState(page);
  expect(after.assist.hints).toBe(before.assist.hints + 1);
  expect(after.values).toEqual(before.values);
});

test('check marks wrong entries without ending the game', async ({ page }) => {
  await openGame(page);
  const state = await testState(page);
  const index = state.puzzle.findIndex((value, i) => value === 0 && state.solution[i] !== 1);
  await page.locator(`${tid('cell')}[data-index="${index}"]`).click();
  await page.locator(tid('numpad-1')).click();
  await page.locator(tid('tool-check')).click();
  expect((await testState(page)).completed).toBe(false);
  await expect(page.locator(tid('win-dialog'))).toBeHidden();
});

test('keyboard navigation, digit entry, erase, undo, redo, notes, hint and pause work', async ({ page }) => {
  await openGame(page);
  const state = await testState(page);
  const index = state.puzzle.findIndex((value, i) => i % 9 < 8 && value === 0 && state.puzzle[i + 1] === 0 && state.solution[i + 1] !== 2);
  const cell = page.locator(`${tid('cell')}[data-index="${index}"]`);
  await cell.focus();
  await page.keyboard.press('ArrowRight');
  const selected = page.locator(`${tid('cell')}[data-selected="true"]`);
  await expect(selected).toHaveAttribute('data-index', String(index + 1));
  await page.keyboard.press('2');
  await expect(selected).toHaveAttribute('data-value', '2');
  await page.keyboard.press('Control+z');
  await expect(selected).toHaveAttribute('data-value', '0');
  await page.keyboard.press('Control+Shift+z');
  await expect(selected).toHaveAttribute('data-value', '2');
  await page.keyboard.press('Delete');
  await page.keyboard.press('Backspace');
  await page.keyboard.press('n');
  await page.keyboard.press('3');
  expect((await testState(page)).notes[index + 1] & 4).toBeTruthy();
  await page.keyboard.press('h');
  await expect(page.locator(tid('hint-panel'))).toBeVisible();
  await page.keyboard.press('p');
  await expect(page.locator(tid('menu'))).toBeVisible();
});

test('onboarding appears on first test-mode load and can be skipped', async ({ page }, info) => {
  await page.goto('/?test=1&seed=onboarding&difficulty=easy');
  await expect(page.locator(tid('onboarding-dialog'))).toBeVisible();
  await expect(page.locator(tid('board'))).toBeVisible();
  await page.getByRole('button', { name: 'Skip introduction' }).click();
  await expect(page.locator(tid('onboarding-dialog'))).toBeHidden();
  expect(await page.evaluate(() => window.__sudoku.settings().onboardingDone)).toBe(true);
  await shot(info, page, 'game');
});
