# C2 review round 1 additive contracts

- `createWinDialog({ root, app, menu })` accepts an optional existing menu controller. When omitted, it looks up the menu registered for the app; it never creates a second menu.
- Menu close ownership: when `createMenu` receives `onClose`, that callback owns resuming the paused game. The menu calls `app.actions.resume()` only when no `onClose` callback exists and `app.game()` is non-null. `app.actions.resume()` should itself remain safe if no game exists.
- Review prompt persistence gap: the facade contract has no meta update action. C2 conditionally uses optional `app.actions.setReviewPromptedAt(timestamp)` before calling `platform.requestReview()`. If the action is unavailable, C2 suppresses the request to avoid prompting repeatedly. C1 should expose this action and persist `meta.reviewPromptedAt`.
- `src/ui/menu/models.js` exports pure `cellLabel(index, value, given)` for C1 to use for accessible board-cell labels. Example: `cellLabel(2, 1, true)` returns `Row 1, column 3, 1, given`.
- C1 owns skip-link and board-cell wiring; C2 provides and tests the label helper. Win review prompt UI gating is implemented, but actual persistence and native review behavior require C1's optional facade action and D's adapter.
- `.c2-error` has a wavy underline in every mode so a board using the agreed class has a non-color error cue; C1 must apply that class to error-marked cells.
- Focus trap, Escape routing, DOM re-render focus restoration, and stats-tab keyboard interactions remain browser E2E obligations because C2's unit tests are DOM-free. Haptics/sounds and brief-focus behavior remain C1 integration responsibilities.
