# Roadmap: store-ready Sudoku (parity+ with "Still Sudoku")

Source of truth for features: `/workspace/shared/sudoku-feature-spec.md` (called **SPEC** below).
Constraints: vanilla JS ES modules, **no build step for the web app**, relative paths only, `node --test` stays green on every merge. Capacitor (iOS + Android) wraps a copied `www/`.

## 1. Target architecture

```
index.html, styles.css            UI shell (C)
src/main.js                       bootstrap + wiring (C)
src/game.js                       Game state v2, pure, no DOM (C)
src/ui/*.js                       views: board, pad, toolbar, menu, sheets, stats, calendar, settings, a11y (C)
src/engine/*.js                   pure: rng, board utils, candidates, techniques, grader, generator, daily, hints (A)
src/domain/*.js                   pure: settings, scoring, stats, archive, storage+migration, import/export (B)
src/platform/*.js                 web/native adapters: haptics, sound, review, app-state, pwa registration (D)
manifest.webmanifest, sw.js, assets/**, privacy.html          PWA + store assets (D)
capacitor.config.json, scripts/**, store/**, STORE-PUBLISHING.md (D)
tests/engine.*.test.mjs (A)  tests/domain.*.test.mjs (B)  tests/sudoku.test.mjs, tests/game.*.test.mjs (C)
tests/e2e/**/*.spec.mjs, playwright.config.mjs, .github/workflows/** (E)
```

Rules:
- `src/engine` and `src/domain` import nothing from `src/ui`, `src/platform`, `src/game.js`, or DOM/`localStorage` globals. `src/domain/storage.js` receives the backend as an argument.
- Each layer exposes one barrel: `src/engine/index.js`, `src/domain/index.js`, `src/platform/index.js`. Consumers import **only** from the barrel.
- Legacy `src/sudoku.js` and `src/storage.js` stay until C switches over, then C deletes them (or A turns `src/sudoku.js` into a re-export shim; A owns that file).
- Puzzle data stays in the current shapes: `Board = number[81]` (0 = empty, row-major), `Notes = number[81]` bitmask (bit `1 << (d-1)` = candidate d). `index = row*9 + col`, `box = floor(row/3)*3 + floor(col/3)`.
- E2E specs use the `.spec.mjs` suffix so `node --test` never picks them up.

## 2. Contracts (code against these before the other side exists)

### 2.0 Delivery rule
A and B each land a **contract skeleton first** (all exports present, correct shapes, simple or partial logic, e.g. a hint engine that only knows singles). C then integrates for real while A and B finish the logic behind unchanged signatures. Any signature change needs a ROADMAP edit, plus a note on the C issue.

### 2.1 Engine: `src/engine/index.js` (A)

