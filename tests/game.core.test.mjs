import test from "node:test";
import assert from "node:assert/strict";

import { Game } from "../src/game.js";
import { generatePuzzle, peersOf, getHint } from "../src/engine/index.js";

const PUZZLE = [..."530070000600195000098000060800060003400803001700020006060000280000419005000080079"].map(Number);
const SOLUTION = [..."534678912672195348198342567859761423426853791713924856961537284287419635345286179"].map(Number);
const GENERATED = { puzzle: PUZZLE, solution: SOLUTION, difficulty: "easy", grade: { hardest: "naked-single" }, seed: "s1", clueCount: 30, id: "easy-s1" };

const fresh = (opts) => Game.create(GENERATED, opts);
const blanks = (game) => game.state.puzzle.flatMap((v, i) => (v === 0 && game.state.values[i] === 0 ? [i] : []));
const wrongDigit = (game, i) => (game.state.solution[i] % 9) + 1;

function solveAllBut(game, n) {
  const empty = blanks(game);
  for (const i of empty.slice(0, empty.length - n)) game.enterDigit(i, game.state.solution[i]);
  return blanks(game);
}

test("create produces a v2 JSON shape with zeroed assist counters", () => {
  const json = fresh().toJSON();
  assert.equal(json.schema, 2);
  assert.equal(json.id, "easy-s1");
  assert.equal(json.kind, "random");
  assert.equal(json.dailyKey, null);
  assert.equal(json.seed, "s1");
  assert.equal(json.gradeHardest, "naked-single");
  assert.deepEqual(json.values, PUZZLE);
  assert.deepEqual(json.notes, new Array(81).fill(0));
  assert.deepEqual(json.assist, { hints: 0, checks: 0, reveals: 0, errorsShown: 0, autoNotes: 0 });
  assert.equal(json.running, true);
  assert.equal(json.completed, false);
  assert.equal(json.completedAt, null);
  assert.deepEqual(json.history, { actions: [], index: 0 });
  assert.ok(json.createdAt > 0 && json.updatedAt >= json.createdAt);
  assert.equal("gameOverShown" in json, false);
  assert.equal("hints" in json, false);
});

test("create works with real generated puzzles and daily kind", () => {
  const generated = generatePuzzle("easy", { seed: "abc" });
  const game = Game.create(generated, { kind: "daily", dailyKey: "2026-10-28" });
  assert.equal(game.state.kind, "daily");
  assert.equal(game.state.dailyKey, "2026-10-28");
  assert.equal(game.state.id, generated.id);
  assert.deepEqual(game.state.values, generated.puzzle);
  assert.equal(Game.create(generated, { dailyKey: "x" }).state.dailyKey, null, "dailyKey only for daily kind");
});

test("wrong digits always count mistakes, there is no game over", () => {
  const game = fresh();
  const cells = blanks(game);
  for (let k = 0; k < 6; k++) {
    assert.equal(game.enterDigit(cells[k], wrongDigit(game, cells[k])), true);
    assert.equal(game.state.lastEvent, "mistake");
    assert.equal(game.state.mistakes, k + 1);
  }
  game.undo();
  assert.equal(game.state.mistakes, 6, "undo does not refund mistakes");
  game.enterDigit(cells[10], game.state.solution[cells[10]]);
  assert.equal(game.state.mistakes, 6);
  assert.equal(game.state.lastEvent, null);
  assert.equal(game.state.completed, false);
});

test("enterDigit ignores givens, invalid input and repeats", () => {
  const game = fresh();
  assert.equal(game.enterDigit(0, 1), false, "given");
  const i = blanks(game)[0];
  assert.equal(game.enterDigit(i, 0), false);
  assert.equal(game.enterDigit(i, 10), false);
  assert.equal(game.enterDigit(-1, 1), false);
  assert.equal(game.enterDigit(81, 1), false);
  assert.equal(game.enterDigit(i, 1.5), false);
  game.enterDigit(i, game.state.solution[i]);
  assert.equal(game.enterDigit(i, game.state.solution[i]), false, "same digit is a no-op");
  assert.equal(game.state.history.actions.length, 1);
});

