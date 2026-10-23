# Implementation Plan: Sudoku Static Web App

## 1. File tree

```
sudoku-app/
├── index.html
├── styles.css
├── .nojekyll
├── .gitignore
├── package.json
├── README.md
├── src/
│   ├── sudoku.js        # pure core: solver, validator, generator
│   ├── game.js          # pure game state, history, mistakes, hints, win
│   ├── storage.js       # localStorage load/save/validation, settings
│   ├── ui.js            # DOM rendering, input wiring, modals
│   └── main.js          # entry point: wires Game + UI + storage
└── tests/
    └── sudoku.test.mjs
```

All paths in HTML/CSS/JS are relative (`./styles.css`, `./src/main.js`). `index.html` uses `<script type="module" src="./src/main.js"></script>`, no external resources. `.nojekyll` is empty. Optional but recommended: `.github/workflows/pages.yml` deploying the repo root via `actions/upload-pages-artifact`; alternatively README documents branch/root Pages deployment.

`package.json`:

```json
{
  "name": "sudoku-app",
  "private": true,
  "type": "module",
  "scripts": { "test": "node --test" }
}
```

`.gitignore`: `node_modules/`, `.DS_Store`, `*.log`.

## 2. Core data model

- Board: `number[81]`, index = `row * 9 + col`, values `0..9`, `0` = empty.
- Notes: `number[81]` bitmasks, bit `d-1` means candidate `d` (0 = none, 511 = all).
- Peers: precomputed `number[81][]`, 20 peers per cell (row + column + box, deduplicated).
- Difficulty config:

```js
export const DIFFICULTIES = {
  easy:   { min: 38, max: 42, target: 40 },
  medium: { min: 32, max: 35, target: 34 },
  hard:   { min: 28, max: 31, target: 30 },
  expert: { min: 24, max: 27, target: 26 }
};
```

## 3. `src/sudoku.js` — pure core (no DOM, no storage)

Public API:

```js
export const DIFFICULTIES;
export function hashCode(...)                       // not needed; omit
export function createRng(seed)                     // mulberry32 -> () => float
export function getPeers(index)                     // number[20]
export function isPlacementValid(board, index, digit) // ignores board[index]
export function findConflicts(board)                // Set<number> of conflicting indices
export function isBoardComplete(board)              // every cell 1..9 (not necessarily legal)
export function solve(board)                        // number[81] | null
export function countSolutions(board, limit = 2)    // number, stops at limit
export function generateSolvedBoard(rng = Math.random)
export function generatePuzzle(difficulty = "easy", opts = {})
// opts: { seed, rng, timeBudgetMs = 750, maxAttempts = 4 }
// returns { puzzle, solution, difficulty, clueCount, attempts, elapsedMs, bestEffort }
```

**Solver (fast, bitmask + MRV).** Maintain `rowMask[9]`, `colMask[9]`, `boxMask[9]` where bit `d` is used. Validate input first (digits 0–9, no duplicate givens; return 0/null if invalid). For `countSolutions`, recurse: choose the empty cell with the fewest candidates (MRV; tie-break lowest index); if none, increment count and stop as soon as `count >= limit`; otherwise try candidates in a randomized or ascending order. Undo masks on backtrack. This solves an empty board to count 2 almost instantly and keeps uniqueness checks well under a millisecond for nearly complete boards.

`solve` shares the search but returns the first completed board. `findConflicts` scans each row/col/box counting digits and adds every cell whose digit appears more than once; this is used for red conflict styling and test validation.

**Generator (unique by construction).**

1. `generateSolvedBoard`: fill an empty board with randomized backtracking using MRV + shuffled candidate order.
2. `puzzle = solution.slice()`.
3. `order = shuffle(0..80, rng)`.
4. For each index in order: if `clueCount <= target`, stop. Temporarily set `puzzle[i] = 0`; if `countSolutions(puzzle, 2) === 1`, keep it (decrement clue count); else restore the clue.
5. A single pass usually reaches the target. If not within `timeBudgetMs` or `maxAttempts`, retry from a new solved board/removal order. If still above the target but unique, return the best unique puzzle with `bestEffort: true` rather than violating uniqueness. Clue ranges are intentionally broad enough that seeded tests reliably pass; tests assert `clueCount` within `[min,max]` for each difficulty across multiple seeds.
6. Never sacrifice uniqueness: a removal is accepted only after a uniqueness check. Return the full data needed by the game; no shared mutable module state.