```js
/** @typedef {'easy'|'medium'|'hard'|'expert'} Difficulty */
/** @typedef {'full-house'|'naked-single'|'hidden-single'|'naked-pair'|'hidden-pair'|'pointing'|'claiming'
 *   |'naked-triple'|'hidden-triple'|'x-wing'|'swordfish'|'xy-wing'|'xyz-wing'|'skyscraper'|'incorrect-entry'} TechniqueId */
/** @typedef {{type:'row'|'col'|'box', index:number}} House */
/** @typedef {{index:number, digit:number}} CellDigit */

export const DIFFICULTIES;      // ['easy','medium','hard','expert']
export const DIFFICULTY_META;   // { easy:{label:'Easy', dots:1}, medium:{label:'Medium',dots:2}, hard:{…dots:3}, expert:{…dots:4} }
export const TECHNIQUES;        // Record<TechniqueId,{id, name:string, difficulty:Difficulty, rank:number}>
// Tiers: easy = full-house, naked-single; medium = + hidden-single;
// hard = + naked/hidden pair+triple, pointing, claiming; expert = + x-wing, swordfish, xy-wing, xyz-wing, skyscraper.

export function createRng(seed /* number|string */) /* -> () => number in [0,1) */; // string seeds hashed (xmur3), mulberry32
export function peersOf(index) /* -> readonly number[20] */;
export function houseCells(house /* House */) /* -> number[9] */;
export function findConflicts(board) /* -> Set<number> */;              // same semantics as today
export function solve(board) /* -> Board|null */;
export function countSolutions(board, limit = 2) /* -> number */;

export function computeCandidates(board) /* -> Notes */;                  // 0 for filled cells
export function autoNotes(board, notes, { mode = 'replace' } = {}) /* -> Notes */;
//   'replace' = candidates for every empty cell; 'merge' = keep user notes ∩ candidates, fill empty-note cells
export function notesCleanup(board, notes, index, digit)
  /* -> Array<{index:number, before:number, after:number}> */;            // peers losing `digit`; pure, no mutation

/** @typedef {{technique:TechniqueId, placement:CellDigit|null, eliminations:CellDigit[],
 *   cells:number[], houses:House[], candidates:CellDigit[]}} Step   // cells/candidates = the pattern */
export function findNextStep(board, candidates /* Notes|undefined → computed */) /* -> Step|null */;

/** @typedef {{difficulty:Difficulty|null, hardest:TechniqueId|null, score:number, steps:number,
 *   counts:Partial<Record<TechniqueId,number>>, solved:boolean}} Grade
 *  difficulty null => needs techniques beyond our set (never shipped to players) */
export function grade(puzzle) /* -> Grade */;

/** @typedef {{puzzle:Board, solution:Board, difficulty:Difficulty, grade:Grade, seed:string, clueCount:number,
 *   id:string}} GeneratedPuzzle   // id = `${difficulty}-${seed}` or `daily-${dateKey}` */
export function generatePuzzle(difficulty, { seed, maxAttempts } = {}) /* -> GeneratedPuzzle */;
export function generatePuzzleAsync(difficulty, opts) /* -> Promise<GeneratedPuzzle> */; // Web Worker (src/engine/worker.js), sync fallback

export const DAILY_VERSION;                                     // bump only with a migration note; changes every daily
export function dailyKey(date = new Date()) /* -> 'YYYY-MM-DD' (UTC) */;
export function dailyPuzzle(dateKey) /* -> GeneratedPuzzle */;  // always 'medium', seed `daily:${DAILY_VERSION}:${dateKey}`

/** @typedef {{kind:'highlight', text:string, cells:number[], houses:House[]}
 *   | {kind:'explain', text:string, candidates:CellDigit[], eliminations:CellDigit[]}
 *   | {kind:'fill', text:string, placement:CellDigit}} HintStep */
/** @typedef {{technique:TechniqueId, techniqueName:string, placement:CellDigit, cells:number[], houses:House[],
 *   candidates:CellDigit[], eliminations:CellDigit[], chain:Step[], steps:[HintStep,HintStep,HintStep]}} Hint */
export function getHint(board, notes, solution, { focusIndex } = {}) /* -> Hint|null */;
```
Engine semantics:
- **Determinism:** when given a seed, generation must not depend on wall-clock time or `Math.random`. Same seed → same puzzle on every device. This is required for daily puzzles.
- `generatePuzzle` returns a unique-solution puzzle with `grade.difficulty === difficulty`. Clue counts are a soft target only; grading is what decides difficulty.
- `getHint` priority: (1) if any entry ≠ solution, return an `incorrect-entry` hint for it (placement = the correct digit). (2) Otherwise find the **simplest** chain of steps ending in a placement. `chain` holds the elimination steps and then the single; `technique` is the hardest step in the chain. Prefer `focusIndex` when a hint of equal rank exists. Text is plain English with 1-based "row 3, column 5" wording, e.g. highlight "Look at row 4." / explain "5 can only go in one cell of this row." / fill "Place 5 in row 4, column 7."
- Hints use the board's own candidates, not the user's notes. User notes never make a hint wrong.

### 2.2 Domain: `src/domain/index.js` (B)

