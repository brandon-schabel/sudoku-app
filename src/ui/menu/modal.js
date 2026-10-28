import { h } from '../dom.js';
let nextId = 0;

/** Create a native modal with focus containment, Escape routing, and focus return. */
export function modal(root, { testid, title, onEscape }) {
  const id = `c2-dialog-${++nextId}`;
  const heading = h('h2', { id: `${id}-title` }, title);
  const dialog = h('dialog', { className: 'c2-dialog', 'data-testid': testid, 'aria-modal': 'true', 'aria-labelledby': heading.id });
  const body = h('div', { className: 'c2-body' });
  const live = h('p', { className: 'c2-live', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' });
  const footer = h('footer', { className: 'c2-footer' });
  const header = h('header', { className: 'c2-header' }, heading);
  dialog.append(header, body, live, footer);
  root.append(dialog);
  let previous;
  dialog.addEventListener('cancel', event => { event.preventDefault(); onEscape(); });
  dialog.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const focusable = [...dialog.querySelectorAll('button:not(:disabled), input:not(:disabled), textarea, select, a[href], [tabindex="0"]')].filter(node => node.getClientRects().length);
    const first = focusable[0], last = focusable.at(-1);
    if (!first) { event.preventDefault(); dialog.focus(); }
    else if (event.shiftKey && (document.activeElement === first || !focusable.includes(document.activeElement))) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  return { dialog, heading, header, body, live, footer,
    show() { if (!dialog.open) { previous = document.activeElement; dialog.showModal(); } },
    hide() { if (dialog.open) { dialog.close(); if (previous?.isConnected) previous.focus(); } },
    announce(message) { live.textContent = message; },
  };
}

/** A consistently styled, labelled action. */
export function button(label, action, attrs = {}) {
  return h('button', { type: 'button', className: 'c2-button', onclick: action, ...attrs }, label);
}
