# Still Sudoku

A calm, ad-free Sudoku. Plain HTML/CSS/ES modules: no build step, no runtime dependencies, relative paths only (works from any subpath and offline as a PWA). The same files are wrapped with Capacitor for iOS and Android.

Live site: **https://brandon-schabel.github.io/sudoku-app/**

*Just the puzzle. Always ad-free.*

## Features

**Gameplay**
- Four technique-graded difficulties (Easy, Medium, Hard, Expert) with a dot rating. Every puzzle has a unique solution.
- Status bar: difficulty, mistakes, active-time timer (excludes pauses; can be hidden in settings), pause button.
- Number pad with "N left" counts; a digit is disabled once all nine are placed.
- Tools: Undo, Redo, Erase, Notes, Check, Hint, Fill notes (auto pencil marks), Restart (with optional confirmation).
- Two input modes: **cell-first** (tap a cell, then a digit) and **number-first** (tap a digit, then as many cells as you like; tap the digit again to put it down).
- Teaching hints in three steps: 1. highlight the area to look at, 2. explain the candidates and eliminations (marked on the board), 3. fill the cell. "I'll try it" closes the hint and leaves the area highlighted.
- Show mistakes as you go (underlined; colourblind mode adds a wavy underline and a corner marker), Check, and rule-conflict marks. There is no game over.
- Notes are cleaned up automatically when you place a digit (setting). Related row/column/box and same-digit highlighting (settings).
- Progress bar: "17 of 39 cells filled".
- Daily puzzle (one shared Medium per UTC day), statistics, themes and settings in the unified menu.

**Saving.** Every action is saved locally (plus a timer and on app hide). Starting a new game never discards the current one; it stays under Continue. Reloading resumes the active game with its full undo history.

**Mobile.** No page scroll and no header on phones. The board is sized to the available space. The tools sit directly above the single-row number pad in portrait. In landscape the board is on the left with tools and a 3×3 pad on the right. Tablets and desktops get a side panel. Safe-area insets are respected, and touch targets are at least 44 px tall. A brief app switch never pauses; after more than 10 seconds away you come back to the pause menu.

**Accessibility.** Skip link, labelled cells ("Row 1, column 3, 1, given"), labelled buttons with counts, keyboard play, large and extra-large text that still fits without scrolling, reduced motion (setting or system), colourblind-safe error marks, optional haptics and sounds.

## Keyboard shortcuts

| Action | Keys |
| --- | --- |
| Enter a digit | `1`–`9` |
| Toggle a note | `Shift` + `1`–`9`, or `1`–`9` in notes mode |
| Move the selection | Arrow keys (wraps around) |
| Erase | `Backspace`, `Delete`, `0`, `E` |
| Notes mode | `N` |
| Undo | `Ctrl/⌘ + Z` |
| Redo | `Shift + Z`, `Ctrl/⌘ + Shift + Z`, `Ctrl + Y` |
| Hint (press again for the next step) | `H` |
| Pause / menu | `P` |
| Close the hint / clear the number-first digit / pause | `Esc` |

## Architecture

```
index.html, styles.css        app shell + gameplay layout (styles/themes.css, styles/menu.css: menu + themes)
src/main.js                   bootstrap: wires controller ↔ views, settings → <html>, input, autosave, app state, test hooks
src/game.js                   Game state v2 (pure): values, notes, undo history, timer, mistakes, assist counters
src/ui/controller.js          DOM-free app controller: domain store, archive, records, win → record, pause holds
src/ui/view-model.js          pure view helpers (cell labels, highlights, pad, html attributes)
src/ui/keys.js                keyboard map (pure)
src/ui/board.js pad.js toolbar.js status.js hint-panel.js confirm.js   gameplay views
src/ui/menu/**, win.js, onboarding.js                                  unified menu, win dialog, first run
src/engine/                   pure Sudoku engine: generator, grader, techniques, hints, daily puzzle
src/domain/                   pure settings, scoring, statistics, archive, versioned storage + migration, import/export
src/platform/                 web/native adapters: haptics, sounds, review, app state, service worker
```

The engine, domain and platform layers each have one barrel (`index.js`), and everything else imports only from those. See `docs/ROADMAP.md` for the contracts and `docs/UI-CONTRACT.md` for the shell/menu split.

`<html>` carries `data-theme`, `data-mode` (light/dark, resolved from the setting and the system), `data-text`, `data-motion` and `data-cb`. The stylesheets read only the custom properties listed in the UI contract.

### Test hooks

With `?test=1`, `window.__sudoku` exposes `state()`, `load(puzzle, solution)`, `fillAllBut(n)` and `settings()`. `?seed=<s>&difficulty=<d>` starts a deterministic game (or resumes it if it is already unfinished), which is useful for screenshots.

## Run locally

```sh
python3 -m http.server 8000
```

Open <http://localhost:8000/>. ES modules need a server; opening `index.html` from the filesystem does not work.

## Tests

```sh
node --test
```

No installs needed. The suites cover the engine, domain, platform adapters, PWA/build files, Game v2 (`tests/game.core.test.mjs`), the app controller (`tests/game.controller.test.mjs`), the key map (`tests/game.keys.test.mjs`) and the view-model helpers (`tests/game.view-model.test.mjs`). End-to-end Playwright specs live in `tests/e2e/` (`*.spec.mjs`, never collected by `node --test`).

### Layout check

`tools/layout-check.mjs` loads the app at ten phone, landscape, tablet and desktop viewports. It fails on page scroll, on anything outside the viewport, on a non-square board, or on targets under 44 px. It needs Playwright, either installed or pointed to with `PLAYWRIGHT_MODULE`:

```sh
python3 -m http.server 8771 --bind 127.0.0.1 &
node tools/layout-check.mjs --text xlarge --dark --shots /tmp/shots
```

## Native apps

See `STORE-PUBLISHING.md` (Capacitor build, signing, store listings) and `privacy.html`. All data stays on the device.
