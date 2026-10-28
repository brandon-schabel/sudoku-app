import test from 'node:test';
import assert from 'node:assert/strict';
import {
  THEMES, DEFAULT_SETTINGS, normalizeSettings, SCORE_BASE, PAR_MS, timeBonus,
  computeScore, isAssisted, createRecord, computeStats, trend, personalBest,
  dailyCalendar, emptyArchive, saveActive, startNew, resume, markCompleted,
  listUnfinished, restoreRecovery, removeEntry, ARCHIVE_LIMIT, STORAGE_KEYS,
  createStore, migrateLegacy, exportData, importData, shouldPromptReview, ImportError
} from '../src/domain/index.js';

const assist = (hints = 0) => ({ hints, checks: 0, reveals: 0, errorsShown: 0, autoNotes: 0 });
const rec = (id, completedAt, difficulty = 'easy', assisted = false, elapsedMs = 1000, score = 1000) => ({
  id, puzzleId: id, difficulty, assisted, completedAt, elapsedMs, score,
  assist: assist(assisted ? 1 : 0), mistakes: 0, dailyKey: null
});
const game = (id, n = 0, overrides = {}) => ({
  id, kind: 'random', dailyKey: null, difficulty: 'easy', createdAt: n,
  updatedAt: n, completed: false, completedAt: null, elapsedMs: 1000, mistakes: 0,
  assist: assist(), values: [n], ...overrides
});
const entry = (id, n = 0, overrides = {}) => ({
  id, kind: 'random', dailyKey: null, difficulty: 'easy', createdAt: n,
  updatedAt: n, status: 'active', game: game(id, n), recovery: [], ...overrides
});
const appData = ({ id = 'x', v = 1, theme = 'rose', records = [rec('r', 1)] } = {}) => ({
  schema: 2,
  settings: normalizeSettings({ theme }),
  archive: { activeId: id, entries: { [id]: entry(id, 1, { game: game(id, v) }) } },
  records,
  meta: { installedAt: 1, completedCount: records.length, reviewPromptedAt: null, migratedFrom: null }
});

test('settings normalization validates every setting and exposes immutable constants', () => {
  assert.equal(THEMES.length, 6);
  assert.equal(Object.isFrozen(THEMES), true);
  assert.equal(Object.isFrozen(DEFAULT_SETTINGS), true);
  const raw = {
    theme: 'ocean', colorMode: 'dark', highlightRelated: false, highlightSameDigit: false,
    showMistakes: false, cleanupNotes: false, showTimer: false, inputMode: 'number-first',
    colorblind: true, textSize: 'xlarge', reducedMotion: 'on', haptics: true, sounds: true,
    confirmNewGame: false, confirmRestart: false, lastDifficulty: 'expert', onboardingDone: true
  };
  const normalized = normalizeSettings(raw);
  for (const [key, value] of Object.entries(raw)) assert.equal(normalized[key], value, key);
  assert.equal(normalized.schema, 2);
  assert.equal(normalized.unknown, undefined);
  assert.equal(normalizeSettings({ theme: 'bad', textSize: 'huge' }).theme, 'graphite');
  assert.equal(normalizeSettings({ theme: 'bad', textSize: 'huge' }).textSize, 'default');
  assert.doesNotThrow(() => normalizeSettings(Symbol('x')));
  assert.doesNotThrow(() => normalizeSettings(new Proxy({}, { get() { throw Error('hostile getter'); } })));
});

