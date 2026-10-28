import test from "node:test";
import assert from "node:assert/strict";
import {
  boardView, cellLabel, difficultyView, formatTime, htmlAttributes, newlyShownErrors, noteDigits, padView, progressView
} from "../src/ui/view-model.js";
import { DEFAULT_SETTINGS } from "../src/domain/index.js";
import { peersOf } from "../src/engine/index.js";

const PUZZLE = [..."530070000600195000098000060800060003400803001700020006060000280000419005000080079"].map(Number);
const SOLUTION = [..."534678912672195348198342567859761423426853791713924856961537284287419635345286179"].map(Number);
const state = (values = PUZZLE.slice(), notes = new Array(81).fill(0)) => ({ puzzle: PUZZLE, solution: SOLUTION, values, notes });
const settings = { ...DEFAULT_SETTINGS };

test("formatTime", () => {
  assert.equal(formatTime(0), "00:00");
  assert.equal(formatTime(61_999), "01:01");
  assert.equal(formatTime(15 * 60_000 + 19_000), "15:19");
  assert.equal(formatTime(3_600_000 + 5_000), "1:00:05");
  assert.equal(formatTime(-5), "00:00");
  assert.equal(formatTime(undefined), "00:00");
});

test("cell labels follow 'Row 1, column 3, 1, given'", () => {
  assert.equal(cellLabel({ index: 2, value: 1, given: true }), "Row 1, column 3, 1, given");
  assert.equal(cellLabel({ index: 80, value: 0, given: false }), "Row 9, column 9, empty");
  assert.equal(cellLabel({ index: 9, value: 0, given: false, notes: 0b100000101 }), "Row 2, column 1, notes 1 3 9");
  assert.equal(cellLabel({ index: 10, value: 4, given: false }), "Row 2, column 2, 4");
  assert.equal(cellLabel({ index: 10, value: 4, given: false, wrong: true, conflict: true }), "Row 2, column 2, 4, incorrect, conflict");
  assert.deepEqual(noteDigits(0), []);
  assert.deepEqual(noteDigits(511), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
});

test("difficulty and progress views", () => {
  assert.deepEqual(difficultyView("hard"), { label: "Hard", dots: 3, text: "Hard, difficulty 3 of 4" });
  assert.equal(difficultyView("bogus").dots, 0);
  assert.deepEqual(progressView({ filled: 17, total: 39 }), { text: "17 of 39 cells filled", ratio: 17 / 39 });
  assert.equal(progressView({ filled: 0, total: 0 }).ratio, 1);
});

test("boardView: selection, related and same-digit highlight follow settings", () => {
  const view = boardView({ state: state(), selected: 0, settings });
  assert.equal(view[0].selected, true);
  for (const p of peersOf(0)) assert.equal(view[p].related, true);
  assert.equal(view[80].related, false);
  const fives = PUZZLE.flatMap((v, i) => (v === 5 ? [i] : []));
  for (const i of fives) assert.equal(view[i].same, true);
  assert.equal(view[1].same, false);

  const off = boardView({ state: state(), selected: 0, settings: { ...settings, highlightRelated: false, highlightSameDigit: false } });
  assert.ok(off.every((c) => !c.related && !c.same));

  const numberFirst = boardView({ state: state(), selected: null, digit: 7, settings });
  assert.ok(numberFirst.filter((c) => c.same).every((c) => c.value === 7));
  assert.equal(numberFirst.filter((c) => c.same).length, PUZZLE.filter((v) => v === 7).length);
});

test("boardView: notes, note highlight, givens and labels", () => {
  const notes = new Array(81).fill(0);
  notes[2] = 0b1001; // 1 and 4
  const view = boardView({ state: state(PUZZLE.slice(), notes), selected: null, digit: 4, settings });
  assert.deepEqual(view[2].notes, [1, 4]);
  assert.equal(view[2].noteHighlight, 4);
  assert.equal(view[0].given, true);
  assert.equal(view[0].label, "Row 1, column 1, 5, given");
});

test("boardView: wrong entries depend on showMistakes or a Check flag; conflicts are marked", () => {
  const values = PUZZLE.slice();
  values[2] = 5; // wrong (solution 4) and conflicts with the given 5 in row 1
  values[3] = 6; // correct
  const shown = boardView({ state: state(values), selected: null, settings });
  assert.equal(shown[2].wrong, true);
  assert.equal(shown[2].conflict, true);
  assert.equal(shown[0].conflict, false, "givens are never marked");
  assert.equal(shown[3].wrong, false);
  assert.match(shown[2].label, /incorrect/);

  const hidden = boardView({ state: state(values), selected: null, settings: { ...settings, showMistakes: false } });
  assert.equal(hidden[2].wrong, false);
  const flagged = boardView({ state: state(values), selected: null, settings: { ...settings, showMistakes: false }, flagged: new Set([2]) });
  assert.equal(flagged[2].wrong, true);
});

test("boardView: hint area, pattern cells, candidate marks and target per step", () => {
  const hint = {
    houses: [{ type: "row", index: 0 }],
    cells: [2, 5],
    candidates: [{ index: 2, digit: 4 }, { index: 5, digit: 8 }],
    eliminations: [{ index: 5, digit: 2 }, { index: 0, digit: 9 }],
    placement: { index: 2, digit: 4 }
  };
  const step0 = boardView({ state: state(), selected: null, settings, hint: { hint, step: 0 } });
  for (let c = 0; c < 9; c++) assert.equal(step0[c].hintArea, true);
  assert.equal(step0[9].hintArea, false);
  assert.equal(step0[5].hintCell, true);
  assert.equal(step0[2].hintTarget, false, "step 1 does not give away the cell");
  assert.equal(step0[2].hintMarks, null);

  const step1 = boardView({ state: state(), selected: null, settings, hint: { hint, step: 1 } });
  assert.deepEqual(step1[2].hintMarks, { 4: "cand" });
  assert.deepEqual(step1[5].hintMarks, { 8: "cand", 2: "elim" });
  assert.equal(step1[0].hintMarks, null, "filled cells get no marks");
  assert.equal(step1[2].hintTarget, true);
});

test("padView: counts, disabled at 0 (except in notes mode), pressed digit", () => {
  const remaining = { 1: 0, 2: 3, 3: 9, 4: 1, 5: 2, 6: 0, 7: 5, 8: 4, 9: 8 };
  const pad = padView(remaining, { selectedDigit: 2 });
  assert.equal(pad.length, 9);
  assert.deepEqual(pad[0], { digit: 1, left: 0, disabled: true, pressed: false, label: "1, 0 left" });
  assert.equal(pad[1].pressed, true);
  assert.equal(pad[1].label, "2, 3 left");
  const notes = padView(remaining, { notesMode: true });
  assert.equal(notes[0].disabled, false);
  assert.equal(notes[0].label, "Note 1, 0 left");
});

test("htmlAttributes resolves colour mode, motion, text and colourblind", () => {
  assert.deepEqual(htmlAttributes(settings), { theme: "graphite", mode: "light", text: "default", motion: "full", cb: null });
  assert.equal(htmlAttributes(settings, { prefersDark: true }).mode, "dark");
  assert.equal(htmlAttributes({ ...settings, colorMode: "light" }, { prefersDark: true }).mode, "light");
  assert.equal(htmlAttributes({ ...settings, colorMode: "dark" }).mode, "dark");
  assert.equal(htmlAttributes(settings, { prefersReducedMotion: true }).motion, "reduce");
  assert.equal(htmlAttributes({ ...settings, reducedMotion: "off" }, { prefersReducedMotion: true }).motion, "full");
  assert.equal(htmlAttributes({ ...settings, reducedMotion: "on" }).motion, "reduce");
  const custom = htmlAttributes({ ...settings, theme: "ocean", textSize: "xlarge", colorblind: true });
  assert.equal(custom.theme, "ocean");
  assert.equal(custom.text, "xlarge");
  assert.equal(custom.cb, "1");
});

test("newlyShownErrors counts each wrong (cell, digit) once", () => {
  const values = PUZZLE.slice();
  values[2] = 5;
  const seen = new Set();
  assert.equal(newlyShownErrors(state(values), seen), 1);
  assert.equal(newlyShownErrors(state(values), seen), 0);
  values[2] = 6;
  values[3] = 1;
  assert.equal(newlyShownErrors(state(values), seen), 2);
  values[3] = 6;
  assert.equal(newlyShownErrors(state(values), seen), 0, "correct entries never count");
});
