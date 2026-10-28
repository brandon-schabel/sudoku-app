# E2E findings

## F1: Phone touch targets are narrower than 44 px

- **Repro:** Run `npx playwright test tests/e2e/layout.spec.mjs --project=phone-portrait` at 390×844. The page has no scroll and the board remains square, but the layout measurement reports each board cell at 41.11×41.11 px and each numpad key at 37.11×70.89 px. The 844×390 phone-landscape project also fails the 44 px target assertion.
- **Expected:** Every interactive touch target is at least 44×44 px at every required viewport.
- **Actual:** Board cells and numpad buttons are narrower than 44 px on both phone viewports.
- **Likely area:** `styles.css`, responsive board and numpad sizing rules.
- **Test status:** The layout test retains scroll and square-board assertions on all projects and is marked `test.fixme` for the two phone projects with this reference.
