import test from "node:test";
import assert from "node:assert/strict";

import {
  DIFFICULTIES,
  countSolutions,
  findConflicts,
  generatePuzzle,
  getPeers,
  isBoardComplete,
  solve
} from "../src/sudoku.js";
const PUZZLE = [..."530070000600195000098000060800060003400803001700020006060000280000419005000080079"].map(
  Number
);
const SOLUTION = [
  ..."534678912672195348198342567859761423426853791713924856961537284287419635345286179"
].map(Number);

function emptyBoard() {
  return new Array(81).fill(0);
}

test("solve solves a known puzzle and returns null for invalid input", () => {
  const input = PUZZLE.slice();
  assert.deepEqual(solve(input), SOLUTION);
  assert.deepEqual(input, PUZZLE, "solve must not mutate its input");

  const duplicate = emptyBoard();
  duplicate[0] = 1;
  duplicate[1] = 1;
  assert.equal(solve(duplicate), null);

  assert.equal(solve(new Array(80).fill(0)), null);
});

test("countSolutions handles contradictions, unique puzzles, and the empty board", () => {
  const contradictory = emptyBoard();
  contradictory[0] = 5;
  contradictory[1] = 5;
  assert.equal(countSolutions(contradictory, 2), 0);

  assert.equal(countSolutions(PUZZLE, 2), 1);
  assert.equal(countSolutions(SOLUTION, 2), 1);

  const start = Date.now();
  assert.equal(countSolutions(emptyBoard(), 2), 2);
  assert.equal(countSolutions(emptyBoard(), 1), 1);
  assert.ok(Date.now() - start < 1000, "empty-board counting should be fast");
});

test("findConflicts flags duplicate digits and ignores legal boards", () => {
  assert.equal(findConflicts(SOLUTION).size, 0);

  const partial = emptyBoard();
  partial[0] = 5;
  partial[1] = 3;
  partial[9] = 7;
  assert.equal(findConflicts(partial).size, 0);

  const duplicate = emptyBoard();
  duplicate[0] = 5;
  duplicate[1] = 5;
  duplicate[9] = 5;
  const conflicts = findConflicts(duplicate);
  assert.ok(conflicts.has(0));
  assert.ok(conflicts.has(1));
  assert.ok(conflicts.has(9));
});

test("getPeers returns 20 unique row, column, and box peers", () => {
  for (const index of [0, 4, 40, 80]) {
    const peers = getPeers(index);
    assert.equal(peers.length, 20);
    assert.equal(new Set(peers).size, 20);
    assert.ok(!peers.includes(index));
  }
});

test("generated puzzles are unique, complete, and inside difficulty ranges", () => {
  for (const difficulty of Object.keys(DIFFICULTIES)) {
    const config = DIFFICULTIES[difficulty];
    for (const seed of [1, 2, 3]) {
      const start = Date.now();
      const result = generatePuzzle(difficulty, { seed });
      const elapsed = Date.now() - start;

      assert.ok(
        elapsed < 2000,
        `${difficulty} seed ${seed} took ${elapsed}ms`
      );
      assert.equal(result.difficulty, difficulty);
      assert.equal(result.puzzle.length, 81);
      assert.equal(result.solution.length, 81);

      let clueCount = 0;
      for (let i = 0; i < 81; i++) {
        if (result.puzzle[i] !== 0) {
          clueCount++;
          assert.equal(
            result.puzzle[i],
            result.solution[i],
            `given ${i} must match the solution`
          );
        }
      }
      assert.equal(result.clueCount, clueCount);
      assert.ok(
        clueCount >= config.min && clueCount <= config.max,
        `${difficulty} seed ${seed} clueCount ${clueCount} outside [${config.min}, ${config.max}]`
      );
      assert.ok(isBoardComplete(result.solution));
      assert.equal(findConflicts(result.solution).size, 0);
      assert.equal(countSolutions(result.puzzle, 2), 1);
    }
  }
});

test("DIFFICULTIES ranges are ordered and contain their targets", () => {
  assert.deepEqual(Object.keys(DIFFICULTIES), ["easy", "medium", "hard", "expert"]);

  for (const config of Object.values(DIFFICULTIES)) {
    assert.ok(config.min <= config.target);
    assert.ok(config.target <= config.max);
    assert.ok(config.min > 0);
  }

  assert.ok(DIFFICULTIES.easy.min > DIFFICULTIES.medium.max);
  assert.ok(DIFFICULTIES.medium.min > DIFFICULTIES.hard.max);
  assert.ok(DIFFICULTIES.hard.min > DIFFICULTIES.expert.max);
});