```js
// ---- settings.js
export const THEMES;            // ['graphite','ocean','lavender','sand','rose','sage']  (graphite default)
/** @typedef {{schema:2, theme:string, colorMode:'system'|'light'|'dark', highlightRelated:boolean,
 *   highlightSameDigit:boolean, showMistakes:boolean, cleanupNotes:boolean, showTimer:boolean,
 *   inputMode:'cell-first'|'number-first', colorblind:boolean, textSize:'default'|'large'|'xlarge',
 *   reducedMotion:'system'|'on'|'off', haptics:boolean, sounds:boolean, confirmNewGame:boolean,
 *   confirmRestart:boolean, lastDifficulty:Difficulty, onboardingDone:boolean}} Settings */
export const DEFAULT_SETTINGS;  // toggles on; haptics/sounds off; theme 'graphite'; colorMode 'system'; 'cell-first'
export function normalizeSettings(raw) /* -> Settings */;    // unknown/invalid fields → defaults, never throws

// ---- scoring.js
export const SCORE_BASE;        // {easy:1000, medium:2000, hard:3000, expert:4000}
export const PAR_MS;            // {easy:10m, medium:15m, hard:25m, expert:40m}
/** @typedef {{hints:number, checks:number, reveals:number, errorsShown:number, autoNotes:number}} Assist */
export function timeBonus(difficulty, elapsedMs) /* -> 0..1200 */;  // round(1200 * clamp(1 - elapsed/(2*PAR), 0, 1))
export function computeScore({ difficulty, elapsedMs, hints, mistakes }) /* -> number */;
//   max(100, SCORE_BASE + timeBonus - 100*hints - 25*mistakes)
export function isAssisted(assist /* Assist */) /* -> boolean */;   // any counter > 0

// ---- records + stats.js
/** @typedef {{id:string, puzzleId:string, difficulty:Difficulty, dailyKey:string|null, completedAt:number,
 *   elapsedMs:number, mistakes:number, assist:Assist, assisted:boolean, score:number}} GameRecord */
export function createRecord(gameJSON /* GameJSON v2, completed */) /* -> GameRecord */;
/** @typedef {'all'|'unassisted'|'assisted'} StatsFilter */
export function computeStats(records, filter = 'all')
  /* -> {byDifficulty:Record<Difficulty,{solved,avgMs,bestMs,bestScore}>, recent:GameRecord[] (≤20, newest first), total:number} */;
export function trend(records, { difficulty, assisted })
  /* -> {latest:{n,avgMs,avgScore}, previous:{n,avgMs,avgScore}, deltaMs, deltaScore}|null */; // null if <2 games
export function personalBest(records, record)
  /* -> {isBestTime, isBestScore, previousBestMs:number|null, previousBestScore:number|null} */; // same difficulty+assisted
export function dailyCalendar(records, archive, year, month /* 1-12 */)
  /* -> Array<{dateKey, status:'completed'|'in-progress'|'none'|'future'}> */;  // no streaks anywhere

// ---- archive.js  (pure; returns new objects)
/** @typedef {{id:string, kind:'random'|'daily', dailyKey:string|null, difficulty:Difficulty, createdAt:number,
 *   updatedAt:number, status:'active'|'completed', game:GameJSON, recovery:Array<{savedAt:number, game:GameJSON}>}} ArchiveEntry */
/** @typedef {{activeId:string|null, entries:Record<string,ArchiveEntry>}} Archive */
export function emptyArchive() /* -> Archive */;
export function saveActive(archive, gameJSON, now = Date.now()) /* -> Archive */; // upsert + make active; snapshot recovery copy ≤1/min, keep 3
export function startNew(archive, gameJSON, now) /* -> Archive */;   // previous active stays as unfinished entry; NEVER deleted
export function resume(archive, id) /* -> Archive */;                // set activeId
export function markCompleted(archive, id, now) /* -> Archive */;
export function listUnfinished(archive) /* -> ArchiveEntry[] newest first (includes active) */;
export function restoreRecovery(archive, id, savedAt) /* -> Archive */; // current game itself pushed to recovery first
export function removeEntry(archive, id) /* -> Archive */;            // explicit user delete only
export const ARCHIVE_LIMIT;  // 50 unfinished; beyond → oldest non-active completed pruned first, unfinished never silently

// ---- storage.js
/** @typedef {{getItem(k):string|null, setItem(k,v):void, removeItem(k):void}} Backend  // localStorage-compatible, sync */
/** @typedef {{schema:2, settings:Settings, archive:Archive, records:GameRecord[],
 *   meta:{installedAt:number, completedCount:number, reviewPromptedAt:number|null, migratedFrom:number|null}}} AppData */
export const STORAGE_KEYS;  // {settings:'sudoku:v2:settings', archive:'sudoku:v2:archive', records:'sudoku:v2:records', meta:'sudoku:v2:meta'}
export function createStore(backend) /* -> Store */;
//   Store.load(): AppData (runs migration once; corrupt keys → defaults + raw copy kept under 'sudoku:v2:corrupt:<key>:<ts>')
//   Store.saveSettings(s), Store.saveArchive(a), Store.saveRecords(r), Store.saveMeta(m): boolean (quota errors swallowed → false)
export function migrateLegacy(backend) /* -> Partial<AppData>|null */;
//   'sudoku-app:game' {version:1,savedAt,game} → archive entry (active, kind 'random'); game JSON stays as-is (Game.fromJSON upgrades it)
//   'sudoku-app:settings' {theme:'auto'|'light'|'dark'} → colorMode 'system'|'light'|'dark'
//   legacy keys are LEFT in place (rollback safety); meta.migratedFrom = 1
export function exportData(appData) /* -> string */;  // JSON {format:'sudoku-app-export', version:2, exportedAt, data}
export function importData(current, text)
  /* -> {data:AppData, added:{records:number, entries:number}, conflicts:Array<{kind:'entry'|'settings', id:string}>} */;
//   records: union by id. Entries with the same id but different content → keep both (imported copy gets new id,
//   suffix '-imported'). Settings: keep current and report a conflict. Never drops either copy. Throws ImportError on bad input.
export function shouldPromptReview(meta, records, now) /* -> boolean */; // ≥5 completions, last game unassisted or a PB, never twice in 120 days
```