test('scoring covers every difficulty, invalid elapsed values, clamped penalties and minimum', () => {
  assert.deepEqual(SCORE_BASE, { easy: 1000, medium: 2000, hard: 3000, expert: 4000 });
  assert.deepEqual(PAR_MS, { easy: 600000, medium: 900000, hard: 1500000, expert: 2400000 });
  assert.equal(timeBonus('easy', 0), 1200);
  assert.equal(timeBonus('easy', 600000), 600);
  assert.equal(timeBonus('easy', 1200000), 0);
  assert.equal(timeBonus('easy', -5), 1200);
  assert.equal(timeBonus('easy', NaN), 0);
  assert.equal(computeScore({ difficulty: 'easy', elapsedMs: 0, hints: 1, mistakes: 2 }), 2050);
  assert.equal(computeScore({ difficulty: 'medium', elapsedMs: 0 }), 3200);
  assert.equal(computeScore({ difficulty: 'hard', elapsedMs: 0 }), 4200);
  assert.equal(computeScore({ difficulty: 'expert', elapsedMs: 0 }), 5200);
  assert.equal(computeScore({ difficulty: 'easy', elapsedMs: 1200000, hints: 100, mistakes: 100 }), 100);
  const created = createRecord({ ...game('g', 0, { difficulty: 'hard', completedAt: 1, elapsedMs: 5000, mistakes: -4, assist: { ...assist(), hints: -3, checks: 2 } }) });
  assert.equal(created.assisted, true);
  assert.equal(created.assist.hints, 0);
  assert.equal(created.assist.checks, 2);
  assert.equal(created.mistakes, 0);
  assert.throws(() => createRecord({ ...game('bad'), completedAt: null }), /completedAt/);
  assert.throws(() => createRecord({ ...game('bad'), completedAt: 1, elapsedMs: NaN }), /elapsedMs/);
  assert.equal(isAssisted({ hints: 0, checks: 1 }), true);
  assert.equal(isAssisted({ hints: 0 }), false);
});

test('statistics values, filters, recent cap, trends and strict personal best ties', () => {
  const records = Array.from({ length: 12 }, (_, i) => rec(`r${i}`, i, 'easy', i % 2 === 0, 2000 - i * 10, 100 + i));
  const before = structuredClone(records);
  const all = computeStats(records, 'all');
  assert.equal(all.total, 12);
  assert.equal(all.byDifficulty.easy.avgMs, 1945);
  assert.equal(all.byDifficulty.easy.bestMs, 1890);
  assert.equal(all.byDifficulty.easy.bestScore, 111);
  assert.equal(all.byDifficulty.medium.avgMs, null);
  assert.equal(computeStats(records, 'unassisted').total, 6);
  assert.equal(computeStats(records, 'assisted').total, 6);
  assert.equal(computeStats(records, 'unexpected').total, 12);
  assert.equal(computeStats(Array.from({ length: 25 }, (_, i) => rec(`recent${i}`, i))).recent.length, 20);

  const trendRecords = Array.from({ length: 10 }, (_, i) => rec(`trend${i}`, i, 'easy', true, 2000 - i * 10, 100 + i));
  const trendResult = trend(trendRecords, { difficulty: 'easy', assisted: true });
  assert.deepEqual(trendResult.latest, { n: 5, avgMs: 1930, avgScore: 107 });
  assert.deepEqual(trendResult.previous, { n: 5, avgMs: 1980, avgScore: 102 });
  assert.equal(trendResult.deltaMs, -50);
  assert.equal(trendResult.deltaScore, 5);
  assert.equal(trend(trendRecords.slice(0, 9), { difficulty: 'easy', assisted: true }), null);
  assert.equal(trend([records[0]], { difficulty: 'easy', assisted: true }), null);

  const best = rec('best', 20, 'easy', false, 500, 2000);
  assert.deepEqual(personalBest(records, best), { isBestTime: true, isBestScore: true, previousBestMs: 1890, previousBestScore: 111 });
  const tie = personalBest([rec('prior', 1, 'easy', false, 500, 2000)], rec('tie', 2, 'easy', false, 500, 2000));
  assert.equal(tie.isBestTime, false);
  assert.equal(tie.isBestScore, false);
  assert.equal(personalBest([], rec('first', 2)).isBestTime, true);
  assert.deepEqual(records, before);
});

