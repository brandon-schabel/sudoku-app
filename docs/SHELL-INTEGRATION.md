# Shell integration for stream C (from stream D)

Stream D does not edit `index.html` / `src/main.js`. Add these (ROADMAP 2.6). All paths relative.

## index.html `<head>`
```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#f4f2ee" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#23262c" media="(prefers-color-scheme: dark)">
<link rel="manifest" href="./manifest.webmanifest">
<link rel="icon" href="./assets/icons/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="./assets/icons/apple-touch-icon.png">
<title>Still Sudoku</title>
```
(Replace the current inline data-URI `<link rel="icon">`.) Also add `<meta name="apple-mobile-web-app-capable" content="yes">` and `<meta name="apple-mobile-web-app-title" content="Sudoku">`.

## CSS
Respect `env(safe-area-inset-top|right|bottom|left)` on the app container (the iOS wrapper uses `contentInset: never`, so the webview is edge to edge).

## src/main.js
```js
import { registerServiceWorker, haptic, playSound, onAppStateChange, requestReview, share } from './platform/index.js';
// after first render:
registerServiceWorker();
```
Gate `haptic`/`playSound` on settings. Use `onAppStateChange(active => ...)` for the "hidden > 10 s → pause" rule.

## Precache
After adding/removing app files run `node scripts/update-precache.mjs` (or just `npm run build:www`, which stamps `www/sw.js`). `tests/build.pwa.test.mjs` fails if any file reachable from `index.html` or the ES-module import graph (static imports, `import()`, `new URL('./x.js', import.meta.url)` for workers) is missing from `sw.js` PRECACHE.