### 2.3 Game state v2: `src/game.js` (C; domain treats it as opaque JSON except the listed fields)

```js
/** @typedef {{schema:2, id:string, kind:'random'|'daily', dailyKey:string|null, seed:string|null,
 *   difficulty:Difficulty, gradeHardest:TechniqueId|null, puzzle:Board, solution:Board, values:Board, notes:Notes,
 *   mistakes:number, assist:Assist, elapsedMs:number, running:boolean, completed:boolean, completedAt:number|null,
 *   history:{actions:Array<{cells:Array<{i,before:{v,n},after:{v,n}}>}>, index:number},
 *   createdAt:number, updatedAt:number}} GameJSON
 * Domain may read: id, kind, dailyKey, difficulty, values, puzzle, elapsedMs, mistakes, assist, completed,
 * completedAt, createdAt, updatedAt. */
export class Game {
  static create(generated /* GeneratedPuzzle */, { kind = 'random', dailyKey = null } = {}) /* -> Game */;
  static fromJSON(data) /* -> Game; accepts v1 (no schema): assist zeros, hints→assist.hints, drop gameOverShown */;
  enterDigit(index, digit, { cleanupNotes = true } = {});  // wrong digit → mistakes++ (always counted); NO game over
  erase(index); toggleNote(index, digit); undo(); redo();
  check()          /* -> number[] wrong indices; assist.checks++ */;
  revealCell(index)/* -> boolean; assist.reveals++ (undoable) */;
  fillNotes()      /* engine.autoNotes 'replace' as one undoable action; assist.autoNotes++ */;
  clearNotes();
  hintShown()      /* call when hint step 1 opens; assist.hints++ (once per Hint object) */;
  applyHint(hint)  /* applies hint.placement as an undoable action (no extra count) */;
  markErrorsShown(n)/* UI calls when ≥1 wrong entry is rendered with showMistakes on; assist.errorsShown += n */;
  pause(); resume(); tick(nowMs);
  restart();       /* clears entries/notes/history/time/mistakes; assist counters are KEPT (no laundering) */
  isWon(); remainingCounts() /* {1..9:n} */; progress() /* {filled, total} — "17 of 39": empty cells of puzzle */;
  toJSON() /* -> GameJSON */;
  get state();     // includes lastEvent: 'win'|'mistake'|null
}
```
Removed: `MISTAKE_LIMIT` and game over (`gameOverShown`). The `hints` field becomes `assist.hints`.

### 2.4 Platform: `src/platform/index.js` (D; every function is a safe no-op on web without support)

```js
export function haptic(kind /* 'tap'|'place'|'error'|'success' */) /* -> void */;  // Capacitor Haptics, else navigator.vibrate
export function playSound(kind /* 'tap'|'place'|'error'|'success' */) /* -> void */; // tiny WebAudio synth, no audio files required
export function requestReview() /* -> Promise<boolean> */;    // native in-app review; web: resolves false
export function onAppStateChange(cb /* (active:boolean) => void */) /* -> unsubscribe */; // Capacitor App, else visibilitychange
export function registerServiceWorker() /* -> Promise<void> */;  // no-op under Capacitor and on file://
export function isNative() /* -> boolean */;
export function share({ title, text }) /* -> Promise<boolean> */; // optional stats share
```
C gates `haptic`/`playSound` on settings. D does not read settings.

