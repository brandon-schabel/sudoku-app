import { personalBest as compareBest, isAssisted } from '../domain/index.js';
import { h } from './dom.js';
import { modal, button } from './menu/modal.js';
import { formatTime } from './menu/models.js';
import { createMenu } from './menu/index.js';

/** Completion display values; comparisons stay within difficulty and assistance. */
export function winModel(records, { game, record, score, personalBest }) {
  const assisted = record?.assisted ?? isAssisted(game.assist || {});
  return { score: score ?? record?.score ?? 0, time: formatTime(record?.elapsedMs ?? game.elapsedMs), mistakes: record?.mistakes ?? game.mistakes ?? 0, assisted, best: personalBest ?? (record ? compareBest(records, record) : { isBestTime: false, isBestScore: false }) };
}

/** Create a win dialog with personal bests and self-contained menu navigation. */
export function createWinDialog({ root, app }) {
  const panel = modal(root, { testid: 'win-dialog', title: 'Beautifully solved.', onEscape: hide });
  // The facade deliberately has no menu-open action. Reuse the same menu component
  // for these destinations so the exact facade works without shell extensions.
  const menuRoot = h('div'); root.append(menuRoot);
  const menu = createMenu({ root: menuRoot, app });
  const navigate = view => { hide(); menu.open(view); };
  panel.footer.append(button('New game', () => navigate('new'), { className: 'c2-button c2-primary' }), button('Statistics', () => navigate('stats')), button('View board', hide));
  function hide() { panel.hide(); }
  return {
    show(payload) {
      menu.close();
      const model = winModel(app.data().records, payload);
      panel.body.replaceChildren(h('p', { className: 'c2-intro' }, 'Every number found its place.'), h('p', { className: 'c2-score' }, model.score.toLocaleString(), h('small', {}, 'points')), h('div', { className: 'c2-badges' }, model.best.isBestTime ? h('span', { className: 'c2-badge' }, 'New personal best · time') : null, model.best.isBestScore ? h('span', { className: 'c2-badge' }, 'New personal best · score') : null), h('p', { className: 'c2-result' }, `${model.time} · ${model.mistakes} ${model.mistakes === 1 ? 'mistake' : 'mistakes'}`), h('p', { className: 'c2-note' }, model.assisted ? 'Assisted finish. Hints, checks, reveals, shown errors, or filled notes helped along the way. Your bests are compared with other assisted games.' : 'Unassisted finish. Your bests are compared with other unassisted games.'));
      panel.show();
    }, hide,
  };
}