test('archive snapshots are isolated, immutable, rate limited and restored with unique times', () => {
  const initial = game('b', 1);
  const frozenGame = Object.freeze({ ...initial, values: Object.freeze([...initial.values]) });
  const empty = emptyArchive();
  const a = startNew(empty, frozenGame, 1);
  assert.deepEqual(frozenGame.values, [1]);
  assert.notEqual(a.entries.b.game, frozenGame);
  const changed = game('b', 2);
  const b = saveActive(a, changed, 30000);
  assert.equal(b.entries.b.recovery.length, 0);
  const c = saveActive(b, game('b', 3), 90001);
  assert.equal(c.entries.b.recovery.length, 1);
  assert.equal(c.entries.b.recovery[0].savedAt, 90001);
  assert.equal(c.entries.b.recovery[0].game.values[0], 2);
  let growing = c;
  for (let n = 4; n <= 7; n++) growing = saveActive(growing, game('b', n), n * 60000);
  assert.equal(growing.entries.b.recovery.length, 3);
  const snapshot = growing.entries.b.recovery[0];
  const restored = restoreRecovery(growing, 'b', snapshot.savedAt, 999999);
  assert.equal(restored.entries.b.game.values[0], snapshot.game.values[0]);
  assert.equal(restored.entries.b.status, 'active');
  assert.equal(restored.activeId, 'b');
  assert.equal(restored.entries.b.updatedAt, 999999);
  assert.equal(restored.entries.b.recovery[0].game.values[0], growing.entries.b.game.values[0]);
  assert.equal(restored.entries.b.recovery[0].savedAt, 999999);
  assert.equal(new Set(restored.entries.b.recovery.map(item => item.savedAt)).size, restored.entries.b.recovery.length);

  const completedSnapshot = game('done', 4, { completed: true, completedAt: 4 });
  const completedEntry = entry('done', 1, {
    status: 'completed',
    game: game('done', 5, { completed: true, completedAt: 5 }),
    recovery: [
      { savedAt: 4, game: completedSnapshot },
      { savedAt: 1, game: game('done', 2, { completed: false }) }
    ]
  });
  const completedRestore = restoreRecovery({ activeId: null, entries: { done: completedEntry } }, 'done', 4, 10);
  assert.equal(completedRestore.entries.done.status, 'completed');
  assert.equal(completedRestore.entries.done.game.completed, true);
  assert.equal(completedRestore.activeId, null);
  assert.equal(listUnfinished(completedRestore).length, 0);
  const activeRestore = restoreRecovery({ activeId: null, entries: { done: completedEntry } }, 'done', 1, 11);
  assert.equal(activeRestore.entries.done.status, 'active');
  assert.equal(activeRestore.entries.done.game.completed, false);
  assert.equal(activeRestore.activeId, 'done');

  assert.throws(() => saveActive(empty, { difficulty: 'easy' }), /id/);
  const completed = saveActive(empty, game('done', 0, { completed: true }), 2);
  assert.equal(completed.activeId, 'done');
  assert.equal(listUnfinished(completed).length, 0);
  assert.throws(() => saveActive(empty, { id: 'missing-kind', difficulty: 'easy' }), /kind/);
});

