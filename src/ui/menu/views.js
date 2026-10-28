import { DIFFICULTIES, DIFFICULTY_META, dailyKey } from '../../engine/index.js';
import { h } from '../dom.js';
import { button } from './modal.js';
import { archiveModel, calendarModel, statsModel, formatTime, importSummary } from './models.js';
import { share as platformShare } from '../../platform/index.js';
/** Persistence reassurance shared by the archive and new-game chooser. */
export const keptNote = 'Your current puzzle is kept in Continue when you start another.';
const descriptions = { easy: 'Naked singles and full houses. A gentle place to begin.', medium: 'Hidden singles. Look for the only place a digit can go.', hard: 'Pairs, triples, and locked candidates. Find the connections.', expert: 'X-wing, Swordfish, and advanced wing patterns. Take your time.' };

/** Menu home destinations. */
export function homeView(ctx) {
  const items = [['resume', 'Resume puzzle', 'Pick up where you left off'], ['continue', 'Continue a puzzle', 'Your unfinished puzzles & recovery copies'], ['daily', 'Daily puzzle', 'One shared Medium puzzle, every day'], ['new', 'New game', 'Find your next challenge'], ['stats', 'Statistics', 'Your progress, at your own pace'], ['settings', 'Themes & settings', 'Make yourself comfortable'], ['howto', 'How to play', 'A few helpful pointers'], ['tools', 'Puzzle tools', 'Notes, checks, and saved data']];
  return [h('nav', { className: 'c2-menu-list', 'aria-label': 'Puzzle menu' }, items.map(([view, label, detail]) => button([h('span', {}, h('strong', {}, label), h('small', {}, detail)), h('span', { 'aria-hidden': 'true' }, '›')], () => view === 'resume' ? ctx.resume() : ctx.navigate(view), { 'data-testid': `menu-${view}`, disabled: view === 'resume' && !ctx.app.game() }))), h('p', { className: 'c2-tagline' }, 'Just the puzzle. Always ad-free.')];
}

/** Difficulty choices preserve the existing puzzle through the facade. */
export function newView(ctx) {
  return [h('p', { className: 'c2-intro' }, 'A fresh grid. A little room to think.'), h('p', { className: 'c2-note' }, keptNote), h('div', { className: 'c2-stack' }, DIFFICULTIES.map(difficulty => button([h('span', { className: 'c2-difficulty-title' }, DIFFICULTY_META[difficulty].label, h('span', { className: 'c2-dots', 'aria-label': `${DIFFICULTY_META[difficulty].dots} of 4 difficulty` }, '●'.repeat(DIFFICULTY_META[difficulty].dots) + '○'.repeat(4 - DIFFICULTY_META[difficulty].dots))), h('small', {}, descriptions[difficulty])], () => {
    const start = () => ctx.run(() => ctx.app.actions.newGame(difficulty), 'New puzzle ready.', true);
    if (ctx.app.settings().confirmNewGame && ctx.app.game()) ctx.confirm(`Start ${['easy', 'expert'].includes(difficulty) ? 'an' : 'a'} ${DIFFICULTY_META[difficulty].label.toLowerCase()} puzzle?`, keptNote, start);
    else start();
  }, { className: 'c2-choice', 'data-testid': `new-${difficulty}` })))];
}

/** Archive and explicitly reversible recovery actions. */
export function continueView(ctx) {
  const entries = archiveModel(ctx.app.data().archive);
  return [h('p', { className: 'c2-note' }, keptNote), entries.length ? h('div', { className: 'c2-stack' }, entries.map(entry => h('article', { className: 'c2-card', 'data-testid': 'continue-entry', 'data-entry-id': entry.id }, h('h3', {}, entry.label, entry.dailyKey ? ` · Daily ${entry.dailyKey}` : ''), h('p', {}, `${entry.progress} · ${entry.time}`), h('small', {}, `Updated ${entry.updated}`), button('Continue puzzle', () => ctx.run(() => ctx.app.actions.continueEntry(entry.id), 'Puzzle restored.', true)), entry.recovery.length ? h('details', {}, h('summary', {}, `Recovery copies (${entry.recovery.length})`), entry.recovery.map(copy => h('div', { className: 'c2-recovery' }, h('span', {}, `${copy.label} · ${copy.time}`), button('Restore', () => ctx.run(() => ctx.app.actions.restoreRecovery(entry.id, copy.savedAt), 'Recovery copy restored. The previous version is kept as a recovery copy.', true), { 'aria-label': `Restore ${entry.label} recovery from ${copy.label}` })))) : h('small', {}, 'Recovery copies appear as you play.'), button('Delete saved puzzle', () => ctx.confirm('Delete this saved puzzle?', 'This removes the puzzle and its recovery copies from this device.', () => ctx.run(() => ctx.app.actions.removeEntry(entry.id), 'Saved puzzle deleted.')), { className: 'c2-text-button' })))) : h('p', { className: 'c2-empty' }, 'Your next pause will be saved here. Start a puzzle whenever you’re ready.')];
}