test("placing a digit clears own notes and (optionally) the digit from peer notes", () => {
  const game = fresh();
  const target = blanks(game)[0];
  const peer = peersOf(target).find((i) => game.state.values[i] === 0);
  const digit = game.state.solution[target];
  const bit = 1 << (digit - 1);
  game.toggleNote(target, digit);
  game.toggleNote(peer, digit);
  game.toggleNote(peer, digit === 9 ? 8 : 9);
  game.enterDigit(target, digit);
  assert.equal(game.state.notes[target], 0);
  assert.equal(game.state.notes[peer] & bit, 0);
  assert.notEqual(game.state.notes[peer], 0, "other notes stay");
  game.undo();
  assert.ok(game.state.notes[peer] & bit, "undo restores peer notes in one step");
  assert.ok(game.state.notes[target] & bit);

  const keep = fresh();
  keep.toggleNote(peer, digit);
  keep.enterDigit(target, digit, { cleanupNotes: false });
  assert.ok(keep.state.notes[peer] & bit, "cleanupNotes:false keeps peer notes");
});

test("toggleNote only works on empty editable cells", () => {
  const game = fresh();
  const i = blanks(game)[0];
  assert.equal(game.toggleNote(0, 1), false);
  assert.equal(game.toggleNote(i, 0), false);
  assert.equal(game.toggleNote(i, 3), true);
  assert.equal(game.state.notes[i], 1 << 2);
  assert.equal(game.toggleNote(i, 3), true);
  assert.equal(game.state.notes[i], 0);
  game.enterDigit(i, game.state.solution[i]);
  assert.equal(game.toggleNote(i, 3), false);
});

test("erase clears values and notes, never givens, and is undoable", () => {
  const game = fresh();
  const [a, b] = blanks(game);
  assert.equal(game.erase(0), false);
  assert.equal(game.erase(a), false, "nothing to erase");
  game.enterDigit(a, 4);
  game.toggleNote(b, 2);
  assert.equal(game.erase(a), true);
  assert.equal(game.erase(b), true);
  assert.equal(game.state.values[a], 0);
  assert.equal(game.state.notes[b], 0);
  game.undo();
  assert.equal(game.state.notes[b], 2);
});

test("undo/redo round-trip and a new action truncates redo", () => {
  const game = fresh();
  const [first, second] = blanks(game);
  game.toggleNote(first, 1);
  const correct = game.state.solution[first];
  game.enterDigit(first, correct);
  assert.equal(game.canUndo(), true);
  assert.equal(game.undo(), true);
  assert.equal(game.state.values[first], 0);
  assert.equal(game.state.notes[first], 1);
  assert.equal(game.canRedo(), true);
  assert.equal(game.redo(), true);
  assert.equal(game.state.values[first], correct);
  game.undo();
  game.enterDigit(second, game.state.solution[second]);
  assert.equal(game.redo(), false);
  assert.equal(game.state.history.actions.length, 2);
  game.undo();
  game.undo();
  assert.equal(game.undo(), false);
  assert.equal(game.canUndo(), false);
});

test("history is capped and keeps working past the cap", () => {
  const game = fresh();
  const i = blanks(game)[0];
  for (let k = 0; k < 520; k++) game.toggleNote(i, 1);
  assert.equal(game.state.history.actions.length, 500);
  assert.equal(game.state.history.index, 500);
  assert.equal(game.undo(), true);
  assert.equal(Game.fromJSON(game.toJSON()).state.history.index, 499);
});

test("check returns wrong entries and counts an assist each time", () => {
  const game = fresh();
  const [a, b, c] = blanks(game);
  game.enterDigit(a, wrongDigit(game, a));
  game.enterDigit(b, game.state.solution[b]);
  game.enterDigit(c, wrongDigit(game, c));
  assert.deepEqual(game.check(), [a, c].sort((x, y) => x - y));
  assert.equal(game.state.assist.checks, 1);
  game.erase(a);
  game.erase(c);
  assert.deepEqual(game.check(), []);
  assert.equal(game.state.assist.checks, 2);
  assert.deepEqual(game.wrongEntries(), []);
});

