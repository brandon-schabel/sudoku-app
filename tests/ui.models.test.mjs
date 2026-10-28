import test from 'node:test';
import assert from 'node:assert/strict';
import { cellLabel, createMenuMachine, formatTime, formatDate, pauseSummary, shiftMonth, calendarModel, archiveModel, statsModel, importSummary, shouldCallFacadeResume } from '../src/ui/menu/models.js';
import { promptForReview, reviewPromptDecision, winModel } from '../src/ui/win.js';
import { readBackupFile } from '../src/ui/menu/views.js';
import { ONBOARDING_STEPS } from '../src/ui/onboarding.js';
import { DEFAULT_SETTINGS, emptyArchive } from '../src/domain/index.js';
import { shouldPromptReview } from '../src/domain/index.js';

const assist = { hints: 0, checks: 0, reveals: 0, errorsShown: 0, autoNotes: 0 };
const game = { id: 'one', difficulty: 'easy', puzzle: Array(81).fill(0), values: Array(81).fill(0), elapsedMs: 919000, mistakes: 0, assist };
const record = (i, overrides = {}) => ({ id: `game-${i}`, difficulty: 'easy', elapsedMs: i * 60000, score: 2200 - i * 10, completedAt: Date.UTC(2026, 0, i), mistakes: i, assist: { ...assist }, assisted: false, ...overrides });

test('format time handles zero, seconds, hour boundaries, and invalid input', () => {
  for (const [input, expected] of [[0, '0:00'], [999, '0:00'], [1000, '0:01'], [919000, '15:19'], [3599999, '59:59'], [3600000, '1:00:00'], [3661000, '1:01:01'], [360000000, '100:00:00'], [-1000, '0:00'], [NaN, '—'], [Infinity, '—'], [null, '—'], [undefined, '—']]) assert.equal(formatTime(input), expected);
});

test('saved timestamps are deterministic in an explicit locale and time zone', () => {
  assert.equal(formatDate(undefined), 'Unknown date');
  assert.equal(formatDate(NaN), 'Unknown date');
  assert.equal(formatDate(1e20), 'Unknown date');
  assert.equal(formatDate(Date.UTC(2026, 0, 2), { locale: 'en-US', timeZone: 'UTC' }), 'Jan 2, 2026, 12:00 AM');
});

test('pause summary uses facade snapshot and correct singulars', () => {
  assert.equal(pauseSummary(game), 'Easy · 15:19 · 0 mistakes · 0 hints');
  assert.equal(pauseSummary({ ...game, difficulty: 'expert', mistakes: 1, assist: { hints: 1 } }), 'Expert · 15:19 · 1 mistake · 1 hint');
  assert.equal(pauseSummary(null), 'A little space to think.');
});

test('month movement crosses years and leaps without local time shifts', () => {
  assert.deepEqual(shiftMonth(2026, 12, 1), { year: 2027, month: 1 });
  assert.deepEqual(shiftMonth(2026, 1, -1), { year: 2025, month: 12 });
  assert.deepEqual(shiftMonth(2024, 1, 1), { year: 2024, month: 2 });
  assert.deepEqual(shiftMonth(2020, 1, -1, { minYear: 2024, minMonth: 3, maxYear: 2026, maxMonth: 2 }), { year: 2024, month: 3 });
  assert.deepEqual(shiftMonth(2026, 2, 1, { minYear: 2024, minMonth: 3, maxYear: 2026, maxMonth: 2 }), { year: 2026, month: 2 });
});

test('cell labels name coordinates, values, empty cells, and givens', () => {
  assert.equal(cellLabel(2, 1, true), 'Row 1, column 3, 1, given');
  assert.equal(cellLabel(80, 9, false), 'Row 9, column 9, 9');
  assert.equal(cellLabel(0, 0, false), 'Row 1, column 1, empty');
});

test('menu state machine routes back, clears pending confirmation, and guards busy actions', () => {
  const machine = createMenuMachine();
  const allowed = new Set(['menu', 'stats']);
  assert.equal(machine.navigate('stats', allowed), true);
  assert.equal(machine.view, 'stats');
  assert.equal(machine.back(), 'navigate');
  assert.equal(machine.view, 'menu');
  machine.confirm({ title: 'Delete' });
  assert.equal(machine.back(), 'pending');
  assert.equal(machine.pending, null);
  assert.equal(machine.back(), 'resume');
  machine.confirm({ title: 'Pending before action' });
  assert.equal(machine.begin(), true);
  assert.equal(machine.navigate('stats', allowed), false);
  assert.equal(machine.confirm({}), false);
  assert.equal(machine.back(), 'blocked');
  assert.equal(machine.clearPending(), true);
  assert.equal(machine.pending, null);
  assert.equal(machine.begin(), false);
  machine.finish();
  assert.equal(machine.navigate('stats', allowed), true);
});