test('archive ordering, completion, duplicate ids, pruning, and input immutability', () => {
  let archive = emptyArchive();
  archive = startNew(archive, game('a', 1), 1);
  archive = startNew(archive, game('b', 2), 2);
  assert.equal(archive.activeId, 'b');
  assert.equal(archive.entries.a.game.values[0], 1);
  assert.deepEqual(listUnfinished(archive).map(item => item.id), ['b', 'a']);
  const duplicate = startNew(archive, game('a', 3), 3);
  assert.equal(duplicate.entries.a.game.values[0], 3);
  assert.equal(duplicate.entries.b.game.values[0], 2);
  assert.deepEqual(listUnfinished(duplicate).map(item => item.id), ['a', 'b']);
  assert.equal(resume(duplicate, 'a').activeId, 'a');
  assert.throws(() => resume(duplicate, 'missing'), /Unknown archive entry/);
  assert.throws(() => markCompleted(duplicate, 'missing'), /Unknown archive entry/);
  const done = markCompleted(resume(duplicate, 'b'), 'a', 10);
  assert.equal(done.entries.a.status, 'completed');
  assert.equal(done.entries.a.game.completed, true);
  assert.equal(done.activeId, 'b');
  assert.deepEqual(listUnfinished(done).map(item => item.id), ['b']);
  assert.equal(removeEntry(done, 'a').entries.a, undefined);
  assert.equal(ARCHIVE_LIMIT, 50);

  const manyDone = { activeId: 'live', entries: {} };
  for (let i = 0; i < 55; i++) manyDone.entries[`done${i}`] = entry(`done${i}`, i, { status: 'completed' });
  manyDone.entries.live = entry('live', 99);
  const pruned = saveActive(manyDone, game('next', 100), 100);
  assert.equal(Object.keys(pruned.entries).length, 50);
  assert.equal(pruned.entries.done0, undefined);
  assert.ok(pruned.entries.live);

  const unfinished = { activeId: null, entries: {} };
  for (let i = 0; i < 55; i++) unfinished.entries[`u${i}`] = entry(`u${i}`, i);
  const before = structuredClone(unfinished);
  const withUnfinished = saveActive(unfinished, game('u55', 99), 99);
  assert.equal(Object.keys(withUnfinished.entries).length, 56);
  assert.deepEqual(unfinished, before);

  const frozen = freezeDeep(structuredClone(done));
  assert.doesNotThrow(() => listUnfinished(frozen));
  assert.doesNotThrow(() => resume(frozen, 'b'));
  assert.doesNotThrow(() => markCompleted(frozen, 'b', 11));
  assert.doesNotThrow(() => restoreRecovery(frozen, 'b', -1, 12));
  assert.doesNotThrow(() => removeEntry(frozen, 'b'));
});

function freezeDeep(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freezeDeep);
    Object.freeze(value);
  }
  return value;
}

test('daily calendar has deterministic future and today boundaries and validates dates', () => {
  const rows = dailyCalendar([rec('d', 1, 'medium', false, 1, 1)], { entries: { x: entry('x', 1, { dailyKey: '2024-02-28' }) } }, 2024, 2, Date.UTC(2024, 1, 28, 23, 59));
  const calendarRecords = [rec('d', 1, 'medium', false, 1, 1)];
  const calendarArchive = { entries: { x: entry('x', 1, { dailyKey: '2024-02-28' }) } };
  const calendarBefore = structuredClone({ calendarRecords, calendarArchive });
  dailyCalendar(calendarRecords, calendarArchive, 2024, 2, Date.UTC(2024, 1, 28, 23, 59));
  assert.deepEqual({ calendarRecords, calendarArchive }, calendarBefore);
  assert.equal(rows.length, 29);
  assert.equal(rows[27].status, 'in-progress');
  assert.equal(rows[28].status, 'future');
  const today = dailyCalendar([], { entries: {} }, 2024, 2, Date.UTC(2024, 1, 29));
  assert.equal(today[28].status, 'none');
  assert.equal(today[27].status, 'none');
  assert.throws(() => dailyCalendar([], {}, 2024, 13), RangeError);
  assert.throws(() => dailyCalendar([], {}, 2024, 0), RangeError);
  assert.equal(dailyCalendar([], {}, 42, 1, Date.UTC(42, 0, 10)).length, 31);
  assert.ok(rows.every(row => !('streak' in row)));
});

class MemoryBackend {
  data = new Map();
  get length() { return this.data.size; }
  key(index) { return [...this.data.keys()][index] ?? null; }
  getItem(key) { return this.data.has(key) ? this.data.get(key) : null; }
  setItem(key, value) { this.data.set(key, String(value)); }
  removeItem(key) { this.data.delete(key); }
}

