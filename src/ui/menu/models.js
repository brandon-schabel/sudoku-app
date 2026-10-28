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
export function formatDate(timestamp) {
  return Number.isFinite(timestamp) && Number.isFinite(new Date(timestamp).getTime()) ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(timestamp) : 'Unknown date';
}

/** Pause summary, including assistance independently of mistakes. */
export function pauseSummary(game) {
  if (!game) return 'A little space to think.';
  const mistakes = game.mistakes || 0, hints = game.assist?.hints || 0;
  return `${DIFFICULTY_META[game.difficulty]?.label || 'Puzzle'} · ${formatTime(game.elapsedMs)} · ${mistakes} ${mistakes === 1 ? 'mistake' : 'mistakes'} · ${hints} ${hints === 1 ? 'hint' : 'hints'}`;
}

/** Calendar cells padded to Sunday-first complete weeks; dates remain UTC keys. */
export function calendarModel(records, archive, year, month, today) {
  const days = dailyCalendar(records, archive, year, month).map(day => ({ ...day, day: Number(day.dateKey.slice(-2)), today: day.dateKey === today, disabled: day.dateKey > today || day.status === 'future' }));
  const cells = Array(new Date(Date.UTC(year, month - 1, 1)).getUTCDay()).fill(null).concat(days);
  while (cells.length % 7) cells.push(null);
  return { title: new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, 1))), cells };
}

/** Shift a UTC calendar month safely across year boundaries. */
export function shiftMonth(year, month, delta) {
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
}

/** Present unfinished entries with progress only over originally empty cells. */
export function archiveModel(archive) {
  return listUnfinished(archive).map(entry => {
    const game = entry.game, puzzle = game.puzzle || [], values = game.values || [];
    let total = 0, filled = 0;
    for (let i = 0; i < 81; i++) if (!puzzle[i]) { total++; if (values[i]) filled++; }
    return { ...entry, label: DIFFICULTY_META[entry.difficulty]?.label || 'Puzzle', progress: `${filled} of ${total} cells filled`, time: formatTime(game.elapsedMs), updated: formatDate(entry.updatedAt), recovery: (entry.recovery || []).slice().sort((a, b) => b.savedAt - a.savedAt).map(copy => ({ ...copy, label: formatDate(copy.savedAt), time: formatTime(copy.game.elapsedMs) })) };
  });
}

/** Statistics rows and separately grouped assistance trends, from the domain API. */
export function statsModel(records, filter = 'all') {
  const stats = computeStats(records, filter);
  return { total: stats.total, rows: DIFFICULTIES.map(difficulty => {
    const row = stats.byDifficulty[difficulty];
    return { difficulty, label: DIFFICULTY_META[difficulty].label, ...row, average: row.solved ? formatTime(row.avgMs) : '—', best: formatTime(row.bestMs), points: row.bestScore == null ? '—' : row.bestScore.toLocaleString() };
  }), recent: stats.recent.map(record => ({ ...record, label: DIFFICULTY_META[record.difficulty]?.label || 'Puzzle', time: formatTime(record.elapsedMs), date: formatDate(record.completedAt), reveals: record.assist?.reveals || 0 })), trends: DIFFICULTIES.flatMap(difficulty => (filter === 'all' ? [false, true] : [filter === 'assisted']).map(assisted => ({ difficulty, label: DIFFICULTY_META[difficulty].label, assisted, comparison: trend(records, { difficulty, assisted }) }))) };
}

/** Describe import conflict handling without exposing opaque identifiers. */
export function importSummary(result) {
  const conflicts = result.conflicts || [];
  const entryCount = conflicts.filter(conflict => conflict.kind === 'entry').length;
  return `Imported ${result.added.records} records and ${result.added.entries} puzzles.${entryCount ? ` ${entryCount} puzzle conflicts: both copies were kept; imported copies appear in Continue.` : ''}${conflicts.some(conflict => conflict.kind === 'settings') ? ' Settings differed; your current settings were kept.' : ''}`;
}
