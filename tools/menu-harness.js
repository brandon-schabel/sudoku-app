import { DEFAULT_SETTINGS, createRecord, computeScore, personalBest, emptyArchive, saveActive, resume, restoreRecovery, removeEntry, exportData, importData } from '../src/domain/index.js';
import { dailyKey } from '../src/engine/index.js';
import { createMenu } from '../src/ui/menu/index.js';
import { createWinDialog } from '../src/ui/win.js';
import { createOnboarding } from '../src/ui/onboarding.js';
import { h } from '../src/ui/dom.js';
const params = new URLSearchParams(location.search);
const now = Date.now();
const baseAssist = { hints: 0, checks: 0, reveals: 0, errorsShown: 0, autoNotes: 0 };
function fixture(id, difficulty = 'easy', extra = {}) {
  const puzzle = Array.from({ length: 81 }, (_, i) => i % 3 === 0 ? i % 9 + 1 : 0);
  return { schema: 2, id, kind: 'random', dailyKey: null, difficulty, puzzle, values: puzzle.map((value, i) => value || (i % 4 === 0 ? 3 : 0)), solution: Array(81).fill(1), notes: Array(81).fill(0), elapsedMs: 919000, mistakes: 0, assist: { ...baseAssist }, completed: false, createdAt: now - 3600000, updatedAt: now, ...extra };
}
let current = fixture('current');
let data = { schema: 2, settings: { ...DEFAULT_SETTINGS, theme: params.get('theme') || 'graphite', colorMode: params.get('mode') || 'light' }, archive: emptyArchive(), records: [], meta: { installedAt: now, completedCount: 40, reviewPromptedAt: null, migratedFrom: null } };
for (let i = 0; i < 5; i++) data.archive = saveActive(data.archive, fixture(i === 0 ? 'current' : `saved-${i}`, ['easy', 'medium', 'hard', 'expert'][i % 4], i === 1 ? { kind: 'daily', dailyKey: dailyKey() } : {}), now - i * 300000);
data.archive = saveActive(data.archive, { ...current, elapsedMs: 929000 }, now + 60000);
for (let i = 0; i < 48; i++) data.records.push(createRecord(fixture(`record-${i}`, ['easy', 'medium', 'hard', 'expert'][i % 4], { completed: true, completedAt: now - i * 3600000, elapsedMs: (i % 6 + 2) * 60000, mistakes: i % 3, assist: { ...baseAssist, reveals: i % 8 < 4 ? 0 : 1 }, dailyKey: i < 3 ? dailyKey(new Date(now - (i + 1) * 86400000)) : null })));
if (params.has('empty')) { data.records = []; data.archive = emptyArchive(); }
const listeners = new Set();
let lastAction = null;
function change(action) { lastAction = action; document.getElementById('harness-action').textContent = action; for (const fn of listeners) fn(); }
function applySettings() {
  const s = data.settings, html = document.documentElement;
  html.dataset.theme = s.theme;
  html.dataset.mode = s.colorMode === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : s.colorMode;
  html.dataset.text = s.textSize; html.dataset.motion = s.reducedMotion === 'off' ? 'full' : 'reduce'; html.dataset.cb = s.colorblind ? '1' : '0';
}
const app = {
  data: () => data, settings: () => data.settings, game: () => current,
  setSetting(key, value) { data.settings = { ...data.settings, [key]: value }; applySettings(); change(`setting:${key}`); },
  on(event, fn) { if (event === 'change') listeners.add(fn); return () => listeners.delete(fn); },
  actions: {
    resume() { menu.close(); change('resume'); },
    async newGame(difficulty) { current = fixture(`new-${Date.now()}`, difficulty); data.archive = saveActive(data.archive, current); change(`new:${difficulty}`); },
    async startDaily(dateKey) { current = fixture(`daily-${dateKey}`, 'medium', { kind: 'daily', dailyKey: dateKey }); data.archive = saveActive(data.archive, current); change(`daily:${dateKey}`); },
    continueEntry(id) { data.archive = resume(data.archive, id); current = data.archive.entries[id].game; change(`continue:${id}`); },
    restoreRecovery(id, savedAt) { data.archive = restoreRecovery(data.archive, id, savedAt); current = data.archive.entries[id].game; change(`restore:${id}`); },
    removeEntry(id) { data.archive = removeEntry(data.archive, id); change(`remove:${id}`); },
    restart() { current = { ...current, values: current.puzzle.slice(), elapsedMs: 0 }; change('restart'); },
    check() { change('check'); return []; }, revealCell() { change('revealCell'); return false; }, fillNotes() { change('fillNotes'); }, clearNotes() { change('clearNotes'); },
    exportData() { return exportData(data); },
    importData(text) { const result = importData(data, text); data = result.data; change('import'); return { added: result.added, conflicts: result.conflicts }; },
  },
};
const menu = createMenu({ root: document.getElementById('menu-root'), app });
const win = createWinDialog({ root: document.getElementById('win-root'), app });
const onboarding = createOnboarding({ root: document.getElementById('onboarding-root'), app });
function show(view = 'menu') {
  document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close());
  if (view === 'win') {
    const completed = { ...current, completed: true, completedAt: now };
    const record = createRecord(completed);
    win.show({ game: completed, record, score: computeScore({ ...completed, hints: 0 }), personalBest: personalBest(data.records, record) });
  } else if (view === 'onboarding') { app.setSetting('onboardingDone', false); onboarding.maybeShow(); }
  else menu.open(view);
}
const views = ['menu', 'continue', 'daily', 'new', 'stats', 'settings', 'howto', 'tools', 'win', 'onboarding'];
for (const view of views) document.getElementById('harness-nav').append(h('button', { type: 'button', onclick: () => show(view), 'data-view': view }, view));
applySettings();
window.__menuHarness = { app, menu, win, onboarding, show, views, lastAction: () => lastAction };
show(params.get('view') || 'menu');
