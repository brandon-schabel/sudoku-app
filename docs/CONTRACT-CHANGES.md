
## 2026-10-28 — B domain review fixes

- `createStore(backend, { now = Date.now })` accepts an optional clock function used to initialize persisted install metadata deterministically. `migrateLegacy(backend, { now = Date.now })` accepts the same optional clock. Existing calls remain valid.
- `restoreRecovery(archive, id, savedAt, now = Date.now())` accepts an optional restore timestamp so the preserved current game and updated entry have deterministic timestamps. Existing three-argument calls remain valid.
- `dailyCalendar(records, archive, year, month, now = Date.now())` accepts an optional millisecond timestamp for deterministic future-day classification. Existing four-argument calls remain valid.
- `trend` returns null deltas when there is no previous window; when there are 1–4 earlier matching games, it compares against those available games and reports their actual count in `previous.n`.
- Empty difficulty buckets in `computeStats` use `avgMs: null`, matching `bestMs` and `bestScore` nullability. Unknown stats filters default to `all`.
