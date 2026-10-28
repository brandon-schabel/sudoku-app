import { h } from '../dom.js';
import { dailyKey } from '../../engine/index.js';
import { modal, button } from './modal.js';
import { pauseSummary, shiftMonth } from './models.js';
import { settingsView } from './settings.js';
import { homeView, newView, continueView, dailyView, statsView, howtoView, toolsView } from './views.js';
const views = { menu: homeView, new: newView, continue: continueView, daily: dailyView, stats: statsView, settings: settingsView, howto: howtoView, tools: toolsView };
const titles = { menu: 'A moment for you', new: 'New game', continue: 'Continue a puzzle', daily: 'Daily puzzle', stats: 'Statistics', settings: 'Themes & settings', howto: 'How to play', tools: 'Puzzle tools' };

/** Create the unified, accessible menu against the documented app facade. */
export function createMenu({ root, app, onOpen, onClose }) {
  let view = 'menu', pending = null, busy = false;
  const today = dailyKey().split('-').map(Number);
  const ctx = { app, year: today[0], month: today[1], filter: 'all',
    navigate(next) { pending = null; view = Object.hasOwn(views, next) ? next : 'menu'; render(true); },
    resume() { close(); app.actions.resume(); },
    changeMonth(delta) { Object.assign(ctx, shiftMonth(ctx.year, ctx.month, delta)); render(); },
    setFilter(filter) { ctx.filter = filter; render(); },
    confirm(title, text, action) { pending = { title, text, action }; render(true); },
    async run(action, message, dismiss = false) {
      if (busy) return;
      busy = true; panel.dialog.setAttribute('aria-busy', 'true');
      panel.announce('Working…');
      // Disable actions immediately so repeated clicks cannot enqueue another mutation.
      for (const control of panel.body.querySelectorAll('button, input, textarea')) control.disabled = true;
      try {
        const result = await action();
        pending = null;
        if (dismiss) close();
        else render();
        panel.announce(typeof result === 'string' ? result : message);
      } catch (error) {
        render();
        panel.announce(error.name === 'AbortError' ? 'Sharing cancelled.' : `Could not complete this action. ${error.message || 'Please try again.'}`);
      } finally { busy = false; panel.dialog.removeAttribute('aria-busy'); panel.footer.firstChild.disabled = !app.game(); }
    },
  };
  const back = () => {
    if (busy) return;
    if (pending) { pending = null; render(true); }
    else if (view !== 'menu') ctx.navigate('menu');
    else ctx.resume();
  };
  const panel = modal(root, { testid: 'menu', title: titles.menu, onEscape: back });
  const summary = h('p', { className: 'c2-summary' });
  const backButton = button('‹ Back', back, { className: 'c2-text-button', 'data-testid': 'menu-back' });
  panel.header.prepend(backButton);
  panel.header.append(summary);
  panel.footer.append(button('Return to puzzle', () => ctx.resume(), { className: 'c2-button c2-primary', 'data-testid': 'menu-return' }));
  panel.dialog.addEventListener('click', event => {
    if (event.target !== panel.dialog) return;
    const rect = panel.dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) back();
  });
  function render(moveFocus = false) {
    const active = panel.dialog.contains(document.activeElement) ? document.activeElement : null;
    const focusKey = active?.getAttribute('data-testid');
    const focusId = active?.id;
    const radioName = active?.getAttribute('name'), radioValue = active?.getAttribute('value');
    const scroll = panel.body.scrollTop;
    panel.heading.textContent = pending?.title || titles[view];
    summary.textContent = pauseSummary(app.game());
    backButton.hidden = view === 'menu' && !pending;
    panel.footer.firstChild.disabled = !app.game() || busy;
    panel.body.replaceChildren(...(pending ? [h('p', { className: 'c2-intro' }, pending.text), h('div', { className: 'c2-tool-grid' }, button('Cancel', back), button('Confirm', pending.action, { className: 'c2-button c2-primary', 'data-testid': 'menu-confirm' }))] : views[view](ctx)));
    if (moveFocus) {
      panel.body.scrollTop = 0;
      panel.heading.setAttribute('tabindex', '-1'); panel.heading.focus();
    } else {
      panel.body.scrollTop = scroll;
      const replacement = [...panel.dialog.querySelectorAll('button, input, textarea, [tabindex]')].find(node => focusKey ? node.getAttribute('data-testid') === focusKey : focusId ? node.id === focusId : radioName ? node.getAttribute('name') === radioName && node.getAttribute('value') === radioValue : false);
      replacement?.focus({ preventScroll: true });
    }
  }
  function close() {
    if (!panel.dialog.open) return;
    panel.hide(); pending = null; onClose?.();
  }
  app.on('change', () => { if (panel.dialog.open && !busy) render(); });
  return {
    open(next = 'menu') {
      if (busy) return;
      const wasOpen = panel.dialog.open;
      if (!wasOpen) onOpen?.();
      view = Object.hasOwn(views, next) ? next : 'menu'; pending = null;
      render(); panel.show();
      panel.body.scrollTop = 0;
    },
    close,
    isOpen() { return panel.dialog.open; },
    refresh() { if (panel.dialog.open && !busy) render(); },
  };
}
