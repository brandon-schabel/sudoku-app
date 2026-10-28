/* Still Sudoku service worker: offline app shell, stale-while-revalidate.
 * All URLs are resolved against the SW scope, so it works under any subpath.
 * PRECACHE is maintained by `node scripts/update-precache.mjs` (also run by build:www);
 * tests/build.precache.test.mjs fails if a file the app imports is missing from it. */
const VERSION = 'dev';
const CACHE_PREFIX = 'still-sudoku-';
const CACHE = CACHE_PREFIX + VERSION;
const PRECACHE = [
  "./",
  "assets/icons/apple-touch-icon.png",
  "assets/icons/favicon.svg",
  "assets/icons/icon-192.png",
  "assets/icons/icon-512.png",
  "assets/icons/maskable-192.png",
  "assets/icons/maskable-512.png",
  "index.html",
  "manifest.webmanifest",
  "privacy.html",
  "src/domain/archive.js",
  "src/domain/index.js",
  "src/domain/scoring.js",
  "src/domain/settings.js",
  "src/domain/stats.js",
  "src/domain/storage.js",
  "src/engine/bank.js",
  "src/engine/board.js",
  "src/engine/core.js",
  "src/engine/daily-v1-bank.js",
  "src/engine/generator.js",
  "src/engine/hints.js",
  "src/engine/index.js",
  "src/engine/techniques.js",
  "src/engine/worker.js",
  "src/game.js",
  "src/main.js",
  "src/platform/index.js",
  "src/ui/board.js",
  "src/ui/confirm.js",
  "src/ui/controller.js",
  "src/ui/dom.js",
  "src/ui/el.js",
  "src/ui/hint-panel.js",
  "src/ui/icons.js",
  "src/ui/keys.js",
  "src/ui/menu/index.js",
  "src/ui/menu/modal.js",
  "src/ui/menu/models.js",
  "src/ui/menu/settings.js",
  "src/ui/menu/views.js",
  "src/ui/onboarding.js",
  "src/ui/pad.js",
  "src/ui/status.js",
  "src/ui/toolbar.js",
  "src/ui/view-model.js",
  "src/ui/win.js",
  "styles.css",
  "styles/menu.css",
  "styles/themes.css"
];

const url = (p) => new URL(p, self.registration.scope).href;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(PRECACHE.map((p) => new Request(url(p), { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const reqUrl = new URL(req.url);
  if (reqUrl.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const isNav = req.mode === 'navigate';
    // Query strings (?seed=..., ?test=1) must not defeat the cache for pages.
    let cached = await cache.match(req, { ignoreSearch: isNav });
    if (!cached && isNav) cached = await cache.match(url('index.html'));
    const network = fetch(req)
      .then((res) => {
        if (res && res.ok && res.type === 'basic') cache.put(isNav ? new Request(reqUrl.origin + reqUrl.pathname) : req, res.clone());
        return res;
      })
      .catch(() => null);
    if (cached) {
      event.waitUntil(network);
      return cached;
    }
    return (await network) || new Response('Offline', { status: 503, statusText: 'Offline' });
  })());
});
