/** Create the completion dialog; contract skeleton for shell integration. */
export function createWinDialog({ root, app }) {
  return { show({ game, record, score, personalBest }) { root.dataset.testid = 'win-dialog'; }, hide() { root.replaceChildren(); } };
}
