import { h } from './dom.js';
import { modal, button } from './menu/modal.js';
/** Short, motion-independent first-run guidance. */
export const ONBOARDING_STEPS = Object.freeze([
  { title: 'A little room to think.', text: 'Fill each row, column, and 3 × 3 box with 1–9, once each. Every puzzle has one solution.', symbol: '1 2 3' },
  { title: 'Play at your own pace.', text: 'Choose a cell, then a number. Use Notes for possibilities, Undo to explore, and a hint when you want a gentle nudge. There is no mistake limit.', symbol: '4 5 6' },
  { title: 'Make yourself comfortable.', text: 'Open the pause menu for themes, larger text, a hidden timer, or number-first input. Unfinished puzzles stay in Continue, even when you start a new one.', symbol: '7 8 9' },
  { title: 'Just the puzzle. Always ad-free.', text: 'Your progress saves on this device. Puzzle tools can export a backup. A shared daily puzzle is here whenever you feel like one.', symbol: '✓' },
]);

/** Create skippable first-run onboarding, persisted through the app facade. */
export function createOnboarding({ root, app }) {
  let step = 0;
  const panel = modal(root, { testid: 'onboarding-dialog', title: '', onEscape: finish });
  function finish() { app.setSetting('onboardingDone', true); panel.hide(); }
  function render() {
    const data = ONBOARDING_STEPS[step];
    panel.heading.textContent = data.title;
    panel.body.replaceChildren(h('div', { className: 'c2-onboarding-art', 'aria-hidden': 'true' }, data.symbol), h('p', { className: 'c2-intro' }, data.text), h('p', { className: 'c2-step', role: 'status' }, `Step ${step + 1} of ${ONBOARDING_STEPS.length}`));
    panel.footer.replaceChildren(...[button('Skip introduction', finish, { className: 'c2-text-button' }), step ? button('Back', () => { step--; render(); }) : null, button(step === ONBOARDING_STEPS.length - 1 ? 'Start playing' : 'Next', () => { if (step === ONBOARDING_STEPS.length - 1) finish(); else { step++; render(); } }, { className: 'c2-button c2-primary' })].filter(Boolean));
    if (panel.dialog.open) { panel.heading.setAttribute('tabindex', '-1'); panel.heading.focus(); }
  }
  return { maybeShow() { if (app.settings().onboardingDone || panel.dialog.open) return; step = 0; render(); panel.show(); } };
}