test('legacy migration is idempotent, upgrades ids, preserves sources and maps themes', () => {
  const backend = new MemoryBackend();
  const legacyGame = { difficulty: 'medium', createdAt: 10, values: [1] };
  backend.setItem('sudoku-app:game', JSON.stringify({ version: 1, savedAt: 20, game: legacyGame }));
  backend.setItem('sudoku-app:settings', JSON.stringify({ theme: 'dark' }));
  const first = createStore(backend, { now: () => 100 }).load();
  assert.equal(first.meta.migratedFrom, 1);
  assert.equal(first.settings.colorMode, 'dark');
  assert.equal(first.archive.entries['legacy-20'].game.id, 'legacy-20');
  assert.equal(first.archive.activeId, 'legacy-20');
  assert.ok(backend.getItem('sudoku-app:game'));
  assert.deepEqual(createStore(backend).load(), first);
  assert.deepEqual(migrateLegacy(backend, { now: () => 100 }), migrateLegacy(backend, { now: () => 100 }));

  for (const [theme, mode] of [['auto', 'system'], ['light', 'light']]) {
    const b = new MemoryBackend();
    b.setItem('sudoku-app:settings', JSON.stringify({ theme }));
    assert.equal(createStore(b, { now: () => 1 }).load().settings.colorMode, mode);
  }

  const completedBackend = new MemoryBackend();
  completedBackend.setItem('sudoku-app:game', JSON.stringify({ version: 1, savedAt: 20, game: { ...game(undefined, 0, { completed: true, elapsedMs: 450000 }), id: undefined, completedAt: 15 } }));
  const migratedCompleted = createStore(completedBackend, { now: () => 100 }).load();
  assert.equal(migratedCompleted.records.length, 1);
  assert.equal(migratedCompleted.records[0].id, 'legacy-20');
  assert.equal(migratedCompleted.records[0].score, computeScore({
    difficulty: 'easy', elapsedMs: 450000, hints: 0, mistakes: 0
  }));
});

test('loading malformed archive elements and records preserves corrupt values and defaults safely', () => {
  const invalidValues = [
    [STORAGE_KEYS.archive, JSON.stringify({ activeId: 'bad', entries: { bad: null } })],
    [STORAGE_KEYS.records, JSON.stringify([{ ...rec('invalid', 1), assisted: 'yes' }])]
  ];
  for (const [key, raw] of invalidValues) {
    const backend = new MemoryBackend();
    backend.setItem(key, raw);
    const loaded = createStore(backend, { now: () => 56 }).load();
    assert.doesNotThrow(() => createStore(backend).load());
    assert.equal(backend.getItem(key), raw);
    assert.deepEqual(loaded[key === STORAGE_KEYS.archive ? 'archive' : 'records'],
      key === STORAGE_KEYS.archive ? emptyArchive() : []);
    assert.ok([...backend.data.keys()].some(storedKey => storedKey.startsWith(`sudoku:v2:corrupt:${key}:`)));
  }
});

test('corrupt JSON and wrong-shaped v2 values are preserved, defaulted and deduplicated', () => {
  for (const [key, raw] of [
    [STORAGE_KEYS.settings, '{oops'],
    [STORAGE_KEYS.archive, 'null'],
    [STORAGE_KEYS.records, '{}'],
    [STORAGE_KEYS.meta, '5']
  ]) {
    const backend = new MemoryBackend();
    backend.setItem(key, raw);
    const store = createStore(backend, { now: () => 55 });
    const data = store.load();
    assert.equal(data.schema, 2);
    assert.equal(backend.getItem(key), raw);
    const copies = [...backend.data.keys()].filter(storedKey => storedKey.startsWith(`sudoku:v2:corrupt:${key}:`));
    assert.equal(copies.length, 1);
    store.load();
    assert.equal([...backend.data.keys()].filter(storedKey => storedKey.startsWith(`sudoku:v2:corrupt:${key}:`)).length, 1);
    assert.doesNotThrow(() => store.load());
  }
});

test('corrupt meta never reruns legacy migration over v2 archive and legacy corruption is preserved', () => {
  const backend = new MemoryBackend();
  const current = appData({ id: 'new', v: 7 });
  backend.setItem(STORAGE_KEYS.archive, JSON.stringify(current.archive));
  backend.setItem(STORAGE_KEYS.records, JSON.stringify(current.records));
  backend.setItem(STORAGE_KEYS.settings, JSON.stringify(current.settings));
  backend.setItem(STORAGE_KEYS.meta, '{broken');
  backend.setItem('sudoku-app:game', JSON.stringify({ version: 1, savedAt: 1, game: game('stale', 0) }));
  backend.setItem('sudoku-app:settings', '{bad legacy');
  const loaded = createStore(backend, { now: () => 2 }).load();
  assert.equal(loaded.archive.entries.new.game.values[0], 7);
  assert.equal(loaded.archive.entries.stale, undefined);
  assert.equal(loaded.settings.theme, 'rose');
  assert.ok([...backend.data.keys()].some(key => key.startsWith('sudoku:v2:corrupt:sudoku-app:settings:')));
});

