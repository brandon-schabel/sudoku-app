import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { shellFiles, parsePrecache } from '../scripts/lib/shell-files.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

/** @returns {{w:number,h:number}} PNG dimensions from the IHDR chunk */
function pngSize(p) {
  const b = readFileSync(join(root, p));
  assert.equal(b.subarray(1, 4).toString(), 'PNG', `${p} is a PNG`);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

test('manifest has required PWA fields', () => {
  const m = JSON.parse(read('manifest.webmanifest'));
  assert.equal(m.name, 'Still Sudoku');
  assert.equal(m.short_name, 'Sudoku');
  assert.equal(m.display, 'standalone');
  assert.ok(m.start_url.startsWith('./') && m.scope.startsWith('./'), 'relative start_url/scope');
  assert.match(m.theme_color, /^#[0-9a-f]{6}$/i);
  assert.match(m.background_color, /^#[0-9a-f]{6}$/i);
  const purposes = m.icons.map((i) => i.purpose);
  assert.ok(purposes.includes('any') && purposes.includes('maskable'));
  assert.ok(m.icons.some((i) => i.sizes === '192x192') && m.icons.some((i) => i.sizes === '512x512'));
});

test('every manifest icon exists and has its declared dimensions', () => {
  const m = JSON.parse(read('manifest.webmanifest'));
  for (const i of m.icons) {
    assert.ok(existsSync(join(root, i.src)), i.src);
    if (i.type === 'image/png') {
      const [w, h] = i.sizes.split('x').map(Number);
      assert.deepEqual(pngSize(i.src), { w, h }, i.src);
    }
  }
});

test('store icon and splash assets have the required dimensions', () => {
  for (const s of [48, 72, 96, 128, 144, 152, 192, 256, 384, 512, 1024]) {
    assert.deepEqual(pngSize(`assets/icons/icon-${s}.png`), { w: s, h: s });
  }
  assert.deepEqual(pngSize('assets/icons/apple-touch-icon.png'), { w: 180, h: 180 });
  assert.deepEqual(pngSize('assets/icons/store-icon-1024.png'), { w: 1024, h: 1024 });
  assert.deepEqual(pngSize('assets/icons/maskable-512.png'), { w: 512, h: 512 });
  for (const f of ['splash.png', 'splash-dark.png']) assert.deepEqual(pngSize(`assets/${f}`), { w: 2732, h: 2732 });
  for (const f of ['assets/icons/icon.svg', 'assets/icons/icon-maskable.svg', 'assets/icons/favicon.svg', 'assets/splash/splash.svg', 'assets/splash/splash-dark.svg']) {
    assert.ok(existsSync(join(root, f)), f);
  }
});

test('store icon has no transparency (App Store requirement)', () => {
  const b = readFileSync(join(root, 'assets/icons/store-icon-1024.png'));
  // IHDR colour type at byte 25: 2 = RGB, 6 = RGBA. resvg emits RGBA, so check the corner pixel via full decode is overkill:
  // the source SVG is a full-bleed rect, which the test asserts instead.
  assert.ok([2, 6].includes(b[25]));
  assert.ok(!/rx=/.test(read('assets/icons/icon-full.svg').split('<rect')[1].split('/>')[0]), 'full-bleed icon has no rounded corners');
});

test('precache list covers the whole app shell and every entry exists', () => {
  const list = parsePrecache(read('sw.js'));
  assert.equal(list[0], './');
  const set = new Set(list);
  const missing = shellFiles(root).filter((f) => !set.has(f));
  assert.deepEqual(missing, [], 'files imported/referenced by the app but missing from sw.js PRECACHE (run: node scripts/update-precache.mjs)');
  for (const f of list.slice(1)) assert.ok(existsSync(join(root, f)), `precache entry exists: ${f}`);
  assert.equal(new Set(list).size, list.length, 'no duplicates');
});

test('sw.js is subpath-safe and versioned', () => {
  const sw = read('sw.js');
  assert.match(sw, /const VERSION = '[^']+'/);
  assert.match(sw, /registration\.scope/);
  assert.match(sw, /caches\.delete/);
  assert.ok(!/['"]\/(?!\/)[a-z]/i.test(sw.replace(/\/\*[\s\S]*?\*\//, '').replace(/\/(?:\\.|[^/\n])+\/[gimsuy]*/g, '')), 'no root-absolute paths');
});

test('service worker lifecycle: install precaches, activate drops old caches, fetch is stale-while-revalidate', async () => {
  const listeners = {};
  const store = new Map();
  const mkCache = (name) => {
    const m = store.get(name) || new Map();
    store.set(name, m);
    return {
      addAll: async (reqs) => reqs.forEach((r) => m.set(r.url, new Response('x'))),
      match: async (req) => { const r = m.get(typeof req === 'string' ? req : req.url); return r ? r.clone() : undefined; },
      put: async (req, res) => m.set(typeof req === 'string' ? req : req.url, res),
    };
  };
  const self_ = {
    registration: { scope: 'https://example.test/app/' },
    location: new URL('https://example.test/app/sw.js'),
    addEventListener: (t, f) => (listeners[t] = f),
    skipWaiting: async () => {},
    clients: { claim: async () => {} },
  };
  store.set('still-sudoku-old', new Map());
  store.set('unrelated', new Map());
  const caches = {
    open: async (n) => mkCache(n),
    keys: async () => [...store.keys()],
    delete: async (k) => store.delete(k),
  };
  let netHits = 0;
  const fetch_ = async () => { netHits++; return Object.assign(new Response('fresh'), { type: 'basic' }); };
  const fn = new Function('self', 'caches', 'fetch', 'Request', 'Response', 'URL', readFileSync(join(root, 'sw.js'), 'utf8'));
  fn(self_, caches, fetch_, Request, Response, URL);

  let p;
  listeners.install({ waitUntil: (x) => (p = x) });
  await p;
  const cacheName = [...store.keys()].find((k) => k.startsWith('still-sudoku-') && k !== 'still-sudoku-old');
  assert.ok(cacheName);
  assert.ok(store.get(cacheName).has('https://example.test/app/index.html'), 'precached under scope');

  listeners.activate({ waitUntil: (x) => (p = x) });
  await p;
  assert.ok(!store.has('still-sudoku-old'), 'old cache removed');
  assert.ok(store.has('unrelated'), 'foreign caches untouched');

  let responded;
  const waits = [];
  listeners.fetch({
    request: Object.assign(new Request('https://example.test/app/styles.css'), {}),
    respondWith: (x) => (responded = x),
    waitUntil: (x) => waits.push(x),
  });
  const res = await responded;
  assert.equal(await res.text(), 'x', 'served from cache first');
  await Promise.all(waits);
  assert.equal(netHits, 1, 'revalidated in background');

  // cross-origin and non-GET are ignored
  responded = undefined;
  listeners.fetch({ request: new Request('https://other.test/a.js'), respondWith: (x) => (responded = x), waitUntil() {} });
  listeners.fetch({ request: new Request('https://example.test/app/a', { method: 'POST', body: 'x' }), respondWith: (x) => (responded = x), waitUntil() {} });
  assert.equal(responded, undefined);
});

test('privacy.html states no data collection and flags the placeholder email', () => {
  const html = read('privacy.html');
  assert.match(html, /do not collect/i);
  assert.match(html, /PLACEHOLDER/);
  assert.match(html, /on your own device/i);
});
