## Implementation Plan: No-Scroll Sudoku UI Refactor

### 1. New `index.html` structure

Replace the current header/sidebar/footer layout with a three-region app shell. Keep the skip link, win/game-over modal, and `#sr-status`.

```html
<body>
  <a class="skip-link" href="#board">Skip to board</a>

  <div class="app" id="app">
    <header class="topbar">
      <div class="brand">
        <span class="brand-mark" aria-hidden="true"><!-- existing SVG --></span>
        <h1 class="app-title">Sudoku</h1>
      </div>

      <div class="topbar-status" aria-label="Game statistics">
        <span class="timer" id="timer" role="timer" aria-label="Elapsed time">00:00</span>
        <span class="stat" id="mistakes">0/3</span>
        <span class="stat" id="hints">0</span>
      </div>

      <button class="icon-btn" id="pause" type="button"
              aria-label="Pause" aria-pressed="false"
              aria-controls="pause-menu" aria-expanded="false">
        <!-- inline pause SVG -->
      </button>
    </header>

    <main class="game">
      <section class="board-area" aria-label="Puzzle">
        <div class="board-wrap">
          <div class="board" id="board" role="grid" aria-label="Sudoku board"></div>
          <div class="board-pause-overlay" id="pause-overlay" hidden>
            <span class="pause-label">Paused</span>
          </div>
        </div>
      </section>

      <aside class="controls" aria-label="Game controls">
        <div class="stats stats--side" aria-label="Game statistics">
          <span class="stat" id="mistakes-side">0/3</span>
          <span class="stat" id="hints-side">0</span>
        </div>

        <div class="tools" role="group" aria-label="Tools">
          <button class="tool-btn" id="undo" type="button">
            <svg aria-hidden="true"><!-- undo --></svg><span>Undo</span>
          </button>
          <button class="tool-btn" id="erase" type="button">
            <svg aria-hidden="true"><!-- erase --></svg><span>Erase</span>
          </button>
          <button class="tool-btn" id="notes" type="button" aria-pressed="false">
            <svg aria-hidden="true"><!-- pencil --></svg><span>Notes</span>
          </button>
          <button class="tool-btn" id="hint" type="button">
            <svg aria-hidden="true"><!-- bulb --></svg><span>Hint</span>
          </button>
          <button class="tool-btn" id="redo" type="button">
            <svg aria-hidden="true"><!-- redo --></svg><span>Redo</span>
          </button>
        </div>

        <h2 class="sr-only" id="number-pad-title">Numbers</h2>
        <div class="numpad" id="number-pad" role="group"
             aria-labelledby="number-pad-title"></div>
      </aside>
    </main>

    <div class="pause-menu-overlay" id="pause-menu" role="dialog"
         aria-modal="true" aria-labelledby="pause-title" hidden>
      <div class="pause-sheet">
        <div class="pause-head">
          <h2 id="pause-title">Paused</h2>
          <button class="icon-btn" id="pause-close" type="button"
                  aria-label="Resume">×</button>
        </div>

        <button class="btn btn-primary" id="resume" type="button">Resume</button>

        <section class="menu-section">
          <h3>New game</h3>
          <div class="segmented" id="difficulty-picker" role="group"
               aria-label="Difficulty">
            <button type="button" data-difficulty="easy" aria-pressed="true">Easy</button>
            <button type="button" data-difficulty="medium" aria-pressed="false">Medium</button>
            <button type="button" data-difficulty="hard" aria-pressed="false">Hard</button>
            <button type="button" data-difficulty="expert" aria-pressed="false">Expert</button>
          </div>
          <button class="btn" id="new-game" type="button">Start new game</button>
        </section>

        <section class="menu-section">
          <h3>Theme</h3>
          <div class="segmented" id="theme-picker" role="group" aria-label="Theme">
            <button type="button" data-theme="auto" aria-pressed="true">Auto</button>
            <button type="button" data-theme="light" aria-pressed="false">Light</button>
            <button type="button" data-theme="dark" aria-pressed="false">Dark</button>
          </div>
        </section>

        <section class="menu-section">
          <button class="btn" id="restart" type="button">Restart puzzle</button>
        </section>

        <div class="confirm-row" id="pause-confirm" hidden>
          <p id="pause-confirm-text"></p>
          <div class="confirm-actions">
            <button class="btn" id="confirm-cancel" type="button">Cancel</button>
            <button class="btn btn-primary" id="confirm-ok" type="button">Confirm</button>
          </div>
        </div>

        <details class="shortcuts">
          <summary>Keyboard shortcuts</summary>
          <dl class="legend"><!-- existing shortcut rows --></dl>
        </details>
      </div>
    </div>

    <div class="modal-overlay" id="modal-overlay" role="dialog"
         aria-modal="true" aria-labelledby="modal-title"
         aria-describedby="modal-body" hidden>
      <!-- existing win/game-over modal markup -->
    </div>

    <p class="sr-only" id="sr-status" role="status" aria-live="polite"
       aria-atomic="true"></p>
  </div>

  <script type="module" src="./src/main.js"></script>
</body>
```

