import { normalizeSettings, DEFAULT_SETTINGS } from './settings.js';
import { emptyArchive, pruneArchive } from './archive.js';
import { createRecord, personalBest } from './stats.js';

/** Persistent data keys. */
export const STORAGE_KEYS = Object.freeze({
  settings: 'sudoku:v2:settings',
  archive: 'sudoku:v2:archive',
  records: 'sudoku:v2:records',
  meta: 'sudoku:v2:meta'
});
const LEGACY_GAME_KEY = 'sudoku-app:game';
const LEGACY_SETTINGS_KEY = 'sudoku-app:settings';
const CORRUPT_PREFIX = 'sudoku:v2:corrupt:';
const MAX_IMPORT_BYTES = 10 * 1024 * 1024;
const MAX_IMPORT_RECORDS = 10000;
const MAX_IMPORT_ENTRIES = 1000;
const DIFFICULTIES = new Set(['easy', 'medium', 'hard', 'expert']);
const clone = value => value === undefined ? undefined : structuredClone(value);

function defaults(now = Date.now()) {
  return {
    schema: 2,
    settings: normalizeSettings(DEFAULT_SETTINGS),
    archive: emptyArchive(),
    records: [],
    meta: { installedAt: now, completedCount: 0, reviewPromptedAt: null, migratedFrom: null }
  };
}

