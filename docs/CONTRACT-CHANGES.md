# Contract changes (append only)

- Lead assignment (D fix round 1): `docs/BUILD-RESULTS.md`, `tests/build.pwa.test.mjs`, `tests/build.www.test.mjs` and `tests/platform.adapters.test.mjs` are explicitly assigned to stream D's write set.
- Platform adapters now resolve Capacitor plugins through `window.Capacitor.registerPlugin('Haptics'|'App'|'InAppReview')` (signatures unchanged).

## 2026-10-28 — B domain review fixes

- `createStore(backend, { now = Date.now })` accepts an optional clock function used to initialize persisted install metadata deterministically. `migrateLegacy(backend, { now = Date.now })` accepts the same optional clock. Existing calls remain valid.
- `restoreRecovery(archive, id, savedAt, now = Date.now())` accepts an optional restore timestamp so the preserved current game and updated entry have deterministic timestamps. Existing three-argument calls remain valid.
- `dailyCalendar(records, archive, year, month, now = Date.now())` accepts an optional millisecond timestamp for deterministic future-day classification. Existing four-argument calls remain valid.
- `trend` returns null deltas when there is no previous window; when there are 1–4 earlier matching games, it compares against those available games and reports their actual count in `previous.n`.
- Empty difficulty buckets in `computeStats` use `avgMs: null`, matching `bestMs` and `bestScore` nullability. Unknown stats filters default to `all`.
- `trend` requires two complete five-game windows before returning a comparison (`null` with fewer than 10 matching games), matching the B2 acceptance criteria in ROADMAP §4. This supersedes the earlier partial-window behavior above.