Performance target: full generation typically 20–200 ms; hard cap via `timeBudgetMs` and removal-count check, so expert stays well under 1 s. Tests use fixed seeds for determinism, while the browser passes `rng = Math.random` (or a seed from `crypto.getRandomValues`).

## 4. `src/game.js` — game state and history (pure, DOM-free)

Use a `Game` class. It is instantiable/testable in Node, but may use no browser APIs.

```js
export const MISTAKE_LIMIT = 3;
export class Game {
  static create(difficulty, opts)                 // -> Game
  static fromJSON(data)                           // validated restore; throws on invalid
  constructor(state)
  get state()
  enterDigit(index, digit)                        // number
  erase(index)
  toggleNote(index, digit)
  undo(); redo()
  hint(index = null)                              // fills selected or random empty
  pauseToggle()
  tick(nowMs)                                     // advances elapsed time
  isWon()                                         // boolean
  remainingCounts()                               // {1: n, ..., 9: n}
  toJSON()
}
```

State shape (the canonical persisted game):

```js
{
  difficulty: "easy" | "medium" | "hard" | "expert",
  puzzle: number[81],        // original givens (0 = blank)
  solution: number[81],
  values: number[81],        // givens + user entries; 0 = empty
  notes: number[81],         // bitmasks
  mistakes: 0,
  hints: 0,
  elapsedMs: 0,
  running: true,             // timer running, false when paused/completed
  completed: false,
  gameOverShown: false,      // mistakes modal already shown
  history: { actions: Action[], index: 0 },
  createdAt: epochMs
}
```

`isGiven(i) => puzzle[i] !== 0`. `enterDigit` on a given is a no-op. If the cell already has the same value, no-op; otherwise it pushes an action. Value entry clears that cell's notes and removes the digit from notes of all peers. Each action is a group of cell transitions, so undo/redo restores values and notes atomically:

```js
Action = {
  cells: [{ i, before: { v: number, n: number }, after: { v: number, n: number } }]
}
```

`undo()` restores `before` for each cell; `redo()` restores `after`; new actions after undo truncate `history.actions` after `index`. Cap actions at 300 (drop oldest and decrement index). Notes and erases use the same mechanism. `enterDigit` compares to `solution[index]`: a mismatch increments `mistakes` and can set `gameOverShown`. When `mistakes` reaches 3 and `gameOverShown` is false, set it true and signal the UI (`state.lastEvent = "gameover"` or return value) so `main.js` opens the game-over modal.

**Documented mistake behavior (fixed decision):** at 3 mistakes the app shows a blocking "Game over" modal with two choices: **New game** (default focus) and **Keep playing**. "Keep playing" dismisses the overlay permanently for that game; further mistakes continue incrementing the display (e.g. `Mistakes: 4/3`) but do not re-open the modal. Winning is still allowed, and the win modal reports the total mistakes. This is documented in README and the modal copy.

**Win detection:** `values` has no zeros, equals `solution` cell-by-cell, and `findConflicts(values)` is empty. On first win: set `completed = true`, `running = false`, persist, show win modal. `remainingCounts` computes `9 - count of digit in values`.

**Hints:** target = selected index if empty/non-given, else the first empty cell in index order (or random empty). Set correct value via the same action pipeline (record hint action for undo), clear peers' notes, increment `hints`, check win.

**Timer:** `elapsedMs` accumulates only while `running`. `main.js` calls `game.tick(performance.now())` every 250 ms; `Game` stores `lastTick` internally (not serialized) and adds elapsed deltas. `pauseToggle` toggles `running` and resets `lastTick` to `null`. On `visibilitychange` to hidden, call `pause()` (idempotent) and save. Do not auto-resume on visibility return; the UI shows "Paused" and the user presses Resume. On restore, `running` stays as saved and time spent closed is not counted; health-test state with corrupt timer values falls back to 0.

## 5. `src/storage.js`