test('menu close callback and facade never both resume, and no-game close never resumes', () => {
  assert.equal(shouldCallFacadeResume(true, true), false);
  assert.equal(shouldCallFacadeResume(true, false), true);
  assert.equal(shouldCallFacadeResume(false, false), false);
});

test('calendar pads to complete weeks and includes leap day', () => {
  const result = calendarModel([], emptyArchive(), 2024, 2, '2024-02-20', { locale: 'en-US', timeZone: 'UTC' });
  assert.equal(result.title, 'February 2024');
  assert.equal(result.cells.length, 35);
  assert.equal(result.cells.slice(0, 4).every(cell => cell === null), true);
  const days = result.cells.filter(Boolean);
  assert.equal(days.length, 29);
  assert.equal(days.at(-1).dateKey, '2024-02-29');
  assert.equal(days.find(day => day.today).dateKey, '2024-02-20');
  assert.equal(days.find(day => day.dateKey === '2024-02-21').disabled, true);
  assert.equal(days.find(day => day.dateKey === '2024-02-19').disabled, false);
});

test('calendar preserves domain completed and active statuses, disables future days', () => {
  const archive = { activeId: 'a', entries: { a: { status: 'active', dailyKey: '2024-02-02' } } };
  const days = calendarModel([{ dailyKey: '2024-02-01' }], archive, 2024, 2, '2024-02-03').cells.filter(Boolean);
  assert.equal(days[0].status, 'completed');
  assert.equal(days[1].status, 'in-progress');
  assert.equal(days[2].today, true);
  assert.equal(days[3].disabled, true);
});

test('archive excludes completed games and formats only originally empty progress', () => {
  const puzzle = Array(81).fill(1); puzzle[10] = 0; puzzle[20] = 0;
  const values = puzzle.slice(); values[10] = 3;
  const entries = { older: { id: 'older', status: 'active', difficulty: 'hard', updatedAt: 1000, game: { ...game, puzzle, values }, recovery: [{ savedAt: 2000, game: { elapsedMs: 5000 } }, { savedAt: 3000, game: { elapsedMs: 6000 } }] }, newer: { id: 'newer', status: 'active', difficulty: 'easy', updatedAt: 4000, game, recovery: [] }, done: { status: 'completed', updatedAt: 5000 } };
  const before = JSON.stringify(entries);
  const result = archiveModel({ activeId: 'newer', entries });
  assert.deepEqual(result.map(entry => entry.id), ['newer', 'older']);
  assert.equal(result[1].progress, '1 of 2 cells filled');
  assert.equal(result[1].label, 'Hard');
  assert.equal(result[1].time, '15:19');
  assert.deepEqual(result[1].recovery.map(copy => copy.time), ['0:06', '0:05']);
  assert.equal(JSON.stringify(entries), before);
});

test('archive degrades corrupt entries and recovery copies without game snapshots', () => {
  const entries = {
    missing: { id: 'missing', status: 'active', difficulty: 'easy', updatedAt: 1, game: null, recovery: [] },
    usable: { id: 'usable', status: 'active', difficulty: 'easy', updatedAt: 2, game, recovery: [{ savedAt: 2, game: null }, { savedAt: 3, game: { elapsedMs: 4000 } }] },
  };
  const result = archiveModel({ activeId: 'usable', entries });
  assert.deepEqual(result.map(entry => entry.id), ['usable']);
  assert.deepEqual(result[0].recovery.map(copy => copy.time), ['0:04']);
});

test('empty archive and empty statistics have useful placeholders', () => {
  assert.deepEqual(archiveModel(emptyArchive()), []);
  const result = statsModel([]);
  assert.equal(result.total, 0);
  assert.equal(result.rows.length, 4);
  assert.ok(result.rows.every(row => row.average === '—' && row.best === '—' && row.points === '—'));
  assert.ok(result.trends.every(row => row.comparison === null));
});

test('statistics delegates filters, preserves zero best time, and caps recent at 20', () => {
  const records = Array.from({ length: 30 }, (_, i) => record(i, { assisted: i % 2 === 1, assist: { ...assist, reveals: i % 2 } }));
  const before = JSON.stringify(records);
  const all = statsModel(records);
  assert.equal(all.total, 30);
  assert.equal(all.recent.length, 20);
  assert.equal(all.recent[0].id, 'game-29');
  assert.equal(all.rows[0].best, '0:00');
  for (const filter of ['assisted', 'unassisted']) {
    const result = statsModel(records, filter);
    assert.equal(result.total, 15);
    assert.ok(result.recent.every(row => row.assisted === (filter === 'assisted')));
    assert.ok(result.trends.every(row => row.assisted === (filter === 'assisted')));
  }
  assert.equal(all.recent[0].reveals, 1);
  assert.equal(JSON.stringify(records), before);
});

test('trends compare latest and previous five only within their assistance category', () => {
  const records = Array.from({ length: 10 }, (_, i) => record(i + 1));
  records.push(record(100, { assisted: true }));
  const rows = statsModel(records).trends;
  const unassisted = rows.find(row => row.difficulty === 'easy' && !row.assisted).comparison;
  assert.equal(unassisted.latest.n, 5);
  assert.equal(unassisted.previous.n, 5);
  assert.equal(unassisted.deltaMs, 300000);
  assert.equal(rows.find(row => row.difficulty === 'easy' && row.assisted).comparison, null);
});

test('recent rows show reveals and all requested completion fields', () => {
  const row = statsModel([record(1, { difficulty: 'hard', assist: { reveals: 4 } })]).recent[0];
  assert.equal(row.label, 'Hard'); assert.equal(row.time, '1:00'); assert.equal(row.reveals, 4);
  assert.equal(row.mistakes, 1); assert.equal(row.assisted, false); assert.equal(row.score, 2190);
  assert.equal(row.date, formatDate(row.completedAt));
});

test('imported records with absent or nonnumeric scores render as zero', () => {
  const rows = statsModel([record(1, { score: undefined }), record(2, { score: 'bad' })]).recent;
  assert.deepEqual(rows.map(row => row.score), [0, 0]);
  assert.equal(statsModel([record(1, { score: undefined }), record(2, { score: 'bad' })]).rows[0].points, '0');
});

test('file imports reject oversized files before reading and accept files at the cap', async () => {
  let read = false;
  const oversized = { size: 5 * 1024 * 1024 + 1, async text() { read = true; return 'x'; } };
  await assert.rejects(readBackupFile(oversized), /5 MB or smaller/);
  assert.equal(read, false);
  assert.equal(await readBackupFile({ size: 5 * 1024 * 1024, async text() { return 'backup'; } }), 'backup');
});

test('import summary explains both puzzle preservation and settings conflicts', () => {
  assert.equal(importSummary({ added: { records: 2, entries: 3 }, conflicts: [] }), 'Imported 2 records and 3 puzzles.');
  const summary = importSummary({ added: { records: 1, entries: 2 }, conflicts: [{ kind: 'entry', id: 'a' }, { kind: 'settings', id: 'settings' }] });
  assert.match(summary, /both copies were kept/);
  assert.match(summary, /current settings were kept/);
});

test('win model respects supplied score and personal bests including zero', () => {
  const best = { isBestTime: false, isBestScore: true };
  const result = winModel([], { game, record: record(1), score: 0, personalBest: best });
  assert.equal(result.score, 0); assert.deepEqual(result.best, best); assert.equal(result.time, '1:00');
});

test('win fallback uses domain personal best and game assistance', () => {
  const current = record(2);
  const result = winModel([record(1), current], { game, record: current });
  assert.equal(result.best.isBestTime, false); assert.equal(result.best.isBestScore, false);
  assert.equal(winModel([], { game: { ...game, assist: { checks: 1 } } }).assisted, true);
});

test('review prompt requires policy eligibility and a persistence hook', () => {
  const records = Array.from({ length: 5 }, (_, i) => record(i + 1, { completedAt: i + 1, assisted: false }));
  assert.equal(shouldPromptReview({}, records, 10), true);
  assert.equal(reviewPromptDecision({}, records, false, 10), false);
  assert.equal(reviewPromptDecision({}, records, true, 10), true);
  assert.equal(reviewPromptDecision({ reviewPromptedAt: 10 }, records, true, 11), false);
});

test('review prompt persists the timestamp before asking the platform', async () => {
  const records = Array.from({ length: 5 }, (_, i) => record(i + 1, { completedAt: i + 1, assisted: false }));
  const events = [];
  const app = { data: () => ({ meta: {}, records }), actions: { setReviewPromptedAt(timestamp) { events.push(`persist:${timestamp}`); } } };
  const requested = await promptForReview(app, async () => { events.push('request'); return true; }, 12345);
  assert.equal(requested, true);
  assert.deepEqual(events, ['persist:12345', 'request']);
  assert.equal(await promptForReview({ ...app, actions: {} }, async () => false, 12345), false);
});

test('onboarding has four concise steps and settings default leaves it pending', () => {
  assert.equal(ONBOARDING_STEPS.length, 4);
  assert.equal(DEFAULT_SETTINGS.onboardingDone, false);
  assert.ok(ONBOARDING_STEPS.every(step => step.title && step.text));
  assert.match(ONBOARDING_STEPS.at(-1).title, /Just the puzzle. Always ad-free./);
});
