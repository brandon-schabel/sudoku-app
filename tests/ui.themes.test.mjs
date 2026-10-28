import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { THEMES } from '../src/domain/index.js';
const css = readFileSync(new URL('../styles/themes.css', import.meta.url), 'utf8');
const variables = 'bg surface surface-2 text text-muted border accent accent-contrast cell-bg cell-given cell-user cell-selected cell-related cell-same note error error-bg success focus shadow'.split(' ').sort();
const textPairs = [['text', 'bg'], ['text', 'surface'], ['text', 'surface-2'], ['text', 'cell-bg'], ['text', 'cell-selected'], ['text', 'cell-related'], ['text', 'cell-same'], ['cell-given', 'cell-bg'], ['cell-user', 'cell-bg'], ['error', 'cell-bg'], ['error', 'error-bg'], ['accent-contrast', 'accent'], ['text-muted', 'bg'], ['text-muted', 'surface'], ['note', 'cell-bg'], ['success', 'surface']];
const uiPairs = [['focus', 'bg'], ['focus', 'surface'], ['accent', 'bg'], ['border', 'surface'], ['border', 'surface-2']];
function tokens(block) { return Object.fromEntries([...block.matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)].map(match => [match[1], match[2].trim()])); }
function luminance(hex) {
  assert.match(hex, /^#[0-9a-f]{6}$/i);
  const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
}
function contrast(fg, bg) { const a = luminance(fg), b = luminance(bg); return (Math.max(a, b) + .05) / (Math.min(a, b) + .05); }
for (const theme of THEMES) for (const mode of ['light', 'dark']) {
  test(`${theme} ${mode}: complete tokens and WCAG AA text contrast`, () => {
    const block = css.match(new RegExp(`html\\[data-theme="${theme}"\\]\\[data-mode="${mode}"\\][^{]*\\{([^}]+)\\}`))?.[1];
    assert.ok(block, 'theme selector exists');
    const palette = tokens(block);
    assert.deepEqual(Object.keys(palette).sort(), variables);
    if (theme === 'graphite') for (const value of Object.values(palette).filter(value => /^#[0-9a-f]{6}$/.test(value))) assert.ok(value.slice(1, 3) === value.slice(3, 5) && value.slice(3, 5) === value.slice(5, 7), 'Graphite stays grayscale');
    for (const [foreground, background] of textPairs) assert.ok(contrast(palette[foreground], palette[background]) >= 4.5, `${foreground}/${background}: ${contrast(palette[foreground], palette[background]).toFixed(2)}`);
    for (const [foreground, background] of uiPairs) assert.ok(contrast(palette[foreground], palette[background]) >= 3, `${foreground}/${background}: ${contrast(palette[foreground], palette[background]).toFixed(2)}`);
    const cb = tokens(css.match(new RegExp(`html\\[data-cb="1"\\]\\[data-mode="${mode}"\\]\\s*\\{([^}]+)\\}`))[1]);
    const colorblind = { ...palette, ...cb };
    for (const [foreground, background] of textPairs) assert.ok(contrast(colorblind[foreground], colorblind[background]) >= 4.5, `colorblind ${foreground}/${background}: ${contrast(colorblind[foreground], colorblind[background]).toFixed(2)}`);
    for (const [foreground, background] of uiPairs) assert.ok(contrast(colorblind[foreground], colorblind[background]) >= 3, `colorblind ${foreground}/${background}: ${contrast(colorblind[foreground], colorblind[background]).toFixed(2)}`);
  });
}
test('text scaling and reduced-motion hooks match shell attributes', () => {
  for (const [size, scale] of [['default', '1'], ['large', '1.15'], ['xlarge', '1.3']]) assert.ok(css.includes(`html[data-text="${size}"] { --text-scale: ${scale}; }`));
  const menuCSS = readFileSync(new URL('../styles/menu.css', import.meta.url), 'utf8');
  assert.match(menuCSS, /font:\s*calc\([^;]*var\(--text-scale/);
  assert.match(menuCSS, /\.c2-error\s*\{[^}]*text-decoration:\s*underline wavy/);
  assert.match(menuCSS, /prefers-reduced-motion: reduce/);
  assert.match(menuCSS, /html\[data-motion="reduce"\]/);
});
