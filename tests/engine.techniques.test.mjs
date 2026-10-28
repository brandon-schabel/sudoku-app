import test from "node:test";
import assert from "node:assert/strict";
import { HINT_FIXTURES } from "../src/engine/tools/hint-fixtures.js";
import { PUBLISHED_FIXTURES } from "../src/engine/tools/published-fixtures.js";
import {
  computeCandidates,
  getHint,
  solve,
  TECHNIQUES,
} from "../src/engine/index.js";
import { techniqueSteps, applyStep } from "../src/engine/techniques.js";
const canonical = (values) =>
  values.slice().sort((a, b) => a.index - b.index || a.digit - b.digit);
const ascending = (values) => values.slice().sort((a, b) => a - b);

test("every technique is sound under four rotations and digit relabeling", () => {
  for (const fixture of HINT_FIXTURES)
    for (let turns = 0; turns < 4; turns++)
      for (const reverse of [false, true]) {
        const rotate = (index) => {
          for (let n = 0; n < turns; n++)
            index = (index % 9) * 9 + 8 - Math.floor(index / 9);
          return index;
        };
        const digitMap = (digit) => (!digit || !reverse ? digit : 10 - digit);
        const board = Array(81).fill(0);
        [...fixture.puzzle].map(Number).forEach((v, i) => {
          board[rotate(i)] = digitMap(v);
        });
        const c = computeCandidates(board),
          solution = solve(board);
        for (const step of fixture.chain) {
          const cells = ascending(step.cells.map(rotate)),
            eliminations = canonical(
              step.eliminations.map(({ index, digit }) => ({
                index: rotate(index),
                digit: digitMap(digit),
              })),
            );
          const placement = step.placement
            ? {
                index: rotate(step.placement.index),
                digit: digitMap(step.placement.digit),
              }
            : null;
          const matching = [...techniqueSteps(board, c, step.technique)].find(
            (s) =>
              JSON.stringify(s.cells) === JSON.stringify(cells) &&
              JSON.stringify(s.eliminations) === JSON.stringify(eliminations) &&
              JSON.stringify(s.placement) === JSON.stringify(placement),
          );
          assert.ok(
            matching,
            `${fixture.technique}, ${turns} turns, reverse ${reverse}: ${step.technique}`,
          );
          if (placement)
            assert.equal(placement.digit, solution[placement.index]);
          for (const e of eliminations)
            assert.notEqual(e.digit, solution[e.index]);
          applyStep(board, c, matching);
        }
      }
});
test("column X-wing and row skyscraper remove exactly the published candidates", () => {
  const examples = [
    [
      "bf202",
      "x-wing",
      [9, 13, 36, 40],
      [12, 15, 16, 17, 38, 39, 42, 43, 44],
      1,
    ],
    ["sk02", "skyscraper", [9, 13, 63, 66], [3], 4],
  ];
  for (const [id, technique, cells, indices, digit] of examples) {
    const board = [...PUBLISHED_FIXTURES[id].puzzle].map(Number),
      step = techniqueSteps(board, computeCandidates(board), technique).next()
        .value;
    assert.deepEqual(step.cells, cells);
    assert.deepEqual(
      step.eliminations,
      indices.map((index) => ({ index, digit })),
    );
    assert.equal(step.placement, null);
  }
});
test("focused hints exhaust only equal-or-lower-rank eliminations and remain correct", () => {
  const fixtures = [
    ...[
      "bf201",
      "bf301",
      "bf302",
      "xy01",
      "xyz01",
      "xyz02",
      "sk01",
      "lc201",
      "h301",
      "h302",
    ].map((id) => ({ id, ...PUBLISHED_FIXTURES[id] })),
    ...HINT_FIXTURES.filter((f) => f.technique === "naked-triple"),
  ];
  for (const { id, puzzle } of fixtures) {
    const board = [...puzzle].map(Number),
      solution = solve(board),
      plain = getHint(board, [], solution),
      rank = TECHNIQUES[plain.technique].rank;
    const c = computeCandidates(board);
    // Independent elimination closure enumerates every reachable single without placing any.
    while (true) {
      let changed = false;
      for (const [technique, meta] of Object.entries(TECHNIQUES))
        if (meta.rank <= rank) {
          const step = [...techniqueSteps(board, c, technique)].find(
            (s) => s.eliminations.length,
          );
          if (step) {
            applyStep(board.slice(), c, step);
            changed = true;
            break;
          }
        }
      if (!changed) break;
    }
    const reachable = new Set(
      ["full-house", "naked-single", "hidden-single"].flatMap((t) =>
        [...techniqueSteps(board, c, t)].map((s) => s.placement.index),
      ),
    );
    for (const focusIndex of reachable) {
      const hint = getHint(board, [], solution, { focusIndex });
      assert.equal(
        hint.placement.index,
        focusIndex,
        `${id}: focus ${focusIndex}`,
      );
      assert.equal(hint.placement.digit, solution[focusIndex]);
      assert.ok(TECHNIQUES[hint.technique].rank <= rank);
    }
  }
});
