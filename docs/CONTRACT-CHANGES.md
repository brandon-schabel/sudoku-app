
## 2026-10-28 — B domain review fixes

- `createStore(backend, { now = Date.now })` accepts an optional clock function used to initialize persisted install metadata deterministically. `migrateLegacy(backend, { now = Date.now })` accepts the same optional clock. Existing calls remain valid.
- `restoreRecovery(archive, id, savedAt, now = Date.now())` accepts an optional restore timestamp so the preserved current game and updated entry have deterministic timestamps. Existing three-argument calls remain valid.
- `dailyCalendar(records, archive, year, month, now = Date.now())` accepts an optional millisecond timestamp for deterministic future-day classification. Existing four-argument calls remain valid.
- `trend` returns null deltas when there is no previous window; when there are 1–4 earlier matching games, it compares against those available games and reports their actual count in `previous.n`.
- Empty difficulty buckets in `computeStats` use `avgMs: null`, matching `bestMs` and `bestScore` nullability. Unknown stats filters default to `all`.
- `trend` requires two complete five-game windows before returning a comparison (`null` with fewer than 10 matching games), matching the B2 acceptance criteria in ROADMAP §4. This supersedes the earlier partial-window behavior above.
# Contract changes (append only)

- Lead assignment (D fix round 1): `docs/BUILD-RESULTS.md`, `tests/build.pwa.test.mjs`, `tests/build.www.test.mjs` and `tests/platform.adapters.test.mjs` are explicitly assigned to stream D's write set.
- Platform adapters now resolve Capacitor plugins through `window.Capacitor.registerPlugin('Haptics'|'App'|'InAppReview')` (signatures unchanged).
# Contract changes and notes (append only)

## C1 (feat/c1-gameplay), 2026-10-28

1. **Game v2 additions (backward-compatible, no signature changes):** `Game#canUndo()`, `Game#canRedo()`, `Game#wrongEntries()`, `Game#isGiven(i)`; `pause(nowMs?)` accepts an optional clock value like `tick(nowMs)`; `hintShown(hint?)` takes the Hint object so it counts once per hint (no argument → always counts); `enterDigit`/`erase`/`toggleNote`/`revealCell`/`applyHint` return booleans (changed or not). `fromJSON` derives `id` = `legacy-<createdAt>` for v1 games without an id. When the controller loads an archive entry it forces the game id to the entry id, so migrated v1 entries (`legacy-<savedAt>`) never get duplicated.
2. **Record ids:** `createRecord` uses the game id as the record id. When a puzzle is restarted and solved again, the controller suffixes the duplicate record id with `-<completedAt>` so records stay unique (import unions records by id).
3. **`normalizeSettings` resets invalid values to the defaults.** For `app.setSetting(key, value)` the shell instead *ignores* an invalid value and keeps the current one.
4. **`?seed=&difficulty=`** resumes an unfinished random game with the same seed and difficulty instead of overwriting its archive entry (same id), so a reload never discards progress. Fresh browser contexts still get a deterministic new game.
5. **Facade actions** `newGame`, `startDaily`, `continueEntry` and `restoreRecovery` close the menu after loading (they "start" the game). `check`/`revealCell`/`fillNotes`/`clearNotes` leave the menu open. `revealCell()` reveals the selected cell, otherwise the first wrong cell, otherwise the first empty one.
6. **Pause semantics:** the clock is paused by named holds (`menu`, `hidden`, `dialog`). Hidden time never counts. Coming back after more than 10 s opens the menu, and a shorter absence resumes silently. `window` blur is ignored.
7. **Review prompt:** requested only when `isNative()` and `shouldPromptReview` allows it, 2.5 s after the win. `meta.reviewPromptedAt` is set only when the request is made, so web sessions don't use up the 120-day window.
8. **sw.js PRECACHE (D-owned file):** regenerated with D's own `node scripts/update-precache.mjs` because C1 changed the import graph (the precache test requires it). Only the generated list changed.
9. **C2 stubs** at `src/ui/menu/index.js`, `src/ui/win.js`, `src/ui/onboarding.js`, `src/ui/dom.js`, `styles/menu.css`, `styles/themes.css` (Graphite dark only) implement the UI-CONTRACT shapes minimally. Take C2's versions on merge. Note that `index.html` links both stylesheets (from UI-CONTRACT), so C2's files must keep those paths.
10. **Engine skeleton observation (for A):** the hint texts are still generic ("Naked Single shows that 3 belongs here."), and `generatePuzzleAsync` runs synchronously on the main thread, so the loading overlay only paints for daily generation (which yields first). The UI already shows a loading state around both.
