# Testing

Run `node --test` for the engine, domain, and game unit suites. Run `npx playwright test` for the browser suite. Playwright starts the E-owned static server in `tests/e2e/server.mjs` and exercises phone portrait (390×844), phone landscape (844×390), desktop (1440×900), and tablet (820×1180). Set `BASE_URL` to use a separately hosted preview. Set `SCREENSHOT_DIR` to choose the screenshot root; screenshots are written as `<project>/<name>.png`.

The browser suite covers first-run onboarding, cell-first and number-first entry, notes and auto-notes, undo/redo save reload, three-step hints, checks without game-over, win records and assisted/unassisted statistics, archive retention, daily calendar, all six themes and light/dark persistence, settings, a real legacy v1 save migration, layout and touch targets, PWA manifest and offline reload, console errors, and axe scans of the game plus every menu view in light and dark modes. CI stores screenshots and the HTML Playwright report as artifacts.

`npm run screenshots:e2e` runs the same suite while saving screenshots under `test-results/screenshots`. Test results and Playwright reports are ignored by git.