### 2.5 DOM test hooks (C provides, E consumes; treat as API)
`data-testid`: `board`, `cell` (+`data-index`, `data-given`, `data-value`, `data-wrong`), `numpad-<d>` (+`data-left`), `tool-undo|redo|erase|notes|check|hint|autonotes|restart`, `status-difficulty|mistakes|timer|progress`, `pause`, `menu`, `menu-<resume|continue|daily|new|stats|settings|howto|tools|back|return>`, `hint-panel`, `hint-next`, `hint-fill`, `hint-try`, `win-dialog`, `stats-tab-<all|unassisted|assisted>`, `daily-calendar`, `setting-<key>` (key from Settings), `theme-<name>`, `continue-entry`.
With `?test=1`, `window.__sudoku = { state():GameJSON, load(puzzle:Board, solution:Board), fillAllBut(n:number), settings():Settings }`. Without `?test=1` it is absent. `?seed=<s>&difficulty=<d>` starts a deterministic new game (for screenshots).

### 2.6 Shell requirements C must satisfy for D
`index.html` head contains `<link rel="manifest" href="./manifest.webmanifest">`, `<meta name="theme-color">` (light and dark media variants), `<link rel="apple-touch-icon" href="./assets/icons/apple-touch-icon.png">`, `viewport-fit=cover`, and `<link rel="icon" href="./assets/icons/favicon.svg">`. Layout respects `env(safe-area-inset-*)`. `main.js` calls `registerServiceWorker()` after first render.

## 3. Streams, write sets, merge order

| Stream | Agent | May write | Must not touch |
|---|---|---|---|
| A engine | Codex | `src/engine/**`, `src/sudoku.js` (shim only), `tests/engine.*.test.mjs` | everything else |
| B domain | Codex | `src/domain/**`, `tests/domain.*.test.mjs` | `src/storage.js` (C deletes it) |
| C UI integration | Claude Opus | `index.html`, `styles.css`, `src/main.js`, `src/game.js`, `src/ui/**`, `src/ui.js`, `src/storage.js` (delete), `tests/sudoku.test.mjs`, `tests/game.*.test.mjs`, `README.md`, `tools/layout-check.mjs` | engine/domain/platform internals |
| D store | Claude Sonnet | `src/platform/**`, `manifest.webmanifest`, `sw.js`, `assets/**`, `privacy.html`, `capacitor.config.json`, `ios/**`, `android/**`, `scripts/**`, `store/**`, `STORE-PUBLISHING.md`, `package.json`, `package-lock.json`, `.gitignore` | app UI files |
| E quality | Codex | `tests/e2e/**`, `playwright.config.mjs`, `.github/workflows/**`, `docs/TESTING.md`, `docs/DEPLOY.md` | app code |

- **Shared files:** D owns `package.json`. Other streams may only make small *additive* edits (one devDependency or script line) and must mention it in the PR. E needs `@playwright/test` and `@axe-core/playwright`, plus scripts `test:e2e` and `screenshots`. `docs/ROADMAP.md` belongs to the lead; contract changes go through the lead.
- **Dependencies:** A and B are independent. C needs the A and B skeletons (§2.0). D is independent, but C needs `src/platform/index.js` to exist (D lands a no-op stub first). E can start right away against §2.5 and the current app; its final assertions need C.
- **Merge order into the integration branch:** A-skeleton, B-skeleton, D-platform stub (any order) → C game v2 (C1) → A full, B full → C menu/stats/settings (C2) → D PWA/Capacitor/store → E e2e + deploy. After all of that: lead PR to `main`.
- Every PR: `node --test` green, no new runtime dependencies in the web app (Capacitor plugins are native-side only and loaded via `window.Capacitor` guards), relative paths only.

## 4. Work items (issues)

