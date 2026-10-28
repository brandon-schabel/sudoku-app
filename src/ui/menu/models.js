import { computeStats, trend, dailyCalendar, listUnfinished } from '../../domain/index.js';
import { DIFFICULTIES, DIFFICULTY_META } from '../../engine/index.js';

/** Format elapsed milliseconds without wrapping at an hour. */
export function formatTime(milliseconds) {
  if (!Number.isFinite(milliseconds)) return '—';
  const seconds = Math.floor(Math.max(0, milliseconds) / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds / 60) % 60;
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}` : `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

/** Format a saved timestamp in the device locale. */
export function formatDate(timestamp, { locale, timeZone } = {}) {
  return Number.isFinite(timestamp) && Number.isFinite(new Date(timestamp).getTime()) ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone }).format(timestamp) : 'Unknown date';
}

/** Accessible board-cell name shared with the gameplay shell. */
export function cellLabel(index, value, given) {
  const row = Math.floor(index / 9) + 1, column = index % 9 + 1;
  return `Row ${row}, column ${column}, ${value || 'empty'}${given ? ', given' : ''}`;
}

/** Pause summary, including assistance independently of mistakes. */
export function pauseSummary(game) {
  if (!game) return 'A little space to think.';
  const mistakes = game.mistakes || 0, hints = game.assist?.hints || 0;
  return `${DIFFICULTY_META[game.difficulty]?.label || 'Puzzle'} · ${formatTime(game.elapsedMs)} · ${mistakes} ${mistakes === 1 ? 'mistake' : 'mistakes'} · ${hints} ${hints === 1 ? 'hint' : 'hints'}`;
}

/** Calendar cells padded to Sunday-first complete weeks; dates remain UTC keys. */
export function calendarModel(records, archive, year, month, today, { locale, timeZone = 'UTC' } = {}) {
  const days = dailyCalendar(records, archive, year, month).map(day => ({ ...day, day: Number(day.dateKey.slice(-2)), today: day.dateKey === today, disabled: day.dateKey > today || day.status === 'future' }));
  const cells = Array(new Date(Date.UTC(year, month - 1, 1)).getUTCDay()).fill(null).concat(days);
  while (cells.length % 7) cells.push(null);
  return { title: new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone }).format(new Date(Date.UTC(year, month - 1, 1))), cells };
}

/** Shift a UTC calendar month safely across year boundaries. */
export function shiftMonth(year, month, delta, { minYear = 1, minMonth = 1, maxYear = 9999, maxMonth = 12 } = {}) {
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  let nextYear = date.getUTCFullYear(), nextMonth = date.getUTCMonth() + 1;
  if (nextYear < minYear || (nextYear === minYear && nextMonth < minMonth)) return { year: minYear, month: minMonth };
  if (nextYear > maxYear || (nextYear === maxYear && nextMonth > maxMonth)) return { year: maxYear, month: maxMonth };
  return { year: nextYear, month: nextMonth };
}

/** Present unfinished entries with progress only over originally empty cells. */
export function archiveModel(archive) {
  return listUnfinished(archive).filter(entry => entry?.game && typeof entry.game === 'object').map(entry => {
    const game = entry.game, puzzle = game.puzzle || [], values = game.values || [];
    let total = 0, filled = 0;
    for (let i = 0; i < 81; i++) if (!puzzle[i]) { total++; if (values[i]) filled++; }
    return { ...entry, label: DIFFICULTY_META[entry.difficulty]?.label || 'Puzzle', progress: `${filled} of ${total} cells filled`, time: formatTime(game.elapsedMs), updated: formatDate(entry.updatedAt), recovery: (entry.recovery || []).filter(copy => copy?.game).slice().sort((a, b) => b.savedAt - a.savedAt).map(copy => ({ ...copy, label: formatDate(copy.savedAt), time: formatTime(copy.game?.elapsedMs) })) };
  });
}

/** Statistics rows and separately grouped assistance trends, from the domain API. */
export function statsModel(records, filter = 'all') {
  const safeRecords = (records || []).map(record => { const score = Number(record.score ?? 0); return { ...record, score: Number.isFinite(score) ? score : 0 }; });
  const stats = computeStats(safeRecords, filter);
  return { total: stats.total, rows: DIFFICULTIES.map(difficulty => {
    const row = stats.byDifficulty[difficulty];
    return { difficulty, label: DIFFICULTY_META[difficulty].label, ...row, average: row.solved ? formatTime(row.avgMs) : '—', best: formatTime(row.bestMs), points: row.bestScore == null ? '—' : row.bestScore.toLocaleString() };
  }), recent: stats.recent.map(record => ({ ...record, label: DIFFICULTY_META[record.difficulty]?.label || 'Puzzle', time: formatTime(record.elapsedMs), date: formatDate(record.completedAt), reveals: record.assist?.reveals || 0 })), trends: DIFFICULTIES.flatMap(difficulty => (filter === 'all' ? [false, true] : [filter === 'assisted']).map(assisted => ({ difficulty, label: DIFFICULTY_META[difficulty].label, comparison: trend(safeRecords, { difficulty, assisted }), assisted }))) };
}

/** Small, DOM-free navigation and action state machine used by the menu. */
export function createMenuMachine(initialView = 'menu') {
  let view = initialView, pending = null, busy = false;
  return {
    get view() { return view; }, get pending() { return pending; }, get busy() { return busy; },
    navigate(next, allowed) { if (busy) return false; view = allowed.has(next) ? next : 'menu'; pending = null; return true; },
    confirm(value) { if (busy) return false; pending = value; return true; },
    clearPending() { if (!pending) return false; pending = null; return true; },
    begin() { if (busy) return false; busy = true; return true; },
    finish() { busy = false; },
    back() { if (busy) return 'blocked'; if (pending) { pending = null; return 'pending'; } if (view !== 'menu') { view = 'menu'; return 'navigate'; } return 'resume'; },
  };
}

/** The close callback owns timer resume when supplied by the application shell. */
export function shouldCallFacadeResume(hasGame, hasOnClose) {
  return Boolean(hasGame && !hasOnClose);
}

/** Describe import conflict handling without exposing opaque identifiers. */
export function importSummary(result) {
  const conflicts = result.conflicts || [];
  const entryCount = conflicts.filter(conflict => conflict.kind === 'entry').length;
  return `Imported ${result.added.records} records and ${result.added.entries} puzzles.${entryCount ? ` ${entryCount} puzzle conflicts: both copies were kept; imported copies appear in Continue.` : ''}${conflicts.some(conflict => conflict.kind === 'settings') ? ' Settings differed; your current settings were kept.' : ''}`;
}