test('store round trips every key, refreshes cross-tab writes, persists install time and swallows storage errors', () => {
  const backend = new MemoryBackend();
  const store = createStore(backend, { now: () => 123 });
  const initial = store.load();
  assert.equal(initial.meta.installedAt, 123);
  assert.equal(JSON.parse(backend.getItem(STORAGE_KEYS.meta)).installedAt, 123);
  assert.equal(createStore(backend, { now: () => 456 }).load().meta.installedAt, 123);
  const settings = normalizeSettings({ theme: 'sage' });
  const archive = { activeId: 'g', entries: { g: entry('g') } };
  const records = [rec('stored', 4)];
  const meta = { ...initial.meta, completedCount: 1 };
  assert.equal(store.saveSettings(settings), true);
  assert.equal(store.saveArchive(archive), true);
  assert.equal(store.saveRecords(records), true);
  assert.equal(store.saveMeta(meta), true);
  const loaded = createStore(backend).load();
  assert.deepEqual(loaded.settings, settings);
  assert.deepEqual(loaded.archive, archive);
  assert.deepEqual(loaded.records, records);
  assert.deepEqual(loaded.meta, meta);

  const remote = createStore(backend);
  remote.saveRecords([rec('remote', 8)]);
  assert.equal(store.load().records[0].id, 'remote');
  const failing = { getItem() { throw Error('unavailable'); }, setItem() { throw Error('quota'); }, removeItem() {} };
  const failingStore = createStore(failing);
  assert.doesNotThrow(() => failingStore.load());
  assert.equal(failingStore.saveSettings({}), false);
  assert.equal(failingStore.saveArchive({}), false);
  assert.equal(failingStore.saveRecords([]), false);
  assert.equal(failingStore.saveMeta({}), false);
});

test('export/import works into a fresh store and keeps conflicting copies resumable and idempotent', () => {
  const source = appData({ id: 'x', v: 2, theme: 'ocean', records: [rec('r', 1), rec('r2', 2)] });
  const exported = exportData(source);
  const destination = appData({ id: 'x', v: 1, theme: 'rose', records: [rec('r', 1)] });
  const imported = importData(destination, exported);
  assert.equal(imported.data.archive.entries.x.game.values[0], 1);
  assert.equal(imported.data.archive.entries['x-imported'].game.id, 'x-imported');
  assert.equal(imported.data.archive.entries['x-imported'].id, 'x-imported');
  assert.equal(imported.data.records.length, 2);
  assert.equal(imported.data.meta.completedCount, 2);
  assert.deepEqual(imported.conflicts, [{ kind: 'entry', id: 'x' }, { kind: 'settings', id: 'settings' }]);
  const resumed = resume(imported.data.archive, 'x-imported');
  const saved = saveActive(resumed, imported.data.archive.entries['x-imported'].game, 100);
  assert.ok(saved.entries.x);
  assert.ok(saved.entries['x-imported']);
  const repeated = importData(imported.data, exported);
  assert.equal(repeated.data.records.length, 2);
  assert.ok(repeated.data.archive.entries['x-imported']);
  assert.equal(repeated.data.archive.entries['x-imported-2'], undefined);
  assert.deepEqual(repeated.added, { records: 0, entries: 0 });
  assert.throws(() => importData(destination, 'bad'), ImportError);
  const freshBackend = new MemoryBackend();
  const fresh = createStore(freshBackend, { now: () => 1 }).load();
  const roundTrip = importData(fresh, exportData(appData({ id: 'roundtrip', v: 8, records: [rec('round', 9)] })));
  assert.deepEqual(roundTrip.data.archive.entries.roundtrip.game, game('roundtrip', 8));
  assert.equal(roundTrip.data.records[0].id, 'round');
});

