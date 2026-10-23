# Sudoku

A fast, accessible Sudoku game that runs entirely in the browser with no build step and no external dependencies. Puzzles are generated locally, progress is saved automatically in `localStorage`, and the app works when served from any subpath.

Live site: **https://brandon-schabel.github.io/sudoku-app/**

## Features

- Four difficulties: Easy, Medium, Hard, and Expert. Every generated puzzle has a unique solution.
- Keyboard and pointer/touch play with row, column, and box highlighting.
- Same-number highlighting and red conflict highlighting.
- Notes mode with a 3x3 candidate mini-grid.
- Erase, undo, redo, and hints.
- Mistake counter, game-over prompt, and a win summary with time, difficulty, mistakes, and hints.
- Timer with pause/resume and automatic pause when the tab is hidden.
- Automatic save and restore, including board, notes, history, timer, mistakes, and hints.
- Light, dark, and automatic system themes.
- Responsive layout with large touch targets and keyboard focus styles.
- No external resources: relative paths only, plus an inline SVG favicon.

## Controls and shortcuts

| Action | Keyboard | On screen |
| --- | --- | --- |
| Select a cell | Arrow keys | Click or tap a cell |
| Enter a digit | `1`–`9` | Number pad |
| Toggle notes | `N` | Notes button |
| Enter a note | `1`–`9` in notes mode | Notes button, then number pad |
| Erase | `E`, `Backspace`, `Delete`, or `0` | Erase button |
| Undo | `Ctrl/Cmd+Z` | Undo button |
| Redo | `Ctrl/Cmd+Shift+Z` or `Ctrl+Y` | Redo button |
| Hint | `H` | Hint button |
| Pause / resume | `P` or `Space` | Pause button |
| Change theme | `M` | Theme button |
| Dismiss win dialog | `Escape` | View board button |

The game-over dialog is intentionally dismissible only with its **New game** or **Keep playing** buttons.

## Mistake policy

A wrong digit increments the mistake counter. At **3 mistakes** the app opens a blocking **Game over** dialog with two choices:

- **New game** — start a fresh puzzle.
- **Keep playing** — dismiss the dialog for the rest of this game.

Choosing **Keep playing** does not reset the counter. Later mistakes continue to increment the display (for example, `Mistakes: 4/3`) but do not re-open the dialog. You can still finish and win the puzzle; the win summary reports the total number of mistakes.

## Run locally

This is a static site, so any static file server works. From the repository root:

```sh
python3 -m http.server 8000
```

Open <http://localhost:8000/>.

Because the app uses ES modules, opening `index.html` directly from the filesystem may be blocked by the browser. Use the local server instead.

## Tests

```sh
node --test
```

The tests cover the solver, generator, game state/history, and storage fallbacks. No dependencies need to be installed.

## Deploy

The site is deployed with GitHub Pages from the **`main` branch, repository root**:

1. Push the repository to GitHub.
2. Open **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Select branch **`main`** and folder **`/ (root)`**, then save.

The live site is published at <https://brandon-schabel.github.io/sudoku-app/>. All asset paths are relative, so the app also works from a nested path. The empty `.nojekyll` file keeps GitHub Pages from running Jekyll processing.

## Project layout

```text
index.html          Page structure and dialogs
styles.css          Responsive light/dark styles
src/sudoku.js       Solver, validator, and puzzle generator
src/game.js         Pure game state, history, mistakes, hints, and timer
src/storage.js      localStorage save/load with validation
src/ui.js           Board rendering, controls, modals, and announcements
src/main.js         Entry point wiring game, UI, storage, and input
tests/              Node test suite
```