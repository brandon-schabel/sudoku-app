import test from "node:test";
import assert from "node:assert/strict";
import { HINT_FIXTURES } from "../src/engine/tools/hint-fixtures.js";
import { PUBLISHED_FIXTURES } from "../src/engine/tools/published-fixtures.js";
import {
  TECHNIQUES,
  getHint,
  computeCandidates,
  solve,
  countSolutions,
  grade,
  generatePuzzle,
  findNextStep,
} from "../src/engine/index.js";
import { techniqueSteps, applyStep } from "../src/engine/techniques.js";

for (const fixture of HINT_FIXTURES)
  test(`${fixture.technique}: exact hint pattern, eliminations and placement (${fixture.id})`, () => {
    const board = Object.freeze([...fixture.puzzle].map(Number)),
      solution = Object.freeze(solve(board)),
      notes = Object.freeze(Array(81).fill(511));
    assert.equal(countSolutions(board), 1, fixture.source);
    const hint = getHint(board, notes, solution);
    assert.equal(hint.technique, fixture.technique);
    assert.equal(hint.techniqueName, TECHNIQUES[fixture.technique].name);
    assert.deepEqual(hint.cells, fixture.cells);
    assert.deepEqual(hint.eliminations, fixture.eliminations);
    assert.deepEqual(hint.placement, fixture.placement);
    assert.deepEqual(
      hint.chain.map(({ technique, cells, eliminations, placement }) => ({
        technique,
        cells,
        eliminations,
        placement,
      })),
      fixture.chain,
    );
    assert.equal(hint.placement.digit, solution[hint.placement.index]);
    assert.deepEqual(hint.chain.at(-1).placement, hint.placement);
    assert.deepEqual(
      hint.steps.map((s) => s.kind),
      ["highlight", "explain", "fill"],
    );
    assert.ok(hint.steps.every((s) => s.text.trim().length));
    assert.match(
      hint.steps[2].text,
      /^Place [1-9] in row [1-9], column [1-9]\.$/,
    );
    assert.deepEqual(hint.steps[0].cells, hint.cells);
    assert.deepEqual(hint.steps[1].eliminations, hint.eliminations);
    assert.deepEqual(hint.steps[2].placement, hint.placement);
    assert.deepEqual(
      getHint(board, Object.freeze(Array(81).fill(0)), solution),
      hint,
      "user notes must not influence reasoning",
    );
    const values = board.slice(),
      candidates = computeCandidates(board);
    for (const step of hint.chain) {
      const matches = [...techniqueSteps(values, candidates, step.technique)];
      assert.ok(
        matches.some(
          (s) =>
            JSON.stringify(s.cells) === JSON.stringify(step.cells) &&
            JSON.stringify(s.placement) === JSON.stringify(step.placement) &&
            step.eliminations.every((e) =>
              s.eliminations.some(
                (x) => x.index === e.index && x.digit === e.digit,
              ),
            ),
        ),
        `chain step must be independently available: ${step.technique}`,
      );
      for (const e of step.eliminations) {
        assert.ok(candidates[e.index] & (1 << (e.digit - 1)));
        assert.notEqual(e.digit, solution[e.index]);
      }
      if (step.placement)
        assert.equal(step.placement.digit, solution[step.placement.index]);
      applyStep(values, candidates, step);
    }
  });
