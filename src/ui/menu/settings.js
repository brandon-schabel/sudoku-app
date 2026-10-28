import { THEMES } from '../../domain/index.js';
import { h } from '../dom.js';
import { button } from './modal.js';
const title = word => word[0].toUpperCase() + word.slice(1);
const toggles = [
  ['highlightRelated', 'Highlight related cells', 'Shade the selected row, column, and box.'],
  ['highlightSameDigit', 'Highlight matching numbers', 'Find the same digit across the board.'],
  ['showMistakes', 'Show mistakes as you go', 'Underline incorrect entries. This counts as assistance.'],
  ['cleanupNotes', 'Clean up pencil notes', 'Remove a placed digit from notes in related cells.'],
  ['showTimer', 'Show timer', 'Keep elapsed time visible while you play.'],
  ['confirmNewGame', 'Confirm new games', 'Ask before starting another puzzle.'],
  ['confirmRestart', 'Confirm restarts', 'Ask before clearing the current puzzle.'],
  ['colorblind', 'Colorblind-safe marks', 'Use blue and orange with shaped error marks.'],
  ['haptics', 'Haptic feedback', 'Gentle feedback on supported devices.'],
  ['sounds', 'Sounds', 'Quiet feedback for placements and mistakes.'],
];

/** Render all supported settings with native checkboxes and radio groups. */
export function settingsView({ app }) {
  const settings = app.settings();
  const group = (key, label, choices) => h('fieldset', { className: 'c2-setting-group', 'data-testid': `setting-${key}` }, h('legend', {}, label), h('div', { className: 'c2-segmented' }, choices.map(([value, text]) => h('label', {}, h('input', { type: 'radio', name: `c2-${key}`, value, checked: settings[key] === value, onchange: () => app.setSetting(key, value) }), h('span', {}, text)))));
  return [
    h('p', { className: 'c2-intro' }, 'Make yourself comfortable. Your choices stay on this device.'),
    h('div', { className: 'c2-section-title' }, h('h3', {}, 'Themes'), button(settings.colorMode === 'dark' ? 'Switch to light' : 'Switch to dark', () => app.setSetting('colorMode', settings.colorMode === 'dark' ? 'light' : 'dark'), { 'aria-label': 'Quick dark mode toggle' })),
    h('div', { className: 'c2-themes' }, THEMES.map(theme => button([
      h('span', { className: 'c2-preview', 'data-theme': theme, 'aria-hidden': 'true' }, ['light', 'dark'].map(mode => h('span', { className: 'c2-mini', 'data-mode': mode }, Array.from({ length: 9 }, (_, i) => h('span', {}, [0, 3, 7].includes(i) ? String(i + 1) : ''))))),
      h('span', { className: 'c2-theme-label' }, title(theme), settings.theme === theme ? h('span', { 'aria-hidden': 'true' }, ' ✓') : null),
    ], () => app.setSetting('theme', theme), { className: 'c2-theme', 'data-testid': `theme-${theme}`, 'aria-pressed': String(settings.theme === theme), 'aria-label': `${title(theme)} theme, light and dark previews` }))),
    group('colorMode', 'Appearance', [['system', 'System'], ['light', 'Light'], ['dark', 'Dark']]),
    h('h3', {}, 'Play your way'),
    toggles.map(([key, label, detail]) => h('label', { className: 'c2-toggle' }, h('span', {}, h('strong', {}, label), h('small', {}, detail)), h('input', { type: 'checkbox', role: 'switch', checked: settings[key], 'aria-label': label, 'data-testid': `setting-${key}`, onchange: event => app.setSetting(key, event.target.checked) }))),
    group('inputMode', 'Number entry', [['cell-first', 'Cell first'], ['number-first', 'Number first']]),
    group('textSize', 'Text size', [['default', 'Default'], ['large', 'Large'], ['xlarge', 'Extra large']]),
    group('reducedMotion', 'Reduced motion', [['system', 'System'], ['on', 'On'], ['off', 'Off']]),
  ];
}