/** UTC daily month calendar with visible and spoken status marks. */
export function dailyView(ctx) {
  ctx.syncCalendar();
  const today = dailyKey();
  const model = calendarModel(ctx.app.data().records, ctx.app.data().archive, ctx.year, ctx.month, today);
  const labels = { completed: 'Completed', 'in-progress': 'In progress', none: 'Available', future: 'Not available yet' };
  return [h('p', { className: 'c2-intro' }, 'A shared Medium puzzle, with a new one at midnight UTC. Revisit any past day.'), h('div', { className: 'c2-month' }, button('‹', () => ctx.changeMonth(-1), { 'aria-label': 'Previous month' }), h('h3', { 'aria-live': 'polite' }, model.title), button('›', () => ctx.changeMonth(1), { 'aria-label': 'Next month' })), h('div', { className: 'c2-calendar', 'data-testid': 'daily-calendar', role: 'group', 'aria-label': model.title }, ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => h('span', { className: 'c2-weekday', 'aria-hidden': 'true' }, day)), model.cells.map(day => day ? button([h('span', {}, day.day), h('span', { className: 'c2-day-mark', 'aria-hidden': 'true' }, day.status === 'completed' ? '✓' : day.status === 'in-progress' ? '•' : '\u00a0')], () => ctx.run(() => ctx.app.actions.startDaily(day.dateKey), 'Daily puzzle ready.', true), { className: 'c2-day', 'data-status': day.status, 'data-date': day.dateKey, 'aria-label': `${day.dateKey}, ${labels[day.status]}${day.today ? ', today' : ''}`, 'aria-current': day.today ? 'date' : null, disabled: day.disabled }) : h('span', { 'aria-hidden': 'true' }))), h('p', { className: 'c2-note' }, '✓ Completed · • In progress · Outlined day: today')];
}