test("all human techniques have fixture hints", () => {
  assert.deepEqual(
    [...new Set(HINT_FIXTURES.map((f) => f.technique))].sort(),
    Object.keys(TECHNIQUES)
      .filter((t) => t !== "incorrect-entry")
      .sort(),
  );
});
test("incorrect entry overrides deductions and respects focus among wrong entries", () => {
  const g = generatePuzzle("medium", { seed: "wrong" }),
    board = g.puzzle.slice(),
    blanks = board.flatMap((v, i) => (v ? [] : [i]));
  board[blanks[0]] = (g.solution[blanks[0]] % 9) + 1;
  board[blanks[1]] = (g.solution[blanks[1]] % 9) + 1;
  const hint = getHint(Object.freeze(board), [], g.solution, {
    focusIndex: blanks[1],
  });
  assert.equal(hint.technique, "incorrect-entry");
  assert.deepEqual(hint.cells, [blanks[1]]);
  assert.deepEqual(hint.eliminations, []);
  assert.deepEqual(hint.placement, {
    index: blanks[1],
    digit: g.solution[blanks[1]],
  });
  assert.deepEqual(
    hint.steps.map((s) => s.kind),
    ["highlight", "explain", "fill"],
  );
  assert.ok(hint.steps.every((s) => s.text.trim()));
  assert.equal(
    getHint(board, [], g.solution, { focusIndex: blanks[2] }).placement.index,
    blanks[0],
  );
});
test("focus prefers equal-rank singles without choosing harder techniques", () => {
  const solution = solve([...HINT_FIXTURES[0].puzzle].map(Number)),
    board = solution.slice();
  board[0] = board[80] = 0;
  const ordinary = getHint(board, [], solution),
    focused = getHint(board, [], solution, { focusIndex: 80 });
  assert.equal(ordinary.technique, "full-house");
  assert.equal(ordinary.placement.index, 0);
  assert.equal(focused.technique, "full-house");
  assert.deepEqual(focused.placement, { index: 80, digit: solution[80] });
  const hard = [...PUBLISHED_FIXTURES.h101.puzzle].map(Number),
    c = computeCandidates(hard),
    singles = [...techniqueSteps(hard, c, "hidden-single")];
  const focus = singles.at(-1).placement.index;
  assert.equal(
    getHint(hard, [], solve(hard), { focusIndex: focus }).placement.index,
    focus,
  );
});
test("focus can prefer a placement after eliminations and irrelevant simpler eliminations are pruned", () => {
  const f = HINT_FIXTURES.find((f) => f.technique === "swordfish"),
    board = [...f.puzzle].map(Number),
    solution = solve(board);
  const candidates = computeCandidates(board),
    pattern = [...techniqueSteps(board, candidates, "swordfish")][0];
  applyStep(board, candidates, pattern);
  const placements = ["naked-single", "hidden-single"].flatMap((t) => [
    ...techniqueSteps(board, candidates, t),
  ]);
  for (const step of placements) {
    const hint = getHint([...f.puzzle].map(Number), [], solution, {
      focusIndex: step.placement.index,
    });
    assert.equal(hint.technique, "swordfish");
    assert.equal(hint.placement.index, step.placement.index);
  }
  const triple = HINT_FIXTURES.find((f) => f.technique === "naked-triple");
  assert.equal(triple.chain.length, 2);
});
test("all deductions on published positions preserve independently solved grids", () => {
  for (const fixture of Object.values(PUBLISHED_FIXTURES)) {
    const board = [...fixture.puzzle].map(Number),
      solution = solve(board),
      candidates = computeCandidates(board);
    assert.equal(countSolutions(board), 1);
    assert.deepEqual(solve([...fixture.original].map(Number)), solution);
    for (const technique of Object.keys(TECHNIQUES))
      for (const step of techniqueSteps(board, candidates, technique)) {
        for (const { index, digit } of step.eliminations)
          assert.notEqual(
            solution[index],
            digit,
            `${fixture.source}: ${technique} ${index}`,
          );
        if (step.placement)
          assert.equal(solution[step.placement.index], step.placement.digit);
      }
  }
});
test("simplest-first grade counts match replay and all replay steps are sound", () => {
  for (const difficulty of ["easy", "medium", "hard", "expert"])
    for (let seed = 0; seed < 10; seed++) {
      const g = generatePuzzle(difficulty, { seed: `replay:${seed}` }),
        board = g.puzzle.slice(),
        candidates = computeCandidates(board),
        counts = {};
      let hardest = null,
        steps = 0,
        score = 0;
      while (board.includes(0)) {
        const before = JSON.stringify([board, candidates]),
          step = findNextStep(board, candidates);
        assert.equal(JSON.stringify([board, candidates]), before);
        assert.ok(step);
        for (const e of step.eliminations)
          assert.notEqual(g.solution[e.index], e.digit);
        if (step.placement)
          assert.equal(g.solution[step.placement.index], step.placement.digit);
        assert.ok(
          !Object.keys(TECHNIQUES).some(
            (t) =>
              TECHNIQUES[t].rank < TECHNIQUES[step.technique].rank &&
              techniqueSteps(board, candidates, t).next().value,
          ),
        );
        counts[step.technique] = (counts[step.technique] ?? 0) + 1;
        steps++;
        score += TECHNIQUES[step.technique].rank + 1;
        if (
          !hardest ||
          TECHNIQUES[step.technique].rank > TECHNIQUES[hardest].rank
        )
          hardest = step.technique;
        applyStep(board, candidates, step);
      }
      assert.deepEqual(board, g.solution);
      assert.deepEqual(grade(g.puzzle), {
        difficulty,
        hardest,
        steps,
        score,
        counts,
        solved: true,
      });
    }
});
test("hints repeatedly solve all tiers with correct placements using hostile notes", () => {
  for (const difficulty of ["easy", "medium", "hard", "expert"])
    for (let seed = 0; seed < 5; seed++) {
      const g = generatePuzzle(difficulty, { seed: `hints:${seed}` }),
        board = g.puzzle.slice();
      let calls = 0;
      while (board.includes(0)) {
        const hint = getHint(board, Array(81).fill(1), g.solution, {
          focusIndex: (calls * 17) % 81,
        });
        assert.ok(hint);
        assert.equal(board[hint.placement.index], 0);
        assert.equal(hint.placement.digit, g.solution[hint.placement.index]);
        board[hint.placement.index] = hint.placement.digit;
        calls++;
        assert.ok(calls <= 81);
      }
      assert.deepEqual(board, g.solution);
      assert.equal(getHint(board, [], g.solution), null);
    }
});
test("completed and unsupported positions have no invented placement", () => {
  const solution = solve([...HINT_FIXTURES[0].puzzle].map(Number));
  assert.equal(getHint(solution, [], solution), null);
  assert.equal(getHint(Array(81).fill(0), [], solution), null);
  assert.equal(findNextStep(Array(81).fill(0)), null);
});
test("findNextStep treats explicit null candidates as omitted candidates", () => {
  for (const fixture of HINT_FIXTURES) {
    const board = Object.freeze([...fixture.puzzle].map(Number));
    assert.deepEqual(findNextStep(board, null), findNextStep(board));
  }
});
test("getHint rejects placements inconsistent with the supplied solution, including focused chains", () => {
  for (const fixture of HINT_FIXTURES) {
    const board = Object.freeze([...fixture.puzzle].map(Number));
    const solution = solve(board), hint = getHint(board, [], solution);
    const mismatched = solution.slice();
    mismatched[hint.placement.index] = hint.placement.digit % 9 + 1;
    assert.equal(getHint(board, [], mismatched), null);
    assert.equal(getHint(board, [], mismatched, {focusIndex: hint.placement.index}), null);
  }
});