test('import rejects malformed shapes and hostile ids, normalizes setting conflicts and caps recovery', () => {
  const current = appData();
  const importEnvelope = data => JSON.stringify({ format: 'sudoku-app-export', version: 2, data });
  const malformedRecord = appData({ records: [null] });
  assert.throws(() => importData(current, importEnvelope(malformedRecord)), ImportError);
  const invalidAssisted = appData({ records: [{ ...rec('bad-assisted', 1), assisted: 1 }] });
  assert.throws(() => importData(current, importEnvelope(invalidAssisted)), ImportError);
  const malformedEntry = appData();
  malformedEntry.archive.entries.x = null;
  assert.throws(() => importData(current, importEnvelope(malformedEntry)), ImportError);
  for (const id of ['__proto__', 'constructor', 'prototype']) {
    const hostile = emptyApp();
    Object.defineProperty(hostile.archive.entries, id, { enumerable: true, value: entry(id) });
    assert.throws(() => importData(current, importEnvelope(hostile)), ImportError);
  }
  const overRecovery = appData();
  overRecovery.archive.entries.x.recovery = Array.from({ length: 5 }, (_, i) => ({ savedAt: i, game: game(`g${i}`) }));
  const bounded = importData(emptyApp(), importEnvelope(overRecovery));
  assert.equal(bounded.data.archive.entries.x.recovery.length, 3);
  const oversizedArchive = emptyApp();
  for (let i = 0; i < 53; i++) oversizedArchive.archive.entries[`done${i}`] = entry(`done${i}`, i, { status: 'completed' });
  oversizedArchive.archive.entries.live = entry('live', 60);
  oversizedArchive.archive.entries.live2 = entry('live2', 61);
  const pruned = importData(emptyApp(), importEnvelope(oversizedArchive)).data.archive;
  assert.equal(Object.keys(pruned.entries).length, 50);
  assert.equal(pruned.entries.live.status, 'active');
  assert.equal(pruned.entries.live2.status, 'active');
  const reorderedSettings = structuredClone(current.settings);
  const reversed = Object.fromEntries(Object.entries(reorderedSettings).reverse());
  const settingsData = appData({ theme: 'rose' });
  settingsData.settings = reversed;
  assert.equal(importData(current, importEnvelope(settingsData)).conflicts.some(item => item.kind === 'settings'), false);
  assert.throws(() => importData(current, JSON.stringify({ format: 'wrong', version: 2, data: current })), ImportError);
  assert.throws(() => importData(current, JSON.stringify({ format: 'sudoku-app-export', version: 3, data: current })), ImportError);
});

function emptyApp() {
  return {
    schema: 2, settings: normalizeSettings({}), archive: emptyArchive(), records: [],
    meta: { installedAt: 1, completedCount: 0, reviewPromptedAt: null, migratedFrom: null }
  };
}

test('review prompt uses five completion threshold, strict PB, and exact 120-day cooldown', () => {
  const games = Array.from({ length: 5 }, (_, i) => rec(`${i}`, i, 'easy', true, 1000, 100));
  assert.equal(shouldPromptReview({}, games, 1_000_000), false);
  games[0] = rec('newest', 10, 'easy', false, 1000, 100);
  assert.equal(shouldPromptReview({}, games, 1_000_000), true);
  assert.equal(shouldPromptReview({ reviewPromptedAt: 1_000_000 - 120 * 86400000 }, games, 1_000_000), true);
  assert.equal(shouldPromptReview({ reviewPromptedAt: 1_000_000 - 120 * 86400000 + 1 }, games, 1_000_000), false);
  const assisted = Array.from({ length: 5 }, (_, i) => rec(`a${i}`, i, 'medium', true, 1000, 100));
  assisted[0] = rec('latest', 10, 'medium', true, 1000, 100);
  assert.equal(shouldPromptReview({ completedCount: 5 }, assisted, 1_000_000), false);
  assisted[0] = rec('latest', 10, 'medium', true, 999, 100);
  assert.equal(shouldPromptReview({ completedCount: 5 }, assisted, 1_000_000), true);
});