/** Statistics with keyboard-operable tabs, tables, recent games, and category trends. */
export function statsView(ctx) {
  const model = statsModel(ctx.app.data().records, ctx.filter);
  const filters = ['all', 'unassisted', 'assisted'];
  const tabs = h('div', { className: 'c2-tabs', role: 'tablist', 'aria-label': 'Assistance filter' }, filters.map(filter => button(filter[0].toUpperCase() + filter.slice(1), () => ctx.setFilter(filter), { role: 'tab', id: `c2-stats-${filter}`, 'data-testid': `stats-tab-${filter}`, 'aria-selected': String(ctx.filter === filter), 'aria-controls': 'c2-stats-panel', tabindex: ctx.filter === filter ? '0' : '-1', onkeydown: event => {
    const current = filters.indexOf(filter);
    const next = event.key === 'ArrowRight' ? (current + 1) % 3 : event.key === 'ArrowLeft' ? (current + 2) % 3 : event.key === 'Home' ? 0 : event.key === 'End' ? 2 : null;
    if (next != null) { event.preventDefault(); ctx.setFilter(filters[next]); document.getElementById(`c2-stats-${filters[next]}`)?.focus(); }
  } })));
  return [tabs, h('p', { className: 'c2-note' }, 'Unassisted means no hints, reveals, checks, shown errors, or auto-filled notes.'), h('section', { role: 'tabpanel', id: 'c2-stats-panel', 'aria-labelledby': `c2-stats-${ctx.filter}`, tabindex: '0' }, !model.total ? h('p', { className: 'c2-empty' }, 'No completed puzzles in this view yet. Your first finish is a fresh beginning.') : null,
    h('div', { className: 'c2-table-wrap', tabindex: '0', role: 'region', 'aria-label': 'Statistics by difficulty, scroll to see all columns' }, h('table', {}, h('caption', {}, `${model.total} puzzles solved`), h('thead', {}, h('tr', {}, ['Difficulty', 'Solved', 'Average', 'Best time', 'Best score'].map(label => h('th', { scope: 'col' }, label)))), h('tbody', {}, model.rows.map(row => h('tr', {}, h('th', { scope: 'row' }, row.label), [row.solved, row.average, row.best, row.points].map(value => h('td', {}, value))))))),
    h('h3', {}, 'Your pace over time'), h('p', { className: 'c2-note' }, 'Latest 5 vs previous 5, compared within the same difficulty and assistance category.'),
    h('div', { className: 'c2-stack' }, model.trends.filter(row => (row.comparison?.previous?.n ?? 0) > 0).map(row => { const t = row.comparison; return h('div', { className: 'c2-card' }, h('strong', {}, `${row.label} · ${row.assisted ? 'Assisted' : 'Unassisted'}`), h('p', {}, `Latest ${t.latest.n}: ${formatTime(t.latest.avgMs)} · ${Math.round(t.latest.avgScore)} points`), h('p', {}, `Previous ${t.previous.n}: ${formatTime(t.previous.avgMs)} · ${Math.round(t.previous.avgScore)} points`), h('small', {}, `${formatTime(Math.abs(t.deltaMs))} ${t.deltaMs < 0 ? 'faster' : t.deltaMs > 0 ? 'slower' : 'change'} · ${t.deltaScore >= 0 ? '+' : ''}${t.deltaScore} points`)); })),
    !model.trends.some(row => (row.comparison?.previous?.n ?? 0) > 0) ? h('p', { className: 'c2-note' }, 'Finish at least 2 puzzles in one category to compare groups. Each group uses up to 5 games.') : null,
    h('h3', {}, 'Recent games'), model.recent.length ? h('ol', { className: 'c2-recent' }, model.recent.map(record => h('li', { className: 'c2-card' }, h('strong', {}, `${record.label} · ${record.time} · ${record.score.toLocaleString()} points`), h('p', {}, record.date), h('small', {}, `${record.assisted ? 'Assisted' : 'Unassisted'} · ${record.mistakes} mistakes · ${record.reveals} reveals`)))) : h('p', { className: 'c2-note' }, 'Your latest 20 completed puzzles will appear here.'))];
}

/** Plain language rules, exact shortcuts, and transparent scoring. */
export function howtoView() {
  const sections = [['One of each', 'Fill every row, column, and 3 × 3 box with the numbers 1–9, once each. The given numbers stay in place. Every puzzle has one solution.'], ['Choose how you enter', 'Cell first: choose an empty cell, then a number. Number first: select a number, then tap cells to place it. Tap the selected number again to clear it. Change modes in Themes & settings.'], ['Make a small note', 'Turn on Notes to pencil possible digits into a cell. Notes can clean themselves up when you place a related digit. Fill notes adds every legal candidate and counts as assistance.'], ['A hint, one step at a time', 'Hints first point out an area, then explain the reasoning, and finally offer to fill a cell. Choose “I’ll try it” whenever you want to finish the step yourself.'], ['A check, without pressure', 'Check entries highlights incorrect numbers. There is no mistake limit or game over. Checks, hints, reveals, shown errors, and auto-filled notes mark a completion as assisted.'], ['A score for your own progress', 'Easy starts at 1,000 points; Medium 2,000; Hard 3,000; Expert 4,000. Add up to 1,200 time-bonus points, then subtract 100 per hint and 25 per mistake. Scores never fall below 100. The bonus decreases to zero at twice the par time: 10, 15, 25, or 40 minutes respectively. This is personal tracking, with no leaderboard.'], ['Your puzzles stay with you', 'Progress saves locally on this device. A new game keeps unfinished puzzles in Continue. Export a copy in Puzzle tools to back up or move your data.']];
  const shortcuts = [['1–9', 'Enter a number'], ['Arrow keys', 'Move between cells'], ['Backspace / Delete', 'Erase a cell'], ['N', 'Toggle notes'], ['Ctrl / ⌘ + Z', 'Undo'], ['Ctrl / ⌘ + Shift + Z', 'Redo'], ['H', 'Open a hint'], ['P', 'Pause / return to puzzle']];
  return [...sections.map(([title, text]) => h('section', { className: 'c2-prose' }, h('h3', {}, title), h('p', {}, text))), h('h3', {}, 'Keyboard shortcuts'), h('table', { className: 'c2-shortcuts' }, h('tbody', {}, shortcuts.map(([key, meaning]) => h('tr', {}, h('th', { scope: 'row' }, h('kbd', {}, key)), h('td', {}, meaning))))), h('p', { className: 'c2-tagline' }, 'Just the puzzle. Always ad-free.')];
}

