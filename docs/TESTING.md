# Testing

Run the domain and engine suite with `npm test`. Run the browser suite with `npm run test:e2e`; it uses Playwright Chromium and runs at phone portrait (390×844), phone landscape (844×390), desktop (1440×900), and tablet (820×1180).

`tools/serve.mjs` serves the repository root without dependencies, preserves query strings, rejects paths outside the repository, and supports nested asset paths. Set `BASE_URL` to run against a deployed preview instead of starting the local server. Set `SCREENSHOT_DIR` to choose where project/name screenshots are written; the default is `test-results/screenshots`.

While the UI is still on its legacy markup, run the harness smoke check with `LEGACY=1 npx playwright test tests/e2e/smoke-legacy.spec.mjs --project=desktop`. The smoke check exercises the static server, viewport project, axe scan, and screenshot output. The legacy check is opt-in and is skipped during the normal suite. Full UI tests consume the `data-testid` hooks and test API defined in section 2.5 of `docs/ROADMAP.md`.

The suite covers gameplay, notes and undo, hints and assisted play, save reload, keyboard shortcuts, menu and settings, legacy migration, archive retention, daily calendar, statistics and win flow, axe, console errors, mobile layout, and offline reload. It uses Playwright's condition-based waits and does not use fixed delays.
