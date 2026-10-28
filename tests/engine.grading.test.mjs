import test from "node:test";
import assert from "node:assert/strict";
import { GRADING_FIXTURES } from "../src/engine/tools/grading-fixtures.js";
import {
  DIFFICULTIES,
  grade,
  solve,
  countSolutions,
  computeCandidates,
} from "../src/engine/index.js";
import { techniqueSteps } from "../src/engine/techniques.js";

// Independent singles-only oracle: sets and direct row/column/box scans, without
// the engine's candidate masks, steps, ranks, or grading implementation.
function singlesClosure(puzzle, hidden) {
  const board = puzzle.slice();
  const houses = [];
  for (let n = 0; n < 9; n++) {
    houses.push(Array.from({ length: 9 }, (_, k) => n * 9 + k));
    houses.push(Array.from({ length: 9 }, (_, k) => k * 9 + n));
    houses.push(
      Array.from(
        { length: 9 },
        (_, k) =>
          Math.floor(n / 3) * 27 +
          (n % 3) * 3 +
          Math.floor(k / 3) * 9 +
          (k % 3),
      ),
    );
  }
  while (board.includes(0)) {
    const candidates = board.map((v, i) => {
      if (v) return [];
      const used = new Set(
        houses
          .filter((h) => h.includes(i))
          .flatMap((h) => h.map((j) => board[j])),
      );
      return [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => !used.has(d));
    });
    const naked = candidates.findIndex((c) => c.length === 1);
    if (naked >= 0) {
      board[naked] = candidates[naked][0];
      continue;
    }
    let placement;
    if (hidden)
      for (const house of houses) {
        for (let digit = 1; digit <= 9; digit++) {
          const cells = house.filter((i) => candidates[i].includes(digit));
          if (cells.length === 1) {
            placement = [cells[0], digit];
            break;
          }
        }
        if (placement) break;
      }
    if (!placement) break;
    board[placement[0]] = placement[1];
  }
  return board;
}

test("each tier has at least five distinct externally published grading fixtures", () => {
  for (const d of DIFFICULTIES) {
    const fixtures = GRADING_FIXTURES.filter((f) => f.difficulty === d);
    assert.ok(fixtures.length >= 5, d);
    assert.equal(new Set(fixtures.map((f) => f.puzzle)).size, fixtures.length);
    for (const f of fixtures)
      assert.match(f.source, /^https:\/\/hodoku\.sourceforge\.net\//);
  }
});

for (const fixture of GRADING_FIXTURES)
  test(`published ${fixture.difficulty} calibration: ${fixture.id} requires ${fixture.hardest}`, () => {
    const board = Object.freeze([...fixture.puzzle].map(Number));
    assert.equal(board.length, 81);
    assert.equal(countSolutions(board), 1, fixture.source);
    const result = grade(board);
    assert.equal(result.difficulty, fixture.difficulty, fixture.source);
    assert.equal(result.hardest, fixture.hardest);
    assert.ok(result.counts[fixture.hardest] > 0);
    assert.equal(result.solved, true);
    if (fixture.publishedPlacement) {
      assert.ok(
        [
          ...techniqueSteps(board, computeCandidates(board), fixture.hardest),
        ].some(
          (s) =>
            s.placement.index === fixture.publishedPlacement.index &&
            s.placement.digit === fixture.publishedPlacement.digit,
        ),
        "published placement is independently identifiable",
      );
    }
    if (fixture.publishedPosition) {
      const position = [...fixture.publishedPosition].map(Number);
      assert.deepEqual(solve(position), solve(board));
      assert.ok(
        techniqueSteps(
          position,
          computeCandidates(position),
          fixture.hardest,
        ).next().value,
        "named pattern exists in the separately published solving position",
      );
    }
    if (fixture.difficulty === "easy")
      assert.deepEqual(singlesClosure(board, false), solve(board));
    if (fixture.difficulty === "medium") {
      assert.ok(
        singlesClosure(board, false).includes(0),
        "naked singles alone cannot solve this published puzzle",
      );
      assert.deepEqual(
        singlesClosure(board, true),
        solve(board),
        "hidden singles suffice independently of grade()",
      );
    }
    if (["hard", "expert"].includes(fixture.difficulty))
      assert.ok(
        singlesClosure(board, true).includes(0),
        "all singles are insufficient",
      );
  });