Remove the old difficulty select, New Game button, theme button, board caption, sidebar headings, shortcut legend, and footer from the main layout. Update the viewport meta to:

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
```

### 2. CSS layout strategy and exact board sizing

Keep all existing color variables and theme blocks. Replace the old `.app`, `.app-header`, `.game-layout`, `.sidebar`, and mobile media queries.

**Global no-scroll shell**

```css
html, body {
  height: 100%;
  overflow: hidden;
  overscroll-behavior: none;
}

body {
  min-height: 100vh;
  min-height: 100dvh;
  touch-action: manipulation;
  -webkit-text-size-adjust: 100%;
}

.app {
  height: 100vh;
  height: 100dvh;
  max-width: 1280px;
  margin: 0 auto;
  padding:
    env(safe-area-inset-top)
    env(safe-area-inset-right)
    env(safe-area-inset-bottom)
    env(safe-area-inset-left);
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 8px;
  overflow: hidden;
}
```

Use `box-sizing: border-box` globally as already defined. Add `user-select: none` and `-webkit-user-select: none` to `.topbar`, `.controls`, `.board`, and `.pause-sheet` controls.

**Header**

```css
.topbar {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 44px;
  min-height: 44px;
  padding-inline: 4px;
  border-bottom: 1px solid var(--border);
}
```

On phones this is 44px, under the ~48px target. `.brand-mark` shrinks to 24px; `.app-title` becomes `1rem` or is visually hidden below 360px. `.topbar-status` uses `display: flex; gap: 8px; margin-left: auto; font-variant-numeric: tabular-nums;`. `.stat` is compact text such as `0/3` and `0` with `aria-label` supplied by JS. `.icon-btn` is `44x44px`, transparent, with a 20px SVG.

**Portrait game grid**

```css
.game {
  min-height: 0;
  min-width: 0;
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
  gap: 8px;
}

.board-area {
  min-height: 0;
  min-width: 0;
  display: grid;
  place-items: center;
  overflow: hidden;
  container-type: size;
}

.board-wrap {
  position: relative;
  width: min(100cqw, 100cqh, 720px);
  max-width: 100%;
  aspect-ratio: 1 / 1;
}

.board {
  width: 100%;
  height: 100%;
  aspect-ratio: 1 / 1;
}
```

This is the primary sizing mechanism: the board area is a definite-size grid cell, `container-type: size` makes `cqw`/`cqh` available, and `min(100cqw, 100cqh, 720px)` guarantees a square that fits both dimensions. The `720px` cap keeps desktop boards sensible.

Add a CSS fallback for browsers without container query units:

```css
@supports not (width: 1cqw) {
  .board-wrap {
    width: min(
      100%,
      calc(
        100dvh - 44px - 116px - 16px -
        env(safe-area-inset-top) - env(safe-area-inset-bottom)
      )
    );
  }
}
```

Optionally add a JS fallback in `ui.js`: if `!CSS.supports("width", "1cqw")`, use a `ResizeObserver` on `.board-area` to set `--board-size: ${Math.min(width, height)}px` and have `.board-wrap { width: var(--board-size); }`. CSS remains the primary path.

**Bottom controls**

```css
.controls {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 0;
}

.tools {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 4px;
}

.tool-btn {
  min-height: 44px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 2px;
  font-size: 0.62rem;
}

.tool-btn svg {
  width: 20px;
  height: 20px;
}

.numpad {
  display: grid;
  grid-template-columns: repeat(9, minmax(0, 1fr));
  gap: 4px;
}