```js
export const GAME_KEY = "sudoku-app:game";
export const SETTINGS_KEY = "sudoku-app:settings";
export const SCHEMA_VERSION = 1;

export function saveGame(gameJSON)         // wraps in envelope, try/catch quota
export function loadGame()                 // Game|NULL, validates & version-checks
export function clearGame()
export function saveSettings({ theme })    // theme: "auto"|"light"|"dark"
export function loadSettings()             // {theme:"auto"} on error
```

Persisted envelope:

```js
{
  version: 1,
  savedAt: 1720000000000,
  game: { /* Game.toJSON(), no lastTick */ }
}
```

Validation must be defensive: `JSON.parse` in `try/catch`; require integer `version === 1`; arrays of length 81; digits in range; `puzzle`, `values`, `notes` consistency (givens preserved in `values`); `solution` valid and matching all givens; difficulty in `DIFFICULTIES`; bounded numeric fields; history shape/indices valid. Any failure returns `null` and removes the corrupt key. Storage access is wrapped (Safari private mode/quota). Save on every mutation (debounced via `queueMicrotask` or direct write — data is small, direct is fine) and every 5 s while the timer runs; also on `pagehide`/`visibilitychange`. Never persist `lastTick` or UI selection.

## 6. `src/ui.js` + `main.js` — layout, input, accessibility

`ui.js` exports `createUI({ root, dispatch })` returning:

```js
{ render(state, view), showModal(kind, data), closeModal(), focusCell(index) }
```

`view` holds transient UI-only data: `selectedIndex`, `noteMode`, `conflicts: Set`, `paused`. `main.js` owns `Game`, `selectedIndex`, `noteMode`, loads storage/settings, defines intent handlers (select, digit, erase, toggleNote, undo, redo, hint, newGame, difficulty, pause, theme), then calls `ui.render`.

**Page layout** (`index.html`): header with title "Sudoku", difficulty `<select>`, New Game button, timer + pause button, theme toggle. Main area: CSS grid two columns — board card (left) and controls sidebar (right): status line (`Mistakes: n/3`, `Hints: n`), 3×3 number pad with remaining-count badges, action row (Notes, Erase, Undo, Redo, Hint), and a small shortcut legend. Modals (game over, win) use a `<dialog>`-like overlay div with `role="dialog" aria-modal="true"`, focus moved to the primary button and trapped; Escape closes only non-blocking dialogs. Win modal shows time, difficulty, mistakes, hints, and "New game". A `role="status" aria-live="polite"` region announces win, game over, and hint insertion.

**Board rendering:** a `role="grid"` element with 9 rows (`role="row"`) or a flat grid with `aria-rowindex`/`aria-colindex`; each cell is a focusable `button` (roving tabindex, exactly one at `tabindex="0"`) with `aria-label` such as `"Row 3, column 5, given 7"`, `"Row 3, column 5, empty"`, or `"Row 3, column 5, 7, 2 notes"`. Classes drive styling: `.given`, `.user`, `.selected`, `.peer` (row/col/box highlight), `.same` (same digit as selected), `.conflict` (red), `.note-mode`. Notes render a 3×3 mini-grid of digits. Thick 3×3 box borders via `nth-child` classes (`.br`, `.bb`) with 2px outer frame; no images.

**CSS design:** CSS custom properties for light/dark. Default follows `prefers-color-scheme: dark`; `html[data-theme="light"|"dark"]` overrides; `auto` sets `data-theme` to the system choice and updates on `matchMedia` change. Manual toggle cycles auto → light → dark, persisted in settings. System font stack, board `width: min(92vw, 540px)`, `aspect-ratio: 1`, cells sized by grid fractions, font `clamp()`. Buttons ≥ 44px touch targets; `:focus-visible` uses a clear 3px accent outline; sufficient contrast in both themes. Responsive breakpoint ~760px stacks the sidebar below the board; number pad always visible on mobile. Disable text selection/tap highlight on the board; `touch-action: manipulation`; pointerdown selection works for mouse and touch.

