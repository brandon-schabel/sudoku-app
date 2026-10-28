import { computeScore, isAssisted } from './scoring.js';

/** @typedef {{id:string,puzzleId:string,difficulty:'easy'|'medium'|'hard'|'expert',dailyKey:string|null,completedAt:number,elapsedMs:number,mistakes:number,assist:import('./scoring.js').Assist,assisted:boolean,score:number}} GameRecord */
/** @typedef {'all'|'unassisted'|'assisted'} StatsFilter */
const DIFFICULTIES = ['easy', 'medium', 'hard', 'expert'];
const ASSIST_KEYS = ['hints', 'checks', 'reveals', 'errorsShown', 'autoNotes'];
const finiteNumber = (value, name) => {
  if (!Number.isFinite(value)) throw new TypeError(`${name} must be a finite number.`);
  return value;
};
const count = value => Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

/** Build a record from completed opaque game JSON. */
export function createRecord(game) {
  if (!game || typeof game !== 'object' || typeof game.id !== 'string' || !game.id) {
    throw new TypeError('A completed game with an id is required.');
  }
  if (!DIFFICULTIES.includes(game.difficulty)) throw new TypeError('Unknown game difficulty.');
  const completedAt = finiteNumber(game.completedAt, 'completedAt');
  const elapsedMs = Math.max(0, finiteNumber(game.elapsedMs, 'elapsedMs'));
  const mistakes = count(game.mistakes);
  const assist = Object.fromEntries(ASSIST_KEYS.map(key => [key, count(game.assist?.[key])]));
  return {
    id: game.id,
    puzzleId: game.id,
    difficulty: game.difficulty,
    dailyKey: game.dailyKey ?? null,
    completedAt,
    elapsedMs,
    mistakes,
    assist,
    assisted: isAssisted(assist),
    score: computeScore({ difficulty: game.difficulty, elapsedMs, hints: assist.hints, mistakes })
  };
}

/** Compute filtered completion statistics. Unknown filters default to all. */
export function computeStats(records, filter = 'all') {
  if (!['all', 'unassisted', 'assisted'].includes(filter)) filter = 'all';
  const filtered = (records ?? [])
    .filter(record => filter === 'all' || record.assisted === (filter === 'assisted'))
    .slice()
    .sort((a, b) => b.completedAt - a.completedAt);
  const byDifficulty = {};
  for (const difficulty of DIFFICULTIES) {
    const games = filtered.filter(record => record.difficulty === difficulty);
    byDifficulty[difficulty] = {
      solved: games.length,
      avgMs: games.length ? Math.round(games.reduce((sum, record) => sum + record.elapsedMs, 0) / games.length) : null,
      bestMs: games.length ? Math.min(...games.map(record => record.elapsedMs)) : null,
      bestScore: games.length ? Math.max(...games.map(record => record.score)) : null
    };
  }
  return { byDifficulty, recent: filtered.slice(0, 20), total: filtered.length };
}

/** Compare complete latest and previous groups of five at a difficulty/assistance level. */
export function trend(records, { difficulty, assisted }) {
  const games = (records ?? [])
    .filter(record => record.difficulty === difficulty && record.assisted === assisted)
    .slice()
    .sort((a, b) => b.completedAt - a.completedAt);
  if (games.length < 10) return null;
  const summarize = group => ({
    n: group.length,
    avgMs: Math.round(group.reduce((sum, record) => sum + record.elapsedMs, 0) / group.length),
    avgScore: Math.round(group.reduce((sum, record) => sum + record.score, 0) / group.length)
  });
  const latest = summarize(games.slice(0, 5));
  const previous = summarize(games.slice(5, 10));
  return {
    latest,
    previous,
    deltaMs: latest.avgMs - previous.avgMs,
    deltaScore: latest.avgScore - previous.avgScore
  };
}

/** Compare a record with prior records in its category. */
export function personalBest(records, record) {
  const previous = (records ?? []).filter(item => item.difficulty === record.difficulty && item.assisted === record.assisted && item.id !== record.id);
  const previousBestMs = previous.length ? Math.min(...previous.map(item => item.elapsedMs)) : null;
  const previousBestScore = previous.length ? Math.max(...previous.map(item => item.score)) : null;
  return {
    isBestTime: previousBestMs === null || record.elapsedMs < previousBestMs,
    isBestScore: previousBestScore === null || record.score > previousBestScore,
    previousBestMs,
    previousBestScore
  };
}

/** Produce one calendar status for each day in a month. */
export function dailyCalendar(records, archive, year, month, now = Date.now()) {
  if (!Number.isInteger(year) || year < 0 || year > 9999 || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new RangeError('year must be 0–9999 and month must be 1–12.');
  }
  const date = new Date(0);
  date.setUTCFullYear(year, month, 0);
  date.setUTCHours(0, 0, 0, 0);
  const days = date.getUTCDate();
  const today = new Date(now).toISOString().slice(0, 10);
  return Array.from({ length: days }, (_, index) => {
    const dateKey = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(index + 1).padStart(2, '0')}`;
    const completed = (records ?? []).some(record => record.dailyKey === dateKey);
    const active = Object.values(archive?.entries ?? {}).some(entry => entry.dailyKey === dateKey && entry.status === 'active');
    return { dateKey, status: dateKey > today ? 'future' : completed ? 'completed' : active ? 'in-progress' : 'none' };
  });
}