.pad-btn {
  min-height: 48px;
  padding: 2px;
}
```

The number pad is a single row on phones. Each key keeps the existing `.pad-digit` and `.pad-count` spans; the count is positioned at the bottom center with a small font. `aria-pressed="true"` on Notes uses the existing accent treatment. Disabled keys retain the existing opacity treatment.

**Wide / landscape layout**

Use a wide-aspect breakpoint:

```css
@media (min-width: 640px) and (min-aspect-ratio: 1 / 1) {
  .game {
    grid-template-columns: minmax(0, 1fr) minmax(280px, 360px);
    grid-template-rows: minmax(0, 1fr);
    align-items: stretch;
  }

  .controls {
    justify-content: center;
    max-width: 360px;
    width: 100%;
    justify-self: end;
  }

  .numpad {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .pad-btn {
    min-height: 56px;
  }

  .topbar .topbar-status {
    display: none;
  }

  .stats--side {
    display: flex;
  }
}
```

On portrait, `.stats--side { display: none; }`. On wide, the side panel shows stats, tools, and a 3x3 numpad; the board remains left and square via the same `min(100cqw, 100cqh, 720px)` rule. The header spans the full width and contains brand, timer, and pause. This satisfies the “header-stats + tools + 3x3 numpad right” requirement by moving the stats into the side panel on wide screens.

**Pause menu**

```css
.pause-menu-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: grid;
  place-items: center;
  padding: 16px;
  background: var(--overlay);
  backdrop-filter: blur(3px);
}

.pause-menu-overlay[hidden] {
  display: none;
}

.pause-sheet {
  width: min(100%, 420px);
  max-height: calc(
    100dvh - 32px - env(safe-area-inset-top) - env(safe-area-inset-bottom)
  );
  overflow: auto;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--surface);
  box-shadow: var(--shadow);
}
```

On narrow portrait, make it a bottom sheet:

```css
@media (max-width: 639px) {
  .pause-menu-overlay {
    align-items: end;
    padding: 0;
  }

  .pause-sheet {
    width: 100%;
    max-height: calc(100dvh - env(safe-area-inset-top));
    border-radius: 16px 16px 0 0;
    padding-bottom: calc(16px + env(safe-area-inset-bottom));
  }
}
```

`.segmented` is a grid with equal columns and 4px gaps; buttons are at least 44px tall. `.segmented button[aria-pressed="true"]` uses `var(--accent)` and `var(--on-accent)`. `.confirm-row` is a bordered inset panel with Cancel/Confirm buttons. `.shortcuts` uses the existing `kbd` styling.

Set `.modal-overlay` to `z-index: 300` so win/game-over dialogs sit above the pause menu. Keep the existing `.board.is-paused` blur/hide rules; the pause menu overlay covers the board while open.

### 3. `src/ui.js` changes

**Element lookup**

Replace old lookups with:

- `#timer`, `#mistakes`, `#hints`, `#mistakes-side`, `#hints-side`
- `#pause`, `#pause-menu`, `#pause-close`, `#resume`
- `#difficulty-picker`, `#theme-picker`, `#new-game`, `#restart`
- `#pause-confirm`, `#pause-confirm-text`, `#confirm-cancel`, `#confirm-ok`
- existing `#board`, `#pause-overlay`, `#number-pad`, `#notes`, `#erase`, `#undo`, `#redo`, `#hint`, modal elements, `#sr-status`

Remove `#theme-toggle`, `#difficulty`, and the old header `#new-game` assumptions.

**Pause menu API**

Expose:

```js
openPauseMenu({ difficulty, theme, hasProgress })
closePauseMenu({ restoreFocus = true })
isPauseMenuOpen()
setDifficulty(difficulty)
```

`openPauseMenu`:

- Unhide `#pause-menu`.
- Set `#pause` `aria-expanded="true"`.
- Sync difficulty and theme segmented `aria-pressed` states.
- Reset the confirm row and store `hasProgress`.
- Focus `#resume` with `preventScroll: true`.

`closePauseMenu`:

- Hide `#pause-menu`.
- Set `#pause` `aria-expanded="false"`.
- Reset confirm state.
- If `restoreFocus`, focus the selected board cell via `focusCell(selectedIndex)`; fall back to the first cell.

**Event wiring**

- `#pause` click → `dispatch({ type: "pause" })`.
- `#resume`, `#pause-close` click → `dispatch({ type: "resume" })`.
- Backdrop click on `#pause-menu` → `dispatch({ type: "resume" })`.
- Difficulty segmented buttons → `dispatch({ type: "difficulty", difficulty })`.
- Theme segmented buttons → `dispatch({ type: "theme", theme })` with an exact theme value.
- `#new-game` click:
  - If `hasProgress`, show the inline confirm row with “Start a new game? Current progress will be lost.” and set pending action `new-game`.
  - Otherwise dispatch `{ type: "new-game", force: true }`.
