import { h } from '../dom.js';
import { dailyKey } from '../../engine/index.js';
import { modal, button } from './modal.js';
import { createMenuMachine, pauseSummary, shiftMonth, shouldCallFacadeResume } from './models.js';
import { settingsView } from './settings.js';
import { homeView, newView, continueView, dailyView, statsView, howtoView, toolsView } from './views.js';
const appMenus = new WeakMap();

/** Find an existing app menu so completion buttons reuse the unified panel. */
export function menuForApp(app) { return appMenus.get(app); }

const views = { menu: homeView, new: newView, continue: continueView, daily: dailyView, stats: statsView, settings: settingsView, howto: howtoView, tools: toolsView };
const titles = { menu: 'A moment for you', new: 'New game', continue: 'Continue a puzzle', daily: 'Daily puzzle', stats: 'Statistics', settings: 'Themes & settings', howto: 'How to play', tools: 'Puzzle tools' };

/** Create the unified, accessible menu against the documented app facade. */
export function createMenu({ root, app, onOpen, onClose }) {
  const machine = createMenuMachine();
  const today = () => dailyKey().split('-').map(Number);
  const monthBounds = () => {
    const [maxYear, maxMonth] = today();
    const installedAt = app.data()?.meta?.installedAt;
    const date = Number.isFinite(installedAt) ? new Date(installedAt) : new Date(Date.UTC(maxYear, maxMonth - 1, 1));
    const minYear = date.getUTCFullYear(), minMonth = date.getUTCMonth() + 1;
    return minYear > maxYear || (minYear === maxYear && minMonth > maxMonth)
      ? { minYear: maxYear, minMonth: maxMonth, maxYear, maxMonth }
      : { minYear, minMonth, maxYear, maxMonth };
  };
  const [initialYear, initialMonth] = today();
  const ctx = { app, year: initialYear, month: initialMonth, filter: 'all', calendarToday: `${initialYear}-${String(initialMonth).padStart(2, '0')}`,
    syncCalendar() {
      const bounds = monthBounds(), currentMonth = `${bounds.maxYear}-${String(bounds.maxMonth).padStart(2, '0')}`;
      if (`${ctx.year}-${String(ctx.month).padStart(2, '0')}` === ctx.calendarToday) Object.assign(ctx, { year: bounds.maxYear, month: bounds.maxMonth });
      else Object.assign(ctx, shiftMonth(ctx.year, ctx.month, 0, bounds));
      ctx.calendarToday = currentMonth;
    },
    navigate(next) { if (machine.busy) return; panel.announce(''); machine.navigate(next, new Set(Object.keys(views))); render(true); },
    resume() { if (machine.busy) return; const hasGame = Boolean(app.game()); close(); if (shouldCallFacadeResume(hasGame, typeof onClose === 'function')) app.actions.resume(); },
    changeMonth(delta) { if (machine.busy) return; const bounds = monthBounds(); Object.assign(ctx, shiftMonth(ctx.year, ctx.month, delta, bounds)); render(); },
    setFilter(filter) { ctx.filter = filter; render(); },
    confirm(title, text, action) { panel.announce(''); machine.confirm({ title, text, action }); render(true); },
    async run(action, message, dismiss = false) {
      if (!machine.begin()) return;
      panel.dialog.setAttribute('aria-busy', 'true');
      panel.announce('Working…');
      // Disable actions immediately so repeated clicks cannot enqueue another mutation.
      for (const control of panel.body.querySelectorAll('button, input, textarea')) control.disabled = true;
      try {
        const result = await action();
        machine.clearPending();
        if (dismiss) close();
        else render();
        panel.announce(typeof result === 'string' ? result : message);
      } catch (error) {
        render();
        panel.announce(error.name === 'AbortError' ? 'Sharing cancelled.' : `Could not complete this action. ${error.message || 'Please try again.'}`);
      } finally { machine.finish(); panel.dialog.removeAttribute('aria-busy'); panel.footer.firstChild.disabled = !app.game(); }
    },
  };
  const back = () => {
    const action = machine.back();
    if (action === 'pending') render(true);
    else if (action === 'navigate') render(true);
    else if (action === 'resume') ctx.resume();
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
    panel.heading.textContent = machine.pending?.title || titles[machine.view];
    summary.textContent = pauseSummary(app.game());
    backButton.hidden = machine.view === 'menu' && !machine.pending;
    panel.footer.firstChild.disabled = !app.game() || machine.busy;
    panel.body.replaceChildren(...(machine.pending ? [h('p', { className: 'c2-intro' }, machine.pending.text), h('div', { className: 'c2-tool-grid' }, button('Cancel', back), button('Confirm', machine.pending.action, { className: 'c2-button c2-primary', 'data-testid': 'menu-confirm' }))] : views[machine.view](ctx)).flat(Infinity));
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
    panel.hide(); machine.navigate('menu', new Set(Object.keys(views))); onClose?.();
  }
  app.on('change', () => { if (panel.dialog.open && !machine.busy) render(); });
  const controller = {
    open(next = 'menu') {
      if (machine.busy) return;
      const wasOpen = panel.dialog.open;
      if (!wasOpen) onOpen?.();
      machine.navigate(next, new Set(Object.keys(views)));
      panel.announce(''); render(); panel.show();
      panel.body.scrollTop = 0;
    },
    close,
    isOpen() { return panel.dialog.open; },
    refresh() { if (panel.dialog.open && !machine.busy) render(); },
  };
  appMenus.set(app, controller);
  return controller;
}
