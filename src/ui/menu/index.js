/** Create the unified Sudoku menu; contract skeleton for shell integration. */
export function createMenu({ root, app, onOpen, onClose }) {
  let opened = false;
  return {
    open(view = 'menu') { opened = true; root.dataset.view = view; onOpen?.(); },
    close() { opened = false; root.replaceChildren(); onClose?.(); },
    isOpen() { return opened; },
    refresh() {},
  };
}