/** Safe backup download and optional platform share of the same JSON text. */
export async function exportBackup(app, share = false) {
  const text = app.actions.exportData();
  if (share && await platformShare({ title: 'Sudoku backup', text })) return;
  const file = new File([text], 'sudoku-backup.json', { type: 'application/json' });
  const url = URL.createObjectURL(file);
  const link = h('a', { href: url, download: file.name });
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Read an import backup only when it is within the supported 5 MB limit. */
export async function readBackupFile(file) {
  if (file.size > 5 * 1024 * 1024) throw new RangeError('Backup files must be 5 MB or smaller.');
  return file.text();
}

/** Puzzle tools and conflict-preserving import/export controls. */
export function toolsView(ctx) {
  const hasGame = Boolean(ctx.app.game());
  const action = (label, key, message, close = false) => button(label, () => ctx.run(() => ctx.app.actions[key](), message, close), { disabled: !hasGame, 'data-testid': `menu-tool-${key}` });
  const paste = h('textarea', { id: 'c2-import-text', rows: '5', placeholder: 'Paste your Sudoku backup JSON here', spellcheck: 'false' });
  const importText = text => ctx.run(() => { const result = ctx.app.actions.importData(text); return importSummary(result); }, 'Data imported.');
  return [h('p', { className: 'c2-note' }, 'Checks, reveals, and filled notes count as assistance. Restarting keeps assistance history.'), h('div', { className: 'c2-tool-grid' },
    button('Check entries', () => ctx.run(() => { const wrong = ctx.app.actions.check(); return wrong.length ? `${wrong.length} incorrect ${wrong.length === 1 ? 'entry' : 'entries'} highlighted on the board.` : 'No incorrect entries found.'; }, 'Entries checked.'), { disabled: !hasGame }),
    button('Reveal selected cell', () => ctx.run(() => ctx.app.actions.revealCell() ? 'Selected cell revealed.' : 'Select an empty, editable cell on the board first.', 'Cell revealed.'), { disabled: !hasGame }),
    action('Fill pencil notes', 'fillNotes', 'Pencil notes filled.'), action('Clear all notes', 'clearNotes', 'Pencil notes cleared.'),
    button('Restart puzzle', () => { const restart = () => ctx.run(() => ctx.app.actions.restart(), 'Puzzle restarted.', true); if (ctx.app.settings().confirmRestart) ctx.confirm('Restart this puzzle?', 'All entries, notes, mistakes, and time will reset. Assistance history is kept.', restart); else restart(); }, { disabled: !hasGame })),
    h('h3', {}, 'Keep a backup'), h('p', {}, 'Export your puzzles, settings, and statistics as JSON. Your data stays on this device unless you choose to share it.'), h('div', { className: 'c2-tool-grid' }, button('Download backup', () => ctx.run(() => exportBackup(ctx.app), 'Backup downloaded.')), button('Share backup', () => ctx.run(() => exportBackup(ctx.app, true), 'Backup shared or downloaded.'))),
    h('h3', {}, 'Import data'), h('p', { className: 'c2-note' }, 'Records are combined. Conflicting puzzles keep both copies. Your current settings are kept if settings differ.'),
    h('label', { className: 'c2-file-label', for: 'c2-import-file' }, 'Choose a JSON backup'), h('input', { id: 'c2-import-file', type: 'file', accept: '.json,application/json', onchange: event => { const file = event.target.files[0]; if (file) ctx.run(async () => importSummary(ctx.app.actions.importData(await readBackupFile(file))), 'Data imported.'); } }),
    h('label', { className: 'c2-file-label', for: 'c2-import-text' }, 'Or paste backup JSON'), paste, button('Import pasted data', () => importText(paste.value)),
  ];
}
