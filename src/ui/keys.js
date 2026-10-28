/**
 * Keyboard shortcut map (SPEC "Keyboard shortcuts"). Pure: turns a
 * KeyboardEvent-like object into a command; main.js performs it.
 * @module ui/keys
 */

/**
 * @typedef {{type:'digit', digit:number, note?:boolean}
 *   | {type:'move', dr:number, dc:number}
 *   | {type:'erase'} | {type:'toggleNotes'} | {type:'undo'} | {type:'redo'}
 *   | {type:'hint'} | {type:'pause'} | {type:'escape'}} KeyCommand
 */

const ARROWS = {
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1]
};

/** Shortcut legend for help text: [keys, description]. */
export const SHORTCUTS = Object.freeze([
  ["1–9", "Enter a digit (Shift + digit: note)"],
  ["Arrow keys", "Move the selection"],
  ["Backspace / Delete / 0 / E", "Erase"],
  ["N", "Toggle notes mode"],
  ["Ctrl/⌘ + Z", "Undo"],
  ["Shift + Z, Ctrl/⌘ + Shift + Z, Ctrl + Y", "Redo"],
  ["H", "Hint"],
  ["P", "Pause / menu"],
  ["Esc", "Close the hint, clear the selected digit, or pause"]
]);

/**
 * Map a key event to a command.
 * @param {{key:string, code?:string, ctrlKey?:boolean, metaKey?:boolean, shiftKey?:boolean, altKey?:boolean}} e
 * @returns {KeyCommand|null} null when the key is not a shortcut (let the browser handle it)
 */
export function keyToCommand(e) {
  if (!e || typeof e.key !== "string" || e.altKey) return null;
  const mod = Boolean(e.ctrlKey || e.metaKey);
  const key = e.key;
  const lower = key.length === 1 ? key.toLowerCase() : key;

  if (mod) {
    if (lower === "z") return e.shiftKey ? { type: "redo" } : { type: "undo" };
    if (lower === "y" && e.ctrlKey && !e.metaKey) return { type: "redo" };
    return null;
  }

  // Digits: use the physical key when shifted ("!" on Digit1 → note 1).
  const code = typeof e.code === "string" ? e.code : "";
  const codeDigit = /^(?:Digit|Numpad)([0-9])$/.exec(code);
  const digit = /^[0-9]$/.test(key) ? Number(key) : codeDigit ? Number(codeDigit[1]) : -1;
  if (digit >= 1 && digit <= 9) return e.shiftKey ? { type: "digit", digit, note: true } : { type: "digit", digit };
  if (digit === 0 && !e.shiftKey) return { type: "erase" };

  if (ARROWS[key]) {
    const [dr, dc] = ARROWS[key];
    return { type: "move", dr, dc };
  }
  if (key === "Backspace" || key === "Delete") return { type: "erase" };
  if (key === "Escape") return { type: "escape" };
  if (lower === "z" && e.shiftKey) return { type: "redo" };
  if (e.shiftKey) return null;
  switch (lower) {
    case "e": return { type: "erase" };
    case "n": return { type: "toggleNotes" };
    case "h": return { type: "hint" };
    case "p": return { type: "pause" };
    default: return null;
  }
}

/**
 * Move a selection on the 9×9 grid, wrapping at the edges.
 * @param {number|null} index current selection (null → start at the centre)
 * @param {number} dr @param {number} dc
 * @returns {number}
 */
export function moveIndex(index, dr, dc) {
  if (!Number.isInteger(index) || index < 0 || index > 80) return 40;
  const r = (Math.floor(index / 9) + dr + 9) % 9;
  const c = ((index % 9) + dc + 9) % 9;
  return r * 9 + c;
}

/**
 * Decide how a keyboard digit is applied, mirroring the number pad.
 * Number-first mode: a plain digit selects (or toggles off) the active digit;
 * Shift+digit still toggles a note in the selected cell. Cell-first mode, and
 * any digit without a selected cell, behaves as before.
 * @param {{digit:number, note?:boolean}} cmd
 * @param {{inputMode:string, selected:number|null}} ctx
 * @returns {'pick'|'apply'}
 */
export function digitKeyAction(cmd, { inputMode, selected }) {
  if (selected === null) return "pick";
  return inputMode === "number-first" && !cmd.note ? "pick" : "apply";
}
