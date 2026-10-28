import test from "node:test";
import assert from "node:assert/strict";
import {
  DIFFICULTIES,
  generatePuzzle,
  generatePuzzleAsync,
  grade,
  countSolutions,
  findConflicts,
  solve,
  createRng,
  dailyKey,
  dailyPuzzle,
  DAILY_VERSION,
} from "../src/engine/index.js";
import { PUZZLE_BANK } from "../src/engine/bank.js";

test("all bank sources are unique, independently solvable and graded at their declared tier", () => {
  assert.ok(PUZZLE_BANK.hard.length >= 60);
  assert.ok(PUZZLE_BANK.expert.length >= 60);
  for (const difficulty of DIFFICULTIES) {
    assert.ok(PUZZLE_BANK[difficulty].length >= 5);
    const seen = new Set();
    for (const fixture of PUZZLE_BANK[difficulty]) {
      assert.ok(!seen.has(fixture.puzzle));
      seen.add(fixture.puzzle);
      const board = [...fixture.puzzle].map(Number),
        result = grade(board);
      assert.equal(countSolutions(board), 1);
      assert.equal(
        result.difficulty,
        difficulty,
        `${difficulty} bank seed ${fixture.seed}`,
      );
      assert.equal(result.hardest, fixture.hardest);
      assert.equal(result.solved, true);
      assert.equal(findConflicts(solve(board)).size, 0);
    }
  }
});
for (const difficulty of DIFFICULTIES)
  test(`50 seeded ${difficulty} puzzles: exact grade, unique solution, deterministic and timely`, () => {
    const times = [],
      seen = new Set();
    for (let seed = 0; seed < 50; seed++) {
      const start = performance.now(),
        result = generatePuzzle(difficulty, { seed });
      times.push(performance.now() - start);
      assert.equal(result.difficulty, difficulty);
      assert.equal(result.grade.difficulty, difficulty);
      assert.deepEqual(grade(result.puzzle), result.grade);
      assert.equal(result.grade.solved, true);
      assert.equal(countSolutions(result.puzzle), 1);
      assert.deepEqual(solve(result.puzzle), result.solution);
      assert.equal(result.clueCount, result.puzzle.filter(Boolean).length);
      assert.equal(result.id, `${difficulty}-${seed}`);
      assert.equal(result.seed, String(seed));
      assert.deepEqual(generatePuzzle(difficulty, { seed }), result);
      assert.ok(
        !seen.has(result.puzzle.join("")),
        "different seeds should give different puzzles",
      );
      seen.add(result.puzzle.join(""));
      for (let i = 0; i < 81; i++)
        if (result.puzzle[i])
          assert.equal(result.puzzle[i], result.solution[i]);
    }
    times.sort((a, b) => a - b);
    // Allow CI contention while preserving the intended order-of-magnitude budget.
    const budget = { easy: 300, medium: 300, hard: 1000, expert: 3000 }[
      difficulty
    ];
    assert.ok(
      times[47] < budget * 2,
      `p95 ${times[47]}ms exceeds loose ${budget * 2}ms budget`,
    );
  });
test("seeded generation never consults time or Math.random", () => {
  const now = Date.now,
    random = Math.random;
  try {
    Date.now = () => {
      throw Error("clock used");
    };
    Math.random = () => {
      throw Error("global random used");
    };
    for (const difficulty of DIFFICULTIES)
      assert.equal(
        generatePuzzle(difficulty, { seed: "clockless", maxAttempts: 0 }).grade
          .difficulty,
        difficulty,
      );
  } finally {
    Date.now = now;
    Math.random = random;
  }
});
test("RNG numeric mulberry32 and string xmur3 vectors are stable", () => {
  const numeric = createRng(1);
  assert.deepEqual(
    Array.from({ length: 3 }, numeric),
    [0.6270739405881613, 0.002735721180215478, 0.5274470399599522],
  );
  const a = createRng("daily"),
    b = createRng("daily"),
    other = createRng("other");
  const samples = Array.from({ length: 100 }, a);
  assert.deepEqual(samples, Array.from({ length: 100 }, b));
  assert.notDeepEqual(samples, Array.from({ length: 100 }, other));
  assert.ok(samples.every((x) => x >= 0 && x < 1));
});
test("daily UTC boundaries, immutable namespace and three literal snapshots", () => {
  assert.equal(DAILY_VERSION, 1);
  assert.equal(dailyKey(new Date("2026-10-27T23:30:00-07:00")), "2026-10-28");
  assert.equal(dailyKey(new Date("2026-10-27T01:00:00+03:00")), "2026-10-26");
  const snapshots = {
    "2026-10-27":
      "350204060000000004906003200208309600015000002009021000700038000000160700023700910",
    "2026-01-01":
      "100005700000630050036100908070060500450000010609058007900347000000002040000010300",
    "2028-02-29":
      "000080600500006400803502001306008000001020000780100200000000092608200300900000105",
  };
  for (const [key, puzzle] of Object.entries(snapshots)) {
    const g = dailyPuzzle(key);
    assert.equal(g.puzzle.join(""), puzzle);
    assert.equal(g.id, `daily-${key}`);
    assert.equal(g.seed, `daily:1:${key}`);
    assert.equal(g.grade.difficulty, "medium");
    assert.equal(countSolutions(g.puzzle), 1);
  }
  for (const bad of ["2026-02-29", "2026-13-01", "2026-2-01", "nonsense"])
    assert.throws(() => dailyPuzzle(bad), RangeError);
});
test("async Node fallback equals sync generation; invalid difficulty rejects", async () => {
  for (const difficulty of DIFFICULTIES)
    assert.deepEqual(
      await generatePuzzleAsync(difficulty, { seed: "async" }),
      generatePuzzle(difficulty, { seed: "async" }),
    );
  assert.throws(() => generatePuzzle("impossible"), RangeError);
  await assert.rejects(generatePuzzleAsync("impossible"), RangeError);
});