- **A1 Engine: techniques, grader, graded generator, RNG, daily.** Lands the skeleton first. Acceptance: grade() over a fixture set of known puzzles (≥5 per tier) returns the expected tier. 50 seeded puzzles per difficulty are unique and grade exactly at their tier. Same seed gives a byte-identical puzzle. `dailyPuzzle('2026-10-27')` is stable (snapshot test). Generation time on Node: easy/medium p95 < 300 ms, hard < 1 s, expert < 3 s (an embedded pre-graded expert bank seeded by RNG is acceptable). `generatePuzzleAsync` works in the browser.
- **A2 Engine: teaching hints, auto-notes, note cleanup.** Acceptance: every technique has a fixture hint test with exact cells, eliminations and placement. Hints always end in a correct placement. `incorrect-entry` takes priority. Hints have exactly 3 steps with non-empty text. Auto-notes and cleanup are pure and match brute-force candidates.
- **B1 Domain: settings, versioned storage, legacy migration, import/export.** Acceptance: v1 fixtures (`sudoku-app:game` envelope, `sudoku-app:settings`) migrate once and are idempotent. Legacy keys are kept. Corrupt JSON is preserved and never throws. An export/import round trip is lossless. Conflicting import keeps both copies. Uses an in-memory backend in tests.
- **B2 Domain: scoring, stats, archive, daily calendar, review policy.** Acceptance: score formula edge cases (minimum 100, cap 1200 bonus). Stats filters and recent-20 behave as specified. Trend compares latest 5 vs previous 5 at the same difficulty and assistance. Personal best is correct. `startNew` never removes the previous active game. Recovery copies are capped at 3. The calendar marks completed and in-progress days, with no streak fields.
- **C1 Game v2 + core gameplay UI.** Covers `game.js` per §2.3 with tests. Status bar (difficulty + dots, mistakes, timer that can be hidden, pause). Numpad shows "N left" and disables finished digits. Tools: Undo, Redo, Erase, Notes, Check, Hint, Fill notes, Restart. Cell-first and number-first input. 3-step hint panel with "I'll try it". Show-mistakes underline. Notes cleanup. Related and same-digit highlight. Progress bar. Keyboard shortcuts per SPEC. Mobile portrait and landscape layouts with no header, tools beside the pad, and the board sized to height. Blur never pauses; hidden more than 10 s → pause menu. Resume keeps undo. Generation runs in a worker with a loading state.
- **C2 Unified menu, daily, stats, settings, onboarding, a11y.** Single panel: Menu → Settings / Statistics → Back, plus "Return to puzzle". Covers Resume, Continue (archive list + recovery), Daily (calendar), New game (never discards), Statistics (3 tabs, per difficulty, recent 20, trend, PB after finish), Themes & settings (6 themes × light/dark preview tiles, all Settings toggles), How to play, Puzzle tools (check, reveal cell, fill/clear notes, restart, export/import). Pause summary line. Win dialog with score and PB. First-run onboarding. Skip link and labelled cells ("Row 1, column 3, 1, given"). Colorblind mode never relies on red alone. Large text and reduced motion. Haptics and sounds through platform. Tasteful review prompt via `shouldPromptReview`. "Just the puzzle. Always ad-free."
- **D1 PWA + platform adapters + icons.** `src/platform/*` per §2.4 (stub first). Manifest, `sw.js` (precache the shell, stale-while-revalidate for same-origin GET, versioned cache cleanup), icon set and maskable icons, splash source art, `privacy.html` (no data collection, local-only storage).
- **D2 Capacitor wrapper, build, store docs, screenshots.** `scripts/build-www.mjs` copies the static app to `www/` (gitignored). `capacitor.config.json` (appId, webDir `www`). iOS and Android projects. `@capacitor/assets` icons and splash. Haptics/App/review plugins. `scripts/screenshots.mjs` drives `?seed=` at store sizes (6.7"/6.5"/5.5" iPhone, iPad 12.9", Android phone/tablet). `store/` holds listing copy, keywords, age rating, privacy nutrition label and Play data-safety answers. `STORE-PUBLISHING.md` gives step-by-step signing and submission.
- **E1 Playwright e2e + visual screenshots.** Projects: phone portrait 390×844, phone landscape 844×390, desktop 1440×900. Flows: new game, input modes, notes and cleanup, undo/redo across reload, hint 3 steps, check and assisted flag, win via `__sudoku.fillAllBut(1)` → stats updated, the new game keeps the old one in Continue, daily calendar, theme switch, settings persistence, legacy-save migration (seeded localStorage), offline reload with the SW. Checks: no page scroll on mobile, and an axe scan with zero serious violations. Screenshots are saved as artifacts.
- **E2 Deploy + CI config.** A workflow runs `node --test` and the e2e suite on PRs, and deploys GitHub Pages from `main` (static, no build; `www/` is not deployed). `docs/DEPLOY.md`. The workflow is written, not run, until the lead approves.

