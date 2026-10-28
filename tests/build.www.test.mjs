import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildWww } from '../scripts/build-www.mjs';
import { shellFiles, parsePrecache } from '../scripts/lib/shell-files.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('build-www produces a self-contained shell with a stamped service worker', () => {
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