test("revealCell fills the solution, counts reveals and is undoable", () => {
  const game = fresh();
  const [a, b] = blanks(game);
  assert.equal(game.revealCell(0), false, "given");
  assert.equal(game.revealCell(a), true);
  assert.equal(game.state.values[a], game.state.solution[a]);
  assert.equal(game.state.assist.reveals, 1);
  assert.equal(game.revealCell(a), false, "already correct");
  assert.equal(game.state.assist.reveals, 1);
  game.enterDigit(b, wrongDigit(game, b));
  assert.equal(game.revealCell(b), true, "replaces a wrong entry");
  assert.equal(game.state.assist.reveals, 2);
  game.undo();
  assert.equal(game.state.values[b], wrongDigit(game, b));
  assert.equal(game.state.assist.reveals, 2, "undo keeps the assist");
});

test("fillNotes writes candidates for every empty cell as one undoable action", () => {
  const game = fresh();
  const i = blanks(game)[0];
  game.toggleNote(i, 9);
  assert.equal(game.fillNotes(), true);
  assert.equal(game.state.assist.autoNotes, 1);
  for (const j of blanks(game)) {
    const peers = new Set(peersOf(j).map((p) => game.state.values[p]));
    for (let d = 1; d <= 9; d++) {
      assert.equal(Boolean(game.state.notes[j] & (1 << (d - 1))), !peers.has(d), `cell ${j} digit ${d}`);
    }
  }
  for (let j = 0; j < 81; j++) if (game.state.values[j]) assert.equal(game.state.notes[j], 0);
  const actions = game.state.history.actions.length;
  game.undo();
  assert.equal(game.state.notes[i], 1 << 8, "undo restores user notes");
  assert.equal(actions, 2);
});

test("clearNotes removes all notes in one undoable action without an assist", () => {
  const game = fresh();
  const [a, b] = blanks(game);
  game.toggleNote(a, 1);
  game.toggleNote(b, 2);
  assert.equal(game.clearNotes(), true);
  assert.ok(game.state.notes.every((n) => n === 0));
  assert.equal(game.clearNotes(), false, "nothing left");
  game.undo();
  assert.equal(game.state.notes[a], 1);
  assert.equal(game.state.notes[b], 2);
  assert.deepEqual(game.state.assist, { hints: 0, checks: 0, reveals: 0, errorsShown: 0, autoNotes: 0 });
});

test("hintShown counts once per hint object; applyHint places without another count", () => {
  const game = fresh();
  const hint = getHint(game.state.values, game.state.notes, game.state.solution);
  assert.ok(hint);
  assert.equal(game.hintShown(hint), true);
  assert.equal(game.hintShown(hint), false);
  assert.equal(game.state.assist.hints, 1);
  assert.equal(game.applyHint(hint), true);
  assert.equal(game.state.values[hint.placement.index], hint.placement.digit);
  assert.equal(game.state.assist.hints, 1);
  assert.equal(game.applyHint(hint), false, "already applied");
  assert.equal(game.applyHint(null), false);
  assert.equal(game.applyHint({ placement: { index: 0, digit: 5 } }), false, "given");
  const next = getHint(game.state.values, game.state.notes, game.state.solution);
  game.hintShown(next);
  assert.equal(game.state.assist.hints, 2);
  game.hintShown();
  assert.equal(game.state.assist.hints, 3, "no-arg call always counts");
  game.undo();
  assert.equal(game.state.values[hint.placement.index], 0, "applyHint is undoable");
});

test("incorrect-entry hints replace the wrong digit", () => {
  const game = fresh();
  const i = blanks(game)[0];
  game.enterDigit(i, wrongDigit(game, i));
  const hint = getHint(game.state.values, game.state.notes, game.state.solution);
  assert.equal(hint.technique, "incorrect-entry");
  game.applyHint(hint);
  assert.equal(game.state.values[i], game.state.solution[i]);
  assert.equal(game.state.mistakes, 1);
});

test("markErrorsShown accumulates positive integers only", () => {
  const game = fresh();
  game.markErrorsShown(2);
  game.markErrorsShown(0);
  game.markErrorsShown(-1);
  game.markErrorsShown(1.5);
  assert.equal(game.state.assist.errorsShown, 2);
});

