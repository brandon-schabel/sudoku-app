# Contract changes (append only)

- Lead assignment (D fix round 1): `docs/BUILD-RESULTS.md`, `tests/build.pwa.test.mjs`, `tests/build.www.test.mjs` and `tests/platform.adapters.test.mjs` are explicitly assigned to stream D's write set.
- Platform adapters now resolve Capacitor plugins through `window.Capacitor.registerPlugin('Haptics'|'App'|'InAppReview')` (signatures unchanged).
