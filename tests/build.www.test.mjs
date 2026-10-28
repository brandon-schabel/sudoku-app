import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, accessSync, constants, existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildWww } from '../scripts/build-www.mjs';
import { shellFiles, parsePrecache } from '../scripts/lib/shell-files.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function writableTmp() {
  try {
    accessSync(tmpdir(), constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

test('build-www produces a self-contained shell with a stamped service worker', { skip: !writableTmp() && 'tmpdir not writable' }, () => {
  const out = mkdtempSync(join(tmpdir(), 'www-'));
  try {
    const { version, files } = buildWww(out);
    assert.match(version, /^[0-9a-f]{12}$/);
    for (const f of ['index.html', 'styles.css', 'manifest.webmanifest', 'sw.js', 'src/main.js']) {
      assert.ok(existsSync(join(out, f)), f);
    }
    assert.ok(!files.some((f) => /\.test\./.test(f)), 'no tests copied');
    assert.ok(!files.some((f) => f.startsWith('assets/splash')), 'splash sources not shipped');
    const sw = readFileSync(join(out, 'sw.js'), 'utf8');
    assert.ok(sw.includes(`const VERSION = '${version}'`));
    const list = new Set(parsePrecache(sw));
    for (const f of shellFiles(out)) assert.ok(list.has(f), `precached: ${f}`);
    for (const f of list) if (f !== './') assert.ok(existsSync(join(out, f)), `exists in www: ${f}`);
    const html = readFileSync(join(out, 'index.html'), 'utf8');
    for (const m of html.matchAll(/(?:href|src)="(\.\/[^"#?]+)"/g)) assert.ok(existsSync(join(out, m[1])), `index.html reference exists in www: ${m[1]}`);
    assert.equal(buildWww(out).version, version, 'deterministic');
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test('capacitor.config.json points at www and flags the placeholder id', () => {
  const c = JSON.parse(readFileSync(join(root, 'capacitor.config.json'), 'utf8'));
  assert.equal(c.webDir, 'www');
  assert.equal(c.appName, 'Still Sudoku');
  assert.equal(c.appId, 'com.brandonschabel.stillsudoku');
});
