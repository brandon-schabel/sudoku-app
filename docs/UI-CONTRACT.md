# UI contract between C1 (shell/gameplay) and C2 (menu/stats/settings/themes/onboarding)

Owner split (disjoint write sets):
- **C1 (Claude Opus, branch feat/c1-gameplay)**: `index.html`, `styles.css`, `src/main.js`, `src/game.js`, `src/ui/board.js|pad.js|toolbar.js|hint-panel.js|status.js|keys.js|*` (everything NOT under `src/ui/menu/`, `src/ui/win.js`, `src/ui/onboarding.js`), `tests/game.*.test.mjs`, `tests/sudoku.test.mjs`, README.md. Deletes legacy `src/ui.js`, `src/storage.js` when switched. Pause button, mobile/landscape layout, input handling, hints, check, notes, keyboard shortcuts, settings application to `<html>`, persistence wiring (domain store), worker generation, win detection, daily start/new-game plumbing.
- **C2 (Codex, branch feat/c2-menu)**: `src/ui/menu/**` (menu shell + views), `src/ui/win.js`, `src/ui/onboarding.js`, `src/ui/dom.js` (tiny h() helper), `styles/menu.css`, `styles/themes.css`, `tests/ui.*.test.mjs` (jsdom-free: test pure view-model helpers only; DOM behavior is covered by e2e), `docs/HOWTO-TEXT.md` optional. C2 never edits C1 files; C1 adds `<link rel="stylesheet" href="./styles/themes.css">` and `./styles/menu.css` in index.html and mount points `<div id="menu-root"></div>`, `<div id="win-root"></div>`, `<div id="onboarding-root"></div>` and imports C2 modules by the paths below. Until C2 lands, C1 creates tiny stub files at those paths (C2 overwrites them; resolve by taking C2's version).

## App facade (C1 builds in src/main.js and passes to C2 modules)
```js
app = {
  data(): AppData,                       // live domain data (settings, archive, records, meta)
  settings(): Settings,
  setSetting(key, value): void,          // validates through normalizeSettings, persists, re-applies <html> data attributes
  game(): GameJSON|null,                 // current game snapshot (running or paused)
  actions: {
    resume(): void,                      // close menu + resume timer
    newGame(difficulty): Promise<void>,  // generates (worker), archive.startNew (old active kept in Continue), starts it
    startDaily(dateKey): Promise<void>,  // dailyPuzzle(dateKey): resume existing archive entry for that day if any
    continueEntry(id): void,             // archive.resume + load
    restoreRecovery(id, savedAt): void,
    removeEntry(id): void,               // explicit user delete only
    restart(): void, check(): number[], revealCell(): boolean, fillNotes(): void, clearNotes(): void,
    exportData(): string, importData(text): {added, conflicts}   // throws ImportError
  },
  on(event, fn): () => void              // 'change' (anything), 'win' ({game, record, personalBest, score})
}
```
## C2 module entry points (exact paths and shapes)
- `src/ui/menu/index.js`: `createMenu({ root, app, onOpen, onClose }) -> { open(view?='menu'|'settings'|'stats'|'daily'|'continue'|'new'|'howto'|'tools'), close(), isOpen(), refresh() }`. Single unified panel (Menu -> Settings/Statistics -> Back, plus "Return to puzzle"); onOpen/onClose let C1 pause/resume; focus trap, Escape closes/backs, aria-modal dialog, full test ids from ROADMAP 2.5. Pause summary line "Easy · 15:19 · 0 mistakes · 0 hints" at top of the menu.
- `src/ui/win.js`: `createWinDialog({ root, app }) -> { show({ game, record, score, personalBest }), hide() }` (score, PB comparison, buttons: New game, Stats, View board; `data-testid="win-dialog"`).
- `src/ui/onboarding.js`: `createOnboarding({ root, app }) -> { maybeShow() }` first-run only (settings.onboardingDone), 3-4 short steps, skippable, sets onboardingDone via app.setSetting.

## `<html>` attributes C1 sets (CSS keys for C2's themes.css)
`data-theme="graphite|ocean|lavender|sand|rose|sage"`, `data-mode="light|dark"` (resolved from colorMode/system), `data-text="default|large|xlarge"`, `data-motion="reduce|full"`, `data-cb="1"` when colorblind-safe mode.
## CSS custom properties (C1's styles.css consumes ONLY these; C2's themes.css defines them for every theme x mode, WCAG AA contrast checked in a node test)
`--bg --surface --surface-2 --text --text-muted --border --accent --accent-contrast --cell-bg --cell-given --cell-user --cell-selected --cell-related --cell-same --note --error --error-bg --success --focus --shadow`
Colorblind mode (`data-cb="1"`): errors use pattern+shape (underline wavy/ icon) in addition to color; C1 handles board marks, C2 provides `--error` variants that stay distinguishable (blue/orange palette).
C1 also ships a default `:root` fallback palette (Graphite light) in styles.css so it works before themes.css exists.