- `#restart` click:
  - If `hasProgress`, show confirm with “Restart this puzzle? Values, notes, history, mistakes, hints, and timer will reset.”
  - Otherwise dispatch `{ type: "restart", force: true }`.
- `#confirm-ok` dispatches the pending action with `force: true`.
- `#confirm-cancel` hides the confirm row and returns focus to the originating button.

**Focus trap and keyboard**

Replace the current modal-only keydown handler with a shared trap:

- If `#pause-menu` is open, trap Tab within `.pause-sheet`.
- If `#modal-overlay` is open, trap Tab within `.modal`.
- Escape behavior:
  - Pause menu open → `dispatch({ type: "resume" })`.
  - Win modal open → close modal.
  - Game-over modal open → ignore.
- Do not handle game shortcuts here; `main.js` owns them.

**Render updates**

- Update both header and side stats: `Mistakes: n/3` in header can be compact `n/3`; side can use the same compact form. Set `aria-label` on each.
- Update timer as before.
- Update `#pause` `aria-label` to “Pause” when running, “Resume” when paused, and disable when completed.
- Update Notes `aria-pressed`, disabled states for erase/undo/redo/hint, and numpad counts/disabled states as before.
- Update theme segmented pressed states from `view.theme`.
- Update difficulty segmented pressed states from `selectedDifficulty`.
- Keep `.board.is-paused` and `#pause-overlay` behavior. When the pause menu is open, the board is paused and blurred; the menu sits above it.
- Remove theme-toggle text updates.

### 4. `src/main.js` changes

**Pause state machine**

Add:

```js
let pauseMenuOpen = false;
```

`openPauseMenu()`:

- Return if `game.state.completed` or `ui.isModalOpen()`.
- If `game.state.running`, call `game.pause()`.
- `save(); render();`
- Set `pauseMenuOpen = true`.
- Call `ui.openPauseMenu({ difficulty: selectedDifficulty, theme, hasProgress: hasProgress() })`.
- Announce “Game paused.”

`closePauseMenu({ resume = true } = {})`:

- Return if not open.
- Set `pauseMenuOpen = false`.
- Call `ui.closePauseMenu()`.
- If `resume && !game.state.completed`, call `game.resume()`.
- `save(); render();`
- Announce “Timer resumed.”

`dispatch` cases:

- `pause`: if completed return; if `pauseMenuOpen` close it, else open it.
- `resume`: `closePauseMenu({ resume: true })`.
- `new-game`: `startNewGame(Boolean(intent.force))`.
- `restart`: if `intent.force` or no progress, call `game.restart()`, reset `selectedIndex = firstEmptyIndex(game.state)`, `noteMode = false`, close pause menu without resuming, save, render, focus board, announce “Puzzle restarted.”
- `difficulty`: update `selectedDifficulty`, call `ui.setDifficulty`, render, announce.
- `theme`: accept `intent.theme` if valid, otherwise cycle with `nextTheme`; persist, apply, render, announce.
- `close-modal`: unchanged.

`startNewGame(force)`:

- Keep the existing progress confirmation for non-menu callers.
- Before creating the new game, set `pauseMenuOpen = false`, call `ui.closePauseMenu({ restoreFocus: false })`, and `ui.closeModal()`.
- Create the game, reset selection/notes, save, render, focus board, announce.

`handleEvent()`:

- Before showing win/game-over modals, close the pause menu without resuming.
- Keep existing modal content and announcements.

**Keyboard**

`handleKeydown`:

- If `ui.isModalOpen()` return; UI handles modal Escape/Tab.
- If `pauseMenuOpen`:
  - Escape → `dispatch({ type: "resume" })`.
  - `p` → `dispatch({ type: "resume" })`.
  - Space → if the target is a button, allow default activation; otherwise resume.
  - Return for all other keys.
- If no modal and no pause menu:
  - Escape → `dispatch({ type: "pause" })` (opens menu).
  - P/Space → `dispatch({ type: "pause" })`.
  - Keep all existing digit, erase, arrow, notes, undo/redo, hint, and theme shortcuts.
  - Keep the existing Space-on-button guard.

**Reload behavior**

Change `initialGame()`:

```js
function initialGame() {
  const restored = loadGame();
  if (restored) {
    if (!restored.state.completed) restored.resume();
    return restored;
  }
  const fresh = Game.create("easy");
  saveGame(fresh.toJSON());
  return fresh;
}
```

After initialization, save once so the restored running state is persisted. This makes a reloaded saved game run immediately instead of landing paused.

**Visibility behavior**

```js
function handleVisibilityChange() {
  if (document.hidden) {
    if (game.state.running) {
      game.pause();
      save();
      render();
      ui.announce("Game paused automatically while the tab was hidden.");
    }
    return;
  }

  if (
    !game.state.running &&
    !game.state.completed &&
    !ui.isModalOpen() &&
    !pauseMenuOpen
  ) {
    openPauseMenu();
  }
}
```

This keeps auto-pause on hide and shows the pause menu on return. The game remains paused until Resume. If the menu was already open, it stays open. Win/game-over modals take precedence.

### 5. `src/game.js` addition

Add a `restart()` method to `Game`:

```js
restart() {
  const state = this._state;
  state.values = state.puzzle.slice();
  state.notes = new Array(CELLS).fill(0);
  state.mistakes = 0;
  state.hints = 0;
  state.elapsedMs = 0;
  state.running = true;
  state.completed = false;
  state.gameOverShown = false;
  state.history = { actions: [], index: 0 };
  state.lastEvent = null;
  this._lastTick = null;
  return this;
}
```

Keep `puzzle`, `solution`, `difficulty`, and `createdAt` unchanged. Add a test in `tests/sudoku.test.mjs` that creates a game, enters a digit, toggles a note, uses a hint, ticks the timer, pauses, calls `restart()`, and asserts values equal the original puzzle, notes are zero, mistakes/hints/elapsed are zero, history is empty, `running` is true, `completed` is false, and puzzle/solution/difficulty are unchanged.

### 6. README updates

Update the Features section to mention:

- Slim header with timer, mistakes, hints, and pause.
- Pause menu with Resume, New Game + difficulty, Theme, Restart, and shortcut help.
- No-scroll responsive layout with a square board and bottom controls.
- Restored games resume running; hidden tabs auto-pause and show the pause menu on return.

Update the shortcuts table:

- `P` / `Space` / `Escape` opens the pause menu when no other dialog is open.
- `Escape` or Resume closes the pause menu.
- `M` cycles theme; the pause menu also has Auto/Light/Dark.
- Keep all existing digit, erase, arrow, notes, undo/redo, and hint shortcuts.
- Note that the on-screen shortcut legend now lives in the pause menu.

### 7. Verification checklist

1. Run `node --test`; all existing tests plus the new restart test pass.
2. Serve locally with `python3 -m http.server 8000` and open in Safari/Chrome.
3. At 375×667, 390×844, 393×852, and 430×932:
   - No vertical or horizontal page scroll.
   - Header is ≤ ~48px tall.
   - Board is square and fills the available space.
   - Tools row and single-row 1–9 numpad are fully visible.
   - Every tool and number key is at least 44px tall.
4. At 844×390 and 667×375 landscape:
   - Board is left, controls are right.
   - Numpad is 3×3.
   - No scroll; board remains square.
5. At 1280×800 and 1440×900:
   - Board is centered/left with a sensible max width.
   - Side panel contains stats, tools, and 3×3 numpad.
6. Pause menu:
   - Opens via pause button, `P`, `Space`, and `Escape`.
   - Resume button is autofocused.
   - Tab cycles inside the sheet; focus returns to the selected board cell on close.
   - Escape and Resume close and resume.
   - Board digits are hidden/blurred while open.
   - New Game and Restart show the inline confirm when progress exists.
   - Difficulty and theme segmented controls update and persist.
   - Shortcut help expands/collapses.
7. Reload a saved in-progress game: it resumes running, not paused.
8. Hide the tab: timer pauses. Return: pause menu appears and game stays paused until Resume.
9. Win and game-over modals still appear, are keyboard-accessible, and New Game works from both.
10. All shortcuts still work: 1–9, Backspace/Delete/0/E, arrows, N, Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z / Ctrl+Y, H, P/Space, M, Escape.
11. Light, dark, and auto themes look correct; no hard-coded colors outside the existing variables.
12. Check safe-area padding on a notched iPhone; no content under the home indicator or notch.
13. Confirm all asset paths remain relative and the app works from the GitHub Pages subpath.