test("timer counts only running time and pause/resume work", () => {
  const game = fresh();
  game.tick(1000);
  game.tick(3000);
  assert.equal(game.state.elapsedMs, 2000);
  assert.equal(game.pause(4000), true);
  assert.equal(game.state.elapsedMs, 3000);
  assert.equal(game.pause(5000), false);
  game.tick(60000);
  assert.equal(game.state.elapsedMs, 3000);
  assert.equal(game.resume(), true);
  assert.equal(game.resume(), false);
  game.tick(70000);
  game.tick(70500);
  assert.equal(game.state.elapsedMs, 3500, "first tick after resume only sets the reference");
  game.tick(70400);
  assert.equal(game.state.elapsedMs, 3500, "clock going backwards is ignored");
  game.tick(NaN);
  assert.equal(game.state.elapsedMs, 3500);
});

test("winning completes the game once, stops the timer and blocks further edits", () => {
  const game = fresh();
  const [last] = solveAllBut(game, 1);
  assert.equal(game.isWon(), false);
  assert.deepEqual(game.progress(), { filled: 50, total: 51 });
  game.enterDigit(last, game.state.solution[last]);
  assert.equal(game.state.lastEvent, "win");
  assert.equal(game.state.completed, true);
  assert.equal(game.state.running, false);
  assert.ok(game.state.completedAt > 0);
  assert.equal(game.isWon(), true);
  assert.equal(game.enterDigit(last, 1), false);
  assert.equal(game.undo(), false);
  assert.equal(game.check().length, 0);
  assert.equal(game.state.assist.checks, 0, "no assists after completion");
  for (let d = 1; d <= 9; d++) assert.equal(game.remainingCounts()[d], 0);
});

test("winning via reveal, hint or after correcting a wrong entry also completes", () => {
  const byReveal = fresh();
  byReveal.revealCell(solveAllBut(byReveal, 1)[0]);
  assert.equal(byReveal.state.lastEvent, "win");

  const byRedo = fresh();
  const [last] = solveAllBut(byRedo, 1);
  byRedo.enterDigit(last, wrongDigit(byRedo, last));
  byRedo.enterDigit(last, byRedo.state.solution[last]);
  assert.equal(byRedo.state.completed, true);

  const byHint = fresh();
  solveAllBut(byHint, 1);
  byHint.applyHint(getHint(byHint.state.values, byHint.state.notes, byHint.state.solution));
  assert.equal(byHint.state.completed, true);
});

test("remainingCounts and progress reflect entries", () => {
  const game = fresh();
  const total = PUZZLE.filter((v) => v === 0).length;
  assert.deepEqual(game.progress(), { filled: 0, total });
  const counts = game.remainingCounts();
  for (let d = 1; d <= 9; d++) assert.equal(counts[d], 9 - PUZZLE.filter((v) => v === d).length);
  const i = blanks(game)[0];
  const d = game.state.solution[i];
  game.enterDigit(i, d);
  assert.equal(game.remainingCounts()[d], counts[d] - 1);
  assert.deepEqual(game.progress(), { filled: 1, total });
  game.toggleNote(blanks(game)[0], 1);
  assert.deepEqual(game.progress(), { filled: 1, total }, "notes are not filled cells");
});

test("restart clears progress but keeps assist counters and identity", () => {
  const game = fresh();
  const [a, b, c] = blanks(game);
  game.enterDigit(a, wrongDigit(game, a));
  game.toggleNote(b, 2);
  game.revealCell(c);
  game.check();
  game.hintShown();
  game.fillNotes();
  game.tick(1000);
  game.tick(5000);
  game.pause(6000);
  const before = game.toJSON();
  assert.equal(game.restart(), game);
  const s = game.state;
  assert.deepEqual(s.values, PUZZLE);
  assert.deepEqual(s.notes, new Array(81).fill(0));
  assert.equal(s.mistakes, 0);
  assert.equal(s.elapsedMs, 0);
  assert.equal(s.running, true);
  assert.equal(s.completed, false);
  assert.deepEqual(s.history, { actions: [], index: 0 });
  assert.deepEqual(s.assist, before.assist);
  assert.deepEqual(s.assist, { hints: 1, checks: 1, reveals: 1, errorsShown: 0, autoNotes: 1 });
  assert.equal(s.id, before.id);
  assert.equal(s.createdAt, before.createdAt);
});

