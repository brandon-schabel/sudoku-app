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
import {
  diversityFingerprint,
  DIVERSITY_FLOORS,
} from "../src/engine/tools/bank-diversity.js";
import { statSync } from "node:fs";

test("all bank sources are unique, independently solvable and graded at their declared tier", () => {
  for (const difficulty of DIFFICULTIES) {
    assert.ok(PUZZLE_BANK[difficulty].length >= 384);
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
test("bank has a required-technique diversity floor and 384 certified non-isomorphic sources per tier", () => {
  assert.ok(
    statSync(new URL("../src/engine/bank.js", import.meta.url)).size < 600_000,
  );
  for (const difficulty of DIFFICULTIES) {
    const sources = PUZZLE_BANK[difficulty];
    const fingerprints = new Set(
      sources.map((p) => diversityFingerprint([...p.puzzle].map(Number))),
    );
    assert.equal(
      fingerprints.size,
      sources.length,
      "different invariants certify non-isomorphic sources",
    );
    const independentGrids = sources
      .filter((p) => typeof p.seed === "number")
      .map((p) => p.seed);
    assert.ok(
      new Set(independentGrids).size >= 320,
      "at least 320 independent solved-grid seeds per tier",
    );
    const hardest = sources.map((p) => grade([...p.puzzle].map(Number)).hardest);
    for (const [technique, floor] of Object.entries(
      DIVERSITY_FLOORS[difficulty] ?? {},
    ))
      assert.ok(
        hardest.filter((id) => id === technique).length >= floor,
        `${difficulty}: at least ${floor} sources requiring ${technique}`,
      );
  }
});
test("diversity certificate is invariant to Sudoku symmetries", () => {
  const board = [...PUZZLE_BANK.expert[0].puzzle].map(Number),
    expected = diversityFingerprint(board);
  const rows = [4, 5, 3, 8, 6, 7, 1, 0, 2],
    cols = [7, 8, 6, 0, 2, 1, 5, 3, 4];
  for (const transpose of [false, true]) {
    const moved = Array.from({ length: 81 }, (_, i) => {
      const r = rows[Math.floor(i / 9)],
        c = cols[i % 9];
      const value = board[transpose ? c * 9 + r : r * 9 + c];
      return value ? 10 - value : 0;
    });
    assert.equal(diversityFingerprint(moved), expected);
  }
});
for (const difficulty of ["hard", "expert"])
  test(`${difficulty} default path produces fresh non-isomorphic puzzles outside the bank`, () => {
    const bank = new Set(
      PUZZLE_BANK[difficulty].map((p) =>
        diversityFingerprint([...p.puzzle].map(Number)),
      ),
    );
    const fresh = new Set();
    for (let seed = 0; seed < 50; seed++) {
      const generated = generatePuzzle(difficulty, { seed: `fresh:${seed}` });
      const fingerprint = diversityFingerprint(generated.puzzle);
      if (!bank.has(fingerprint)) fresh.add(fingerprint);
    }
    assert.ok(
      fresh.size >= (difficulty === "hard" ? 30 : 5),
      `${fresh.size} fresh structures`,
    );
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
    const budget = { easy: 300, medium: 300, hard: 1000, expert: 3000 }[
      difficulty
    ];
    assert.ok(
      times[47] < budget,
      `p95 ${times[47]}ms exceeds ${budget}ms budget`,
    );
  });
test("default seeded generation never consults time, Math.random or unseeded entropy", () => {
  const now = Date.now,
    random = Math.random,
    cryptoDescriptor = Object.getOwnPropertyDescriptor(globalThis, "crypto");
  const expected = Object.fromEntries(
    DIFFICULTIES.map((difficulty) => [
      difficulty,
      generatePuzzle(difficulty, { seed: "clockless" }),
    ]),
  );
  try {
    Date.now = () => {
      throw Error("clock used");
    };
    Math.random = () => {
      throw Error("global random used");
    };
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: {
        getRandomValues() {
          throw Error("unseeded entropy used");
        },
      },
    });
    for (const difficulty of DIFFICULTIES) {
      assert.deepEqual(
        generatePuzzle(difficulty, { seed: "clockless" }),
        expected[difficulty],
      );
      assert.equal(
        generatePuzzle(difficulty, { seed: "clockless", maxAttempts: 0 }).grade
          .difficulty,
        difficulty,
      );
    }
    assert.equal(dailyPuzzle("2026-10-27").grade.difficulty, "medium");
  } finally {
    Date.now = now;
    Math.random = random;
    if (cryptoDescriptor)
      Object.defineProperty(globalThis, "crypto", cryptoDescriptor);
    else delete globalThis.crypto;
  }
});
test("seeded results are invariant to calls through both unseeded entropy paths", () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "crypto"),
    now = Date.now;
  const expected = DIFFICULTIES.map((d) =>
    generatePuzzle(d, { seed: "entropy-independent" }),
  );
  try {
    let entropy = 100;
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: {
        getRandomValues(values) {
          values[0] = entropy++;
          return values;
        },
      },
    });
    for (let i = 0; i < DIFFICULTIES.length; i++) {
      assert.equal(generatePuzzle(DIFFICULTIES[i]).seed, String(100 + i));
      assert.deepEqual(
        generatePuzzle(DIFFICULTIES[i], { seed: "entropy-independent" }),
        expected[i],
      );
    }
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: undefined,
    });
    Date.now = () => entropy++;
    for (let i = 0; i < DIFFICULTIES.length; i++) {
      assert.equal(generatePuzzle(DIFFICULTIES[i]).seed, String(104 + i));
      assert.deepEqual(
        generatePuzzle(DIFFICULTIES[i], { seed: "entropy-independent" }),
        expected[i],
      );
    }
  } finally {
    Date.now = now;
    if (descriptor) Object.defineProperty(globalThis, "crypto", descriptor);
    else delete globalThis.crypto;
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
  assert.throws(() => dailyKey(new Date(NaN)), RangeError);
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
  // Captured from the pre-expansion generator (205549d); even rare v1 fallback
  // seeds must keep their original puzzles as the random-play bank grows.
  assert.equal(
    generatePuzzle("medium", {
      seed: "daily:1:2026-10-27",
      maxAttempts: 0,
    }).puzzle.join(""),
    "000020000000504600000300027070001806350740009009850004760000408080000062400600500",
  );
  for (const bad of ["2026-02-29", "2026-13-01", "2026-2-01", "nonsense"])
    assert.throws(() => dailyPuzzle(bad), RangeError);
});
test("maxAttempts documented normalization is deterministic", () => {
  for (const maxAttempts of [NaN, Infinity, -Infinity, "2", null])
    assert.deepEqual(
      generatePuzzle("hard", { seed: "attempts", maxAttempts }),
      generatePuzzle("hard", { seed: "attempts", maxAttempts: 6 }),
    );
  assert.deepEqual(
    generatePuzzle("hard", { seed: "attempts", maxAttempts: -1 }),
    generatePuzzle("hard", { seed: "attempts", maxAttempts: 0 }),
  );
  assert.deepEqual(
    generatePuzzle("hard", { seed: "attempts", maxAttempts: 1.9 }),
    generatePuzzle("hard", { seed: "attempts", maxAttempts: 1 }),
  );
  assert.deepEqual(
    generatePuzzle("expert", { seed: "attempts", maxAttempts: 101 }),
    generatePuzzle("expert", { seed: "attempts", maxAttempts: 100 }),
  );
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
