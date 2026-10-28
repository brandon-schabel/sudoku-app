/**
 * Tool buttons: Undo, Redo, Erase, Notes, Check, Hint, Fill notes, Restart.
 * @module ui/toolbar
 */
import { attr, el } from "./el.js";
import { ICONS } from "./icons.js";

/** Tool ids in display order with labels and shortcut hints. */
export const TOOLS = Object.freeze([
  { id: "undo", label: "Undo", title: "Undo (Ctrl/⌘+Z)" },
  { id: "erase", label: "Erase", title: "Erase (Backspace)" },
  { id: "notes", label: "Notes", title: "Notes mode (N)" },
  { id: "hint", label: "Hint", title: "Hint (H)" },
  { id: "redo", label: "Redo", title: "Redo (Shift+Z)" },
  { id: "check", label: "Check", title: "Check entries" },
  { id: "autonotes", label: "Fill notes", title: "Fill in all pencil notes" },
  { id: "restart", label: "Restart", title: "Restart this puzzle" }
]);

/**
 * @param {HTMLElement} root
 * @param {(id:string) => void} onTool
 * @returns {{render(state:{canUndo:boolean, canRedo:boolean, notes:boolean, playable:boolean}):void}}
 */
export function createToolbar(root, onTool) {
  root.textContent = "";
  const buttons = {};
  for (const tool of TOOLS) {
    const button = el(
      "button",
      {
        type: "button",
        class: `tool tool-${tool.id}`,
        "data-testid": `tool-${tool.id}`,
        title: tool.title,
        onClick: () => onTool(tool.id)
      },
      [el("span", { class: "tool-icon", html: ICONS[tool.id] }), el("span", { class: "tool-label", text: tool.label })]
    );
    if (tool.id === "notes") button.setAttribute("aria-pressed", "false");
    buttons[tool.id] = button;
    root.append(button);
  }
  return {
    render({ canUndo, canRedo, notes, playable }) {
      buttons.undo.disabled = !canUndo;
      buttons.redo.disabled = !canRedo;
      for (const id of ["erase", "check", "hint", "autonotes"]) buttons[id].disabled = !playable;
      attr(buttons.notes, "aria-pressed", notes ? "true" : "false");
      attr(buttons.notes, "aria-label", notes ? "Notes, on" : "Notes, off");
    }
  };
}
