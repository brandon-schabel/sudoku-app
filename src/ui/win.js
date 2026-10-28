import { personalBest as compareBest, isAssisted } from '../domain/index.js';
import { h } from './dom.js';
import { modal, button } from './menu/modal.js';
import { formatTime } from './menu/models.js';
import { menuForApp } from './menu/index.js';
import { shouldPromptReview } from '../domain/index.js';
import { requestReview } from '../platform/index.js';

/** Review policy also requires the facade persistence hook to prevent repeats. */
export function reviewPromptDecision(meta, records, canPersist, now = Date.now()) {
  return Boolean(canPersist && shouldPromptReview(meta, records, now));
}

/** Persist the cooldown before asking the platform to show its review prompt. */
export async function promptForReview(app, request = requestReview, now = Date.now()) {
  const data = app.data();
  const persist = app.actions?.setReviewPromptedAt;
  if (!reviewPromptDecision(data.meta, data.records, typeof persist === 'function', now)) return false;
  try {
    persist(now);
    return await request();
  } catch {
    return false;
  }
}

/** Completion display values; comparisons stay within difficulty and assistance. */
export function winModel(records, { game, record, score, personalBest }) {
  const assisted = record?.assisted ?? isAssisted(game.assist || {});
  return { score: score ?? record?.score ?? 0, time: formatTime(record?.elapsedMs ?? game.elapsedMs), mistakes: record?.mistakes ?? game.mistakes ?? 0, assisted, best: personalBest ?? (record ? compareBest(records, record) : { isBestTime: false, isBestScore: false }) };
}

/** Create a win dialog with personal bests and self-contained menu navigation. */
export function createWinDialog({ root, app, menu: suppliedMenu }) {
  const panel = modal(root, { testid: 'win-dialog', title: 'Beautifully solved.', onEscape: hide });
  const navigate = view => {
    hide();
    const menu = suppliedMenu || menuForApp(app);
    menu?.open(view);
  };
  panel.footer.append(button('New game', () => navigate('new'), { className: 'c2-button c2-primary', 'data-testid': 'win-new' }), button('Statistics', () => navigate('stats'), { 'data-testid': 'win-stats' }), button('View board', hide, { 'data-testid': 'win-board' }));
  function hide() { panel.hide(); }
  return {
    show(payload) {
      (suppliedMenu || menuForApp(app))?.close();
      const model = winModel(app.data().records, payload);
      panel.body.replaceChildren(h('p', { className: 'c2-intro' }, 'Every number found its place.'), h('p', { className: 'c2-score' }, model.score.toLocaleString(), h('small', {}, 'points')), h('div', { className: 'c2-badges' }, model.best.isBestTime ? h('span', { className: 'c2-badge' }, 'New personal best · time') : null, model.best.isBestScore ? h('span', { className: 'c2-badge' }, 'New personal best · score') : null), h('p', { className: 'c2-result' }, `${model.time} · ${model.mistakes} ${model.mistakes === 1 ? 'mistake' : 'mistakes'}`), h('p', { className: 'c2-note' }, model.assisted ? 'Assisted finish. Hints, checks, reveals, shown errors, or filled notes helped along the way. Your bests are compared with other assisted games.' : 'Unassisted finish. Your bests are compared with other unassisted games.'));
      panel.show();
      // Persist before requesting so repeated wins cannot prompt again if the
      // native review sheet is dismissed or the platform adapter is unavailable.
      void promptForReview(app);
    }, hide,
  };
}