function parseJson(raw) {
  try { return { ok: true, value: JSON.parse(raw) }; }
  catch { return { ok: false }; }
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validValue(key, value) {
  if (key === STORAGE_KEYS.settings) return isObject(value);
  if (key === STORAGE_KEYS.archive) {
    return isObject(value) && isObject(value.entries)
      && (value.activeId === null || typeof value.activeId === 'string')
      && Object.entries(value.entries).every(([id, entry]) => validEntry(id, entry));
  }
  if (key === STORAGE_KEYS.records) return Array.isArray(value) && value.every(validRecord);
  if (key === STORAGE_KEYS.meta) return isObject(value);
  return true;
}

function corruptKey(backend, key, raw, now) {
  try {
    const prefix = `${CORRUPT_PREFIX}${key}:`;
    for (let index = 0; index < backend.length; index++) {
      const storedKey = backend.key?.(index);
      if (typeof storedKey === 'string' && storedKey.startsWith(prefix) && backend.getItem(storedKey) === raw) return;
    }
    backend.setItem(`${prefix}${now}`, raw);
  } catch { /* Corrupt preservation is best effort when storage itself is failing. */ }
}

function readKey(backend, key, fallback, now) {
  let raw;
  try { raw = backend.getItem(key); }
  catch { return clone(fallback); }
  if (raw === null) return clone(fallback);
  const parsed = parseJson(raw);
  if (!parsed.ok || !validValue(key, parsed.value)) {
    corruptKey(backend, key, raw, now);
    return clone(fallback);
  }
  return parsed.value;
}

function writeKey(backend, key, value) {
  try { backend.setItem(key, JSON.stringify(value)); return true; }
  catch { return false; }
}

function hasKey(backend, key) {
  try { return backend.getItem(key) !== null; }
  catch { return false; }
}

function checkLegacyCorruption(backend, now) {
  for (const key of [LEGACY_GAME_KEY, LEGACY_SETTINGS_KEY]) {
    let raw;
    try { raw = backend.getItem(key); }
    catch { continue; }
    if (raw !== null && !parseJson(raw).ok) corruptKey(backend, key, raw, now);
  }
}

function safeLegacyParse(backend, key, now) {
  let raw;
  try { raw = backend.getItem(key); }
  catch { return null; }
  if (raw === null) return null;
  const parsed = parseJson(raw);
  if (!parsed.ok) corruptKey(backend, key, raw, now);
  return parsed.ok ? parsed.value : null;
}

/** Migrate legacy v1 saves, leaving source keys untouched. */
export function migrateLegacy(backend, { now = Date.now } = {}) {
  const installedAt = now();
  const gameEnvelope = safeLegacyParse(backend, LEGACY_GAME_KEY, installedAt);
  const rawSettings = safeLegacyParse(backend, LEGACY_SETTINGS_KEY, installedAt);
  const validEnvelope = gameEnvelope?.version === 1 && isObject(gameEnvelope.game) ? gameEnvelope : null;
  const legacySettings = isObject(rawSettings) ? rawSettings : null;
  if (!validEnvelope && !legacySettings) return null;

  const data = defaults(installedAt);
  if (validEnvelope) {
    const game = clone(validEnvelope.game);
    const id = typeof game.id === 'string' && game.id ? game.id : `legacy-${validEnvelope.savedAt ?? 0}`;
    game.id = id;
    const savedAt = Number.isFinite(validEnvelope.savedAt) ? validEnvelope.savedAt : 0;
    const createdAt = Number.isFinite(game.createdAt) ? game.createdAt : savedAt;
    const entry = {
      id,
      kind: 'random',
      dailyKey: null,
      difficulty: game.difficulty,
      createdAt,
      updatedAt: savedAt,
      status: game.completed ? 'completed' : 'active',
      game,
      recovery: []
    };
    data.archive = { activeId: game.completed ? null : id, entries: { [id]: entry } };
    if (game.completed && DIFFICULTIES.has(game.difficulty)) {
      const recordInput = {
        ...game,
        completedAt: Number.isFinite(game.completedAt) ? game.completedAt : savedAt,
        elapsedMs: Number.isFinite(game.elapsedMs) ? game.elapsedMs : 0,
        mistakes: Number.isFinite(game.mistakes) ? game.mistakes : 0
      };
      try {
        data.records.push(createRecord({ ...recordInput, id }));
        data.meta.completedCount = 1;
      } catch { /* Malformed legacy completion remains archived without a statistics row. */ }
    }
  }
  if (legacySettings) {
    data.settings = normalizeSettings({ colorMode: legacySettings.theme === 'auto' ? 'system' : legacySettings.theme });
  }
  data.meta.migratedFrom = 1;
  return data;
}

/** Create a synchronous versioned data store. `now` makes first-install metadata deterministic. */
export function createStore(backend, { now = Date.now } = {}) {
  const load = () => {
    const installedAt = now();
    const hasV2 = Object.values(STORAGE_KEYS).some(key => hasKey(backend, key));
    checkLegacyCorruption(backend, installedAt);
    if (!hasV2) {
      const migrated = migrateLegacy(backend, { now: () => installedAt });
      if (migrated) {
        for (const [name, key] of Object.entries(STORAGE_KEYS)) writeKey(backend, key, migrated[name]);
        return clone(migrated);
      }
    }

    const data = defaults(installedAt);
    data.settings = normalizeSettings(readKey(backend, STORAGE_KEYS.settings, data.settings, installedAt));
    data.archive = readKey(backend, STORAGE_KEYS.archive, data.archive, installedAt);
    data.records = readKey(backend, STORAGE_KEYS.records, data.records, installedAt);
    const storedMeta = readKey(backend, STORAGE_KEYS.meta, null, installedAt);
    if (storedMeta) data.meta = { ...data.meta, ...storedMeta };
    if (!hasKey(backend, STORAGE_KEYS.meta)) writeKey(backend, STORAGE_KEYS.meta, data.meta);
    return clone(data);
  };

  return {
    load,
    saveSettings(settings) { return writeKey(backend, STORAGE_KEYS.settings, normalizeSettings(settings)); },
    saveArchive(archive) { return writeKey(backend, STORAGE_KEYS.archive, clone(archive)); },
    saveRecords(records) { return writeKey(backend, STORAGE_KEYS.records, clone(records)); },
    saveMeta(meta) { return writeKey(backend, STORAGE_KEYS.meta, clone(meta)); }
  };
}

/** Serialize app data for transfer. */
export function exportData(appData) {
  return JSON.stringify({ format: 'sudoku-app-export', version: 2, exportedAt: Date.now(), data: clone(appData) });
}

function validRecord(record) {
  return isObject(record) && typeof record.id === 'string' && record.id.length > 0
    && typeof record.puzzleId === 'string' && record.puzzleId.length > 0
    && DIFFICULTIES.has(record.difficulty)
    && (record.dailyKey === null || typeof record.dailyKey === 'string')
    && Number.isFinite(record.completedAt) && Number.isFinite(record.elapsedMs)
    && record.elapsedMs >= 0 && Number.isFinite(record.mistakes) && record.mistakes >= 0
    && isObject(record.assist)
    && ['hints', 'checks', 'reveals', 'errorsShown', 'autoNotes'].every(key => Number.isFinite(record.assist[key]) && record.assist[key] >= 0)
    && typeof record.assisted === 'boolean' && Number.isFinite(record.score);
}

function validEntry(id, entry) {
  return typeof id === 'string' && id.length > 0 && !['__proto__', 'constructor', 'prototype'].includes(id)
    && isObject(entry) && entry.id === id && isObject(entry.game) && entry.game.id === id
    && DIFFICULTIES.has(entry.difficulty) && (entry.kind === 'random' || entry.kind === 'daily')
    && (entry.status === 'active' || entry.status === 'completed')
    && Number.isFinite(entry.updatedAt)
    && Array.isArray(entry.recovery)
    && entry.recovery.every(item => isObject(item) && Number.isFinite(item.savedAt) && isObject(item.game));
}

function equivalent(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

/** Import app data, retaining both entries when IDs conflict. */
export function importData(current, text) {
  try {
    if (typeof text !== 'string' || text.length > MAX_IMPORT_BYTES) throw new ImportError('Import file is too large or invalid.');
    const envelope = JSON.parse(text);
    const incoming = envelope?.data;
    if (envelope?.format !== 'sudoku-app-export' || envelope.version !== 2 || !isObject(incoming)
      || incoming.schema !== 2 || !Array.isArray(incoming.records) || incoming.records.length > MAX_IMPORT_RECORDS
      || !isObject(incoming.archive) || !isObject(incoming.archive.entries)
      || !(incoming.archive.activeId === null || typeof incoming.archive.activeId === 'string')
      || Object.keys(incoming.archive.entries).length > MAX_IMPORT_ENTRIES || !isObject(incoming.settings)) {
      throw new ImportError('Unsupported or invalid Sudoku export.');
    }
    if (!incoming.records.every(validRecord)) throw new ImportError('Import contains an invalid game record.');
    // The imported activeId is intentionally ignored; importing never changes the user's active game.
    for (const [id, entry] of Object.entries(incoming.archive.entries)) {
      if (!validEntry(id, entry)) throw new ImportError('Import contains an invalid archive entry.');
    }
    if (!isObject(current) || !Array.isArray(current.records) || !isObject(current.archive?.entries)) {
      throw new ImportError('Current Sudoku data is invalid.');
    }

    const data = clone(current);
    const conflicts = [];
    const recordIds = new Set(data.records.map(record => record.id));
    let addedRecords = 0;
    let addedEntries = 0;
    for (const record of incoming.records) {
      if (!recordIds.has(record.id)) {
        data.records.push(clone(record));
        recordIds.add(record.id);
        addedRecords++;
      }
    }

    for (const [id, entry] of Object.entries(incoming.archive.entries)) {
      const existing = Object.hasOwn(data.archive.entries, id) ? data.archive.entries[id] : null;
      if (!existing) {
        const copy = clone(entry);
        copy.recovery = copy.recovery.slice(-3);
        data.archive.entries[id] = copy;
        addedEntries++;
      } else if (!equivalent(existing, entry)) {
        conflicts.push({ kind: 'entry', id });
        let copyId = `${id}-imported`;
        let suffix = 2;
        while (Object.hasOwn(data.archive.entries, copyId)) {
          const priorCopy = clone(data.archive.entries[copyId]);
          const comparable = clone(entry);
          priorCopy.id = id;
          priorCopy.game.id = id;
          if (equivalent(priorCopy, comparable)) break;
          copyId = `${id}-imported-${suffix++}`;
        }
        if (Object.hasOwn(data.archive.entries, copyId)) {
          const priorCopy = clone(data.archive.entries[copyId]);
          priorCopy.id = id;
          priorCopy.game.id = id;
          if (equivalent(priorCopy, entry)) continue;
        }
        const copy = clone(entry);
        copy.id = copyId;
        copy.game.id = copyId;
        copy.recovery = copy.recovery.slice(-3);
        data.archive.entries[copyId] = copy;
        addedEntries++;
      }
    }

    if (!equivalent(normalizeSettings(data.settings), normalizeSettings(incoming.settings))) {
      conflicts.push({ kind: 'settings', id: 'settings' });
    }
    data.records = [...data.records];
    const priorCount = Number.isFinite(data.meta?.completedCount) ? data.meta.completedCount : 0;
    data.meta = { ...data.meta, completedCount: Math.max(priorCount, data.records.length) };
    data.archive = pruneArchive(data.archive);
    return { data, added: { records: addedRecords, entries: addedEntries }, conflicts };
  } catch (error) {
    if (error instanceof ImportError) throw error;
    throw new ImportError('Import contains invalid Sudoku data.');
  }
}

/** Error thrown for malformed or unsupported import files. */
export class ImportError extends Error {
  constructor(message) { super(message); this.name = 'ImportError'; }
}

/** Whether a tasteful review prompt is due after a positive milestone. */
export function shouldPromptReview(meta, records, now = Date.now()) {
  const games = (records ?? []).slice().sort((a, b) => b.completedAt - a.completedAt);
  if (Math.max(games.length, meta?.completedCount ?? 0) < 5) return false;
  if (meta?.reviewPromptedAt != null && now - meta.reviewPromptedAt < 120 * 86400000) return false;
  const latest = games[0];
  if (!latest) return false;
  if (!latest.assisted) return true;
  const result = personalBest(games.slice(1), latest);
  return result.isBestTime || result.isBestScore;
}
