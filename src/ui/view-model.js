/**
 * Pure view-model helpers for the gameplay UI (no DOM). Tested in
 * tests/game.view-model.test.mjs.
 * @module ui/view-model
 */
import { DIFFICULTY_META, findConflicts, houseCells, peersOf } from "../engine/index.js";

/**
 * @param {number} ms
 * @returns {string} "m:ss" below an hour, else "h:mm:ss"
 */
export function formatTime(ms) {
  const total = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${String(m).padStart(2, "0")}:${s}`;
}

/** @param {number} mask notes bitmask @returns {number[]} digits in ascending order */
export function noteDigits(mask) {
  const out = [];
  for (let d = 1; d <= 9; d++) if (mask & (1 << (d - 1))) out.push(d);
  return out;
}

/**
 * Accessible name of a cell, e.g. "Row 1, column 3, 1, given".
 * @param {{index:number, value:number, given:boolean, notes?:number, wrong?:boolean, conflict?:boolean}} cell
 * @returns {string}
 */
export function cellLabel({ index, value, given, notes = 0, wrong = false, conflict = false }) {
  const where = `Row ${Math.floor(index / 9) + 1}, column ${(index % 9) + 1}`;
  if (value) {
    if (given) return `${where}, ${value}, given`;
    const flags = [wrong ? "incorrect" : "", conflict ? "conflict" : ""].filter(Boolean);
    return [where, String(value), ...flags].join(", ");
  }
  const digits = noteDigits(notes);
  return digits.length ? `${where}, notes ${digits.join(" ")}` : `${where}, empty`;
}

/** @param {string} difficulty @returns {{label:string, dots:number, text:string}} */
export function difficultyView(difficulty) {
  const meta = DIFFICULTY_META[difficulty] || { label: String(difficulty || ""), dots: 0 };
  return { label: meta.label, dots: meta.dots, text: `${meta.label}, difficulty ${meta.dots} of 4` };
}

/** @param {{filled:number, total:number}} p @returns {{text:string, ratio:number}} */
export function progressView({ filled, total }) {
  return { text: `${filled} of ${total} cells filled`, ratio: total ? filled / total : 1 };
}

/**
 * @typedef {{index:number, value:number, given:boolean, notes:number[], selected:boolean, related:boolean,
 *   same:boolean, conflict:boolean, wrong:boolean, label:string, noteHighlight:number,
 *   hintArea:boolean, hintCell:boolean, hintTarget:boolean, hintMarks:Record<number,'cand'|'elim'>|null}} CellView
 */

/**
 * Compute what every cell shows.
 * @param {object} p
 * @param {{puzzle:number[], values:number[], notes:number[], solution:number[]}} p.state
 * @param {number|null} p.selected selected cell
 * @param {number|null} [p.digit] digit to highlight (number-first selection or the selected cell's value)
 * @param {{highlightRelated:boolean, highlightSameDigit:boolean, showMistakes:boolean}} p.settings
 * @param {Set<number>} [p.flagged] cells marked wrong by Check (until they change)
 * @param {{hint:object, step:number}|null} [p.hint] open/pinned hint (step 0-2)
 * @returns {CellView[]}
 */
export function boardView({ state, selected, digit = null, settings, flagged = new Set(), hint = null }) {
  const { puzzle, values, notes, solution } = state;
  const conflicts = findConflicts(values);
  const related = new Set(
    settings.highlightRelated && Number.isInteger(selected) ? peersOf(selected) : []
  );
  const sameDigit = settings.highlightSameDigit ? digit || (Number.isInteger(selected) ? values[selected] : 0) : 0;

  let area = new Set();
  let cells = new Set();
  let target = -1;
  /** @type {Map<number, Record<number,'cand'|'elim'>>} */
  const marks = new Map();
  if (hint && hint.hint) {
    const h = hint.hint;
    area = new Set((h.houses || []).flatMap((house) => houseCells(house)));
    cells = new Set(h.cells || []);
    if (hint.step >= 1) {
      const mark = (list, kind) => {
        for (const { index, digit: d } of list || []) {
          if (values[index]) continue;
          const m = marks.get(index) || {};
          if (!(m[d] === "elim")) m[d] = kind;
          marks.set(index, m);
        }
      };
      mark(h.candidates, "cand");
      mark(h.eliminations, "elim");
    }
    if (hint.step >= 1 && h.placement) target = h.placement.index;
  }

  const out = new Array(81);
  for (let i = 0; i < 81; i++) {
    const given = puzzle[i] !== 0;
    const value = values[i];
    const wrong = !given && value !== 0 && value !== solution[i] && (settings.showMistakes || flagged.has(i));
    const conflict = !given && conflicts.has(i);
    out[i] = {
      index: i,
      value,
      given,
      notes: value ? [] : noteDigits(notes[i]),
      selected: i === selected,
      related: related.has(i),
      same: sameDigit !== 0 && value === sameDigit,
      conflict,
      wrong,
      label: cellLabel({ index: i, value, given, notes: notes[i], wrong, conflict }),
      noteHighlight: sameDigit && !value && notes[i] & (1 << (sameDigit - 1)) ? sameDigit : 0,
      hintArea: area.has(i),
      hintCell: cells.has(i),
      hintTarget: i === target,
      hintMarks: marks.get(i) || null
    };
  }
  return out;
}

/**
 * Number pad state.
 * @param {Record<number,number>} remaining digit → count left
 * @param {{selectedDigit:number|null, notesMode:boolean}} opts
 * @returns {Array<{digit:number, left:number, disabled:boolean, pressed:boolean, label:string}>}
 */
export function padView(remaining, { selectedDigit = null, notesMode = false } = {}) {
  return Array.from({ length: 9 }, (_, k) => {
    const digit = k + 1;
    const left = remaining[digit] ?? 0;
    const disabled = left === 0 && !notesMode;
    return {
      digit,
      left,
      disabled,
      pressed: selectedDigit === digit,
      label: `${notesMode ? "Note " : ""}${digit}, ${left} left`
    };
  });
}

/**
 * Resolve Settings into the `<html>` data attributes of docs/UI-CONTRACT.md.
 * @param {{theme:string, colorMode:string, textSize:string, reducedMotion:string, colorblind:boolean}} settings
 * @param {{prefersDark?:boolean, prefersReducedMotion?:boolean}} [media]
 * @returns {{theme:string, mode:'light'|'dark', text:string, motion:'reduce'|'full', cb:string|null}}
 */
export function htmlAttributes(settings, { prefersDark = false, prefersReducedMotion = false } = {}) {
  const mode = settings.colorMode === "dark" || (settings.colorMode !== "light" && prefersDark) ? "dark" : "light";
  const motion =
    settings.reducedMotion === "on" || (settings.reducedMotion !== "off" && prefersReducedMotion) ? "reduce" : "full";
  return {
    theme: settings.theme || "graphite",
    mode,
    text: settings.textSize || "default",
    motion,
    cb: settings.colorblind ? "1" : null
  };
}

/**
 * Wrong entries that newly became visible with "show mistakes" on, so the
 * assist is counted once per (cell, digit).
 * @param {{puzzle:number[], values:number[], solution:number[]}} state
 * @param {Set<string>} seen keys "index:digit" already counted (mutated)
 * @returns {number} newly shown wrong entries
 */
export function newlyShownErrors(state, seen) {
  let n = 0;
  for (let i = 0; i < 81; i++) {
    const v = state.values[i];
    if (state.puzzle[i] || !v || v === state.solution[i]) continue;
    const key = `${i}:${v}`;
    if (!seen.has(key)) {
      seen.add(key);
      n++;
    }
  }
  return n;
}