**Keyboard map** (global listener, ignored when focus is in a select/text field or a blocking modal):
- `1–9`: enter digit (or toggle note when note mode)
- `Backspace` / `Delete` / `0`: erase selected non-given
- Arrow keys: move selection (clamped, wraps optional — choose clamp, don't wrap)
- `N`: toggle notes mode
- `Ctrl/Cmd+Z`: undo; `Ctrl/Cmd+Shift+Z` or `Ctrl+Y`: redo
- `H`: hint; `P` or `Space`: pause/resume; `E`: erase; `M`: toggle theme (documented extra)
- `Escape`: dismiss win modal only
Call `preventDefault()` for arrows/space when acting on the board.

**Number pad:** 1–9 buttons show the digit and remaining count; at 0 remaining the button is `disabled` with `aria-label="5, 0 remaining"`. Selecting a cell with a given still highlights peers/same-digit but rejects edits.

## 7. `tests/sudoku.test.mjs`

Use `node:test` + `node:assert/strict`; import from `../src/sudoku.js` and `../src/game.js`.

1. `solve` solves a known puzzle; returns `null` for unsolvable input.
2. `countSolutions` returns 0 for contradictory boards, 1 for a valid puzzle, and caps at 2 for the empty board (guard time).
3. `findConflicts` flags duplicates and ignores legal boards.
4. For each difficulty and seeds `[1,2,3]`: generated `puzzle` has givens equal to `solution` at those positions; `solution` is a valid complete board; `countSolutions(puzzle, 2) === 1`; `clueCount` equals its own count and lies in `[min,max]`; generation completes under a generous 2 s test bound.
5. `DIFFICULTIES` ranges are nested/ordered correctly.
6. Game tests: mistake increments on wrong digit and not on correct; `MISTAKE_LIMIT` behavior flag set once; placing a digit clears the digit from peer notes and own notes; undo/redo round-trips values+notes and truncates redo after a new action; hint fills an empty cell with the solution and increments hints; win detection true only when solved.

## 8. Ordered implementation checklist

1. **Scaffold**: create `index.html` skeleton, `styles.css` reset/variables, `package.json`, `.gitignore`, `.nojekyll`. *Done when `python3 -m http.server` serves the page under any subpath and `npm test` runs (zero tests) without deps.*
2. **Core solver**: implement bitmask helpers, `getPeers`, `findConflicts`, `solve`, `countSolutions`. *Acceptance: solver unit tests pass; empty-board `countSolutions(...,2)` returns 2 quickly.*
3. **Generator + tests**: seeded RNG, solved board generation, clue removal with uniqueness checks, difficulty ranges/fallbacks. *Acceptance: all difficulty/seed tests pass with unique solutions and in-range clues; `performance.now()` timing shows expert generally < 1 s.*
4. **Game state/history**: `Game` create/fromJSON, enter/erase/notes/undo/redo, mistakes, hints, win, remaining counts. *Acceptance: game unit tests pass; actions are atomic and bounded.*
5. **Timer/pause**: elapsed accumulation, pause toggle, visibility pause, persistence fields. *Acceptance: manual test shows no time accrual while paused/hidden; win freezes timer.*
6. **UI static layout**: header, board DOM, sidebar, dialogs, responsive CSS, light/dark theming. *Acceptance: board has visible 3×3 borders, givens vs entries distinct, layout stacks at narrow widths, no horizontal scroll at 360 px.*
7. **UI interaction**: selection, keyboard map, keypad/remaining counts, notes mode, erase, undo/redo, hint, conflict + highlight rendering, aria-labels/live region. *Acceptance: every shortcut works, tab/arrow focus is coherent, number pad disables at 0 remaining.*
8. **Storage integration**: save on every change, restore on load, corrupt-storage fallback, settings persistence. *Acceptance: reload mid-game restores exact board/notes/history/mistakes/hints/timer; manually corrupted JSON yields a fresh valid game and no uncaught errors.*
9. **Game-over and win flows**: blocking modal at 3 mistakes with documented "New game / Keep playing", win modal with summary, new-game difficulty selector. *Acceptance: both modals keyboard-accessible; "Keep playing" allows future input and does not re-trigger; win only shows on a fully correct grid.*
10. **Polish and docs**: README (features, run with `python3 -m http.server 8000`, testing via `node --test`, Pages deployment, mistake policy), final pass on focus styles, touch behavior, relative paths, and `node --test` green. *Acceptance: site functions when served from a nested path (e.g. open `http://localhost:8000/` with files copied into a `/sudoku-app/` folder), no console errors, no absolute or remote URLs.*
