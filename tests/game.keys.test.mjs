import test from "node:test";
import assert from "node:assert/strict";
import { keyToCommand, moveIndex, SHORTCUTS } from "../src/ui/keys.js";

const k = (key, extra = {}) => keyToCommand({ key, ...extra });

test("digits enter values; shifted digits toggle notes; 0 erases", () => {
  for (let d = 1; d <= 9; d++) {
    assert.deepEqual(k(String(d)), { type: "digit", digit: d });
    assert.deepEqual(k("!", { code: `Digit${d}`, shiftKey: true }), { type: "digit", digit: d, note: true });
    assert.deepEqual(k(String(d), { code: `Numpad${d}` }), { type: "digit", digit: d });
  }
  assert.deepEqual(k("0"), { type: "erase" });
});

test("arrows move", () => {
  assert.deepEqual(k("ArrowUp"), { type: "move", dr: -1, dc: 0 });
  assert.deepEqual(k("ArrowDown"), { type: "move", dr: 1, dc: 0 });
  assert.deepEqual(k("ArrowLeft"), { type: "move", dr: 0, dc: -1 });
  assert.deepEqual(k("ArrowRight"), { type: "move", dr: 0, dc: 1 });
});

test("erase, notes, hint, pause, escape", () => {
  for (const key of ["Backspace", "Delete", "e", "E"]) assert.deepEqual(k(key), { type: "erase" });
  assert.deepEqual(k("n"), { type: "toggleNotes" });
  assert.deepEqual(k("N"), { type: "toggleNotes" });
  assert.deepEqual(k("h"), { type: "hint" });
  assert.deepEqual(k("p"), { type: "pause" });
  assert.deepEqual(k("Escape"), { type: "escape" });
});

test("undo / redo combinations", () => {
  assert.deepEqual(k("z", { ctrlKey: true }), { type: "undo" });
  assert.deepEqual(k("z", { metaKey: true }), { type: "undo" });
  assert.deepEqual(k("Z", { ctrlKey: true, shiftKey: true }), { type: "redo" });
  assert.deepEqual(k("z", { metaKey: true, shiftKey: true }), { type: "redo" });
  assert.deepEqual(k("y", { ctrlKey: true }), { type: "redo" });
  assert.deepEqual(k("Z", { shiftKey: true }), { type: "redo" });
  assert.equal(k("y", { metaKey: true }), null, "Cmd+Y is browser history on macOS");
  assert.equal(k("z"), null);
});

test("unrelated keys and browser shortcuts pass through", () => {
  assert.equal(k("r", { ctrlKey: true }), null);
  assert.equal(k("1", { ctrlKey: true }), null);
  assert.equal(k("1", { altKey: true }), null);
  assert.equal(k("Tab"), null);
  assert.equal(k("Enter"), null);
  assert.equal(k("x"), null);
  assert.equal(k("N", { shiftKey: true }), null);
  assert.equal(keyToCommand(null), null);
  assert.equal(keyToCommand({}), null);
});

test("moveIndex wraps around edges and starts at the centre", () => {
  assert.equal(moveIndex(null, 0, 1), 40);
  assert.equal(moveIndex(0, -1, 0), 72);
  assert.equal(moveIndex(0, 0, -1), 8);
  assert.equal(moveIndex(80, 1, 0), 8);
  assert.equal(moveIndex(80, 0, 1), 72);
  assert.equal(moveIndex(40, 1, 1), 50);
});

test("shortcut legend covers every command", () => {
  const text = SHORTCUTS.map(([a, b]) => `${a} ${b}`).join(" ");
  for (const word of ["1–9", "Arrow", "Backspace", "N", "Z", "H", "P", "Esc"]) assert.ok(text.includes(word), word);
});

import { digitKeyAction } from "../src/ui/keys.js";
import { readFileSync } from "node:fs";

test("keyboard digits follow the input mode", () => {
  const plain = { digit: 5 };
  const note = { digit: 5, note: true };
  assert.equal(digitKeyAction(plain, { inputMode: "cell-first", selected: 3 }), "apply");
  assert.equal(digitKeyAction(note, { inputMode: "cell-first", selected: 3 }), "apply");
  assert.equal(digitKeyAction(plain, { inputMode: "number-first", selected: 3 }), "pick");
  assert.equal(digitKeyAction(note, { inputMode: "number-first", selected: 3 }), "apply");
  assert.equal(digitKeyAction(plain, { inputMode: "cell-first", selected: null }), "pick");
});

test("skip link targets the board and main.js moves focus into the grid", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /class="skip-link" href="#board"/);
  const main = readFileSync(new URL("../src/main.js", import.meta.url), "utf8");
  assert.match(main, /skip-link"\)\?\.addEventListener\("click"[\s\S]*?board\.focus\(\)/);
});