test("restart after a win reopens the puzzle", () => {
  const game = fresh();
  game.revealCell(solveAllBut(game, 1)[0]);
  game.restart();
  assert.equal(game.state.completed, false);
  assert.equal(game.state.completedAt, null);
  assert.equal(game.state.assist.reveals, 1);
});

test("toJSON/fromJSON round-trip preserves everything including undo history", () => {
  const game = fresh({ kind: "daily", dailyKey: "2026-10-28" });
  const [a, b] = blanks(game);
  game.enterDigit(a, wrongDigit(game, a));
  game.toggleNote(b, 5);
  game.check();
  const json = game.toJSON();
  const restored = Game.fromJSON(JSON.parse(JSON.stringify(json)));
  assert.deepEqual(restored.toJSON(), json);
  assert.equal(restored.undo(), true);
  assert.equal(restored.state.notes[b], 0);
  assert.equal(restored.undo(), true);
  assert.equal(restored.state.values[a], 0);
  // the copy is independent
  json.values[a] = 9;
  assert.notEqual(game.state.values[a], 9);
});

test("fromJSON upgrades v1 saves", () => {
  const v1 = {
    difficulty: "medium",
    puzzle: PUZZLE, solution: SOLUTION, values: PUZZLE.slice(), notes: new Array(81).fill(0),
    mistakes: 3, hints: 2, elapsedMs: 12345, running: false, completed: false, gameOverShown: true,
    history: { actions: [{ cells: [{ i: 2, before: { v: 0, n: 0 }, after: { v: 0, n: 1 } }] }], index: 1 },
    createdAt: 1700000000000
  };
  v1.notes[2] = 1;
  const game = Game.fromJSON(v1);
  const json = game.toJSON();
  assert.equal(json.schema, 2);
  assert.deepEqual(json.assist, { hints: 2, checks: 0, reveals: 0, errorsShown: 0, autoNotes: 0 });
  assert.equal(json.mistakes, 3);
  assert.equal(json.kind, "random");
  assert.equal(json.id, "legacy-1700000000000");
  assert.equal(json.updatedAt, 1700000000000);
  assert.equal("gameOverShown" in json, false);
  assert.equal("hints" in json, false);
  assert.equal(game.undo(), true);
  assert.equal(game.state.notes[2], 0);
  assert.equal(Game.fromJSON({ ...v1, id: "keep" }).state.id, "keep");
});

test("fromJSON rejects corrupt payloads", () => {
  const good = fresh().toJSON();
  const bad = [
    null, [], "x", {},
    { ...good, schema: 3 },
    { ...good, difficulty: "insane" },
    { ...good, puzzle: good.puzzle.slice(1) },
    { ...good, values: good.values.map((v, i) => (i === 0 ? 1 : v)) },
    { ...good, solution: good.solution.map((v, i) => (i === 2 ? v % 9 + 1 : v)) },
    { ...good, notes: good.notes.map(() => 512) },
    { ...good, mistakes: -1 },
    { ...good, elapsedMs: Infinity },
    { ...good, running: "yes" },
    { ...good, assist: { ...good.assist, hints: -1 } },
    { ...good, assist: undefined },
    { ...good, history: { actions: [], index: 1 } },
    { ...good, history: { actions: [{ cells: [{ i: 99, before: { v: 0, n: 0 }, after: { v: 1, n: 0 } }] }], index: 1 } },
    { ...good, completed: true }
  ];
  for (const data of bad) assert.throws(() => Game.fromJSON(data), TypeError);
});

test("a completed save restores as completed and not running", () => {
  const game = fresh();
  game.revealCell(solveAllBut(game, 1)[0]);
  const restored = Game.fromJSON({ ...game.toJSON(), running: true });
  assert.equal(restored.state.completed, true);
  assert.equal(restored.state.running, false);
  assert.equal(restored.state.completedAt, game.state.completedAt);
});