## 5. Definition of done (SPEC → work item)

| SPEC section | Requirement | Item |
|---|---|---|
| Gameplay | Status bar: difficulty, mistakes, active-time timer, hideable, pause | C1 |
| Gameplay | Numpad "N left", disabled at 0 | C1 |
| Gameplay | Undo/Redo/Erase/Notes/Check/Hint/Fill notes/Restart | C1 (Game: C1, autoNotes: A2) |
| Gameplay | Cell-first + number-first input setting | C1, B1 (setting) |
| Gameplay | 3-step teaching hints + "I'll try it" | A2, C1 |
| Gameplay | Check, show mistakes as you go, no game over | C1 |
| Gameplay | Auto note cleanup, related highlight, progress "17 of 39" | A2, C1 |
| Gameplay | Technique-graded difficulty, unique solution, dots | A1, C1 |
| Gameplay | Shortcuts 1-9, arrows, Backspace/Delete, N, Ctrl/Cmd+Z, Shift+Z, H, P | C1, E1 |
| Gameplay | How to play panel | C2 |
| Menu | Unified panel, Return to puzzle, pause summary | C2 |
| Menu | Continue archive + recovery copies; new game never discards | B2, C2, E1 |
| Menu | Daily, New game, Stats, Settings, How to play, Puzzle tools | C2 |
| Mobile | No header, tools beside pad, height-sized board, landscape layout | C1, E1 |
| Mobile | Brief focus change ≠ pause; resume keeps undo | C1, D1 (`onAppStateChange`), E1 |
| Daily | UTC-midnight deterministic Medium, calendar marks, no streaks | A1, B2, C2 |
| Statistics | All/Unassisted/Assisted, per difficulty, recent 20, trend, PB | B2, C2 |
| Statistics | Scoring formula, personal only | B2 |
| Themes | 6 themes × light/dark, previews, per-device, quick dark toggle | B1, C2 |
| Themes | Toggles: highlight, show mistakes, cleanup, timer; entry mode | B1, C2 |
| Saving | Autosave, offline-first, versioned + migrated, conflict-preserving import/export | B1, C2, D1 (SW), E1 |
| Saving | Cloud sync | Deferred (post-launch; needs Sign in with Apple/Google + privacy update) |
| Accessibility | Skip link, labelled cells/buttons, roles, contrast-checked themes | C2, E1 (axe) |
| Accessibility | Sounds + haptics, colorblind, large text, reduced motion, SR pass | B1, C2, D1 |
| Store extras | Icon + splash | D1, D2 |
| Store extras | Onboarding, confirmations, rate prompt, ad-free, share stats (opt.) | C2, B2, D1 |
| Store extras | Achievements | Optional / post-launch |
| Store | Capacitor iOS+Android, privacy policy, listing, screenshots | D2 |
| Quality | e2e at 3 viewports + screenshots, CI, Pages deploy | E1, E2 |

Done means: every row above is checked off, `node --test` and e2e are green, there are no console errors, Lighthouse PWA installable and a11y ≥ 95, and the app installs and runs offline on an iOS simulator and an Android emulator.

## 6. Issues

| Item | Issue | Title | Depends on |
|---|---|---|---|
| A1 | #1 | [A] Engine: technique solver, grader, graded generator, seeded RNG, daily puzzle | — |
| A2 | #2 | [A] Engine: 3-step teaching hints, auto-notes, note cleanup | A1 skeleton |
| B1 | #3 | [B] Domain: settings schema, versioned storage, legacy migration, import/export | — |
| B2 | #4 | [B] Domain: scoring, statistics, puzzle archive, daily calendar | B1 skeleton |
| C1 | #5 | [C] Game state v2 + core gameplay UI (input modes, hints, check, mobile layouts) | A/B skeletons, D1 stub |
| C2 | #6 | [C] Unified menu, daily, statistics, themes/settings, onboarding, accessibility | C1, A2, B2 |
| D1 | #7 | [D] Platform adapters, PWA (manifest, service worker), icons, privacy page | — |
| D2 | #8 | [D] Capacitor wrapper, build-to-www, store listing docs, screenshot tooling | D1 |
| E1 | #9 | [E] Playwright e2e suite at phone portrait/landscape/desktop with screenshots | §2.5; final after C2 |
| E2 | #10 | [E] CI + GitHub Pages deployment config | E1 |
