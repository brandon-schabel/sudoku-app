import { generateSolvedBoard, countSolutions, solve } from "./board.js";
import { createRng, DIFFICULTIES } from "./core.js";
import { grade } from "./techniques.js";
import { PUZZLE_BANK } from "./bank.js";
import { DAILY_V1_BANK } from "./daily-v1-bank.js";

function shuffle(values, rng) {
  for (let i = values.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [values[i], values[j]] = [values[j], values[i]];
  }
  return values;
}
function transform(puzzle, rng) {
  const axis = () =>
    shuffle([0, 1, 2], rng).flatMap((b) =>
      shuffle([0, 1, 2], rng).map((i) => b * 3 + i),
    );
  const rows = axis(),
    cols = axis(),
    digits = [0, ...shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], rng)],
    transpose = rng() < 0.5;
  return Array.from(
    { length: 81 },
    (_, i) =>
      digits[
        puzzle[
          transpose
            ? cols[i % 9] * 9 + rows[Math.floor(i / 9)]
            : rows[Math.floor(i / 9)] * 9 + cols[i % 9]
        ]
      ],
  );
}
function randomSeed() {
  if (globalThis.crypto?.getRandomValues)
    return String(globalThis.crypto.getRandomValues(new Uint32Array(1))[0]);
  return String(Date.now());
}
/** Generate a unique puzzle, accepting only the exact requested human-technique tier.
 * Seeded work has no time or global-randomness dependency. maxAttempts bounds fresh-grid
 * attempts in every tier; a verified bank provides a deterministic guaranteed fallback.
 * maxAttempts is floored and clamped to 0..100; non-finite/non-number values use 6.
 */
export function generatePuzzle(
  difficulty = "easy",
  { seed, maxAttempts = 6 } = {},
) {
  if (!DIFFICULTIES.includes(difficulty))
    throw new RangeError(`Unknown difficulty: ${difficulty}`);
  seed = String(seed ?? randomSeed());
  const rng = createRng(seed);
  const finish = (puzzle, result) => ({
    puzzle,
    solution: solve(puzzle),
    difficulty,
    grade: result,
    seed,
    clueCount: puzzle.filter(Boolean).length,
    id: `${difficulty}-${seed}`,
  });
  const attempts = Number.isFinite(maxAttempts)
    ? Math.max(0, Math.min(100, Math.floor(maxAttempts)))
    : 6;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const puzzle = generateSolvedBoard(rng),
      order = shuffle(
        Array.from({ length: 81 }, (_, i) => i),
        rng,
      );
    let clues = 81;
    for (const index of order) {
      const value = puzzle[index];
      puzzle[index] = 0;
      if (countSolutions(puzzle) !== 1) {
        puzzle[index] = value;
        continue;
      }
      clues--;
      if (clues > { easy: 40, medium: 34, hard: 30, expert: 28 }[difficulty])
        continue;
      const result = grade(puzzle);
      if (result.difficulty === difficulty) return finish(puzzle, result);
      if (
        result.difficulty === null ||
        DIFFICULTIES.indexOf(result.difficulty) >
          DIFFICULTIES.indexOf(difficulty)
      )
        break;
    }
  }
  // DAILY_VERSION 1 includes the original fallback selection and ordering, even
  // for seeds whose six fresh attempts fail. Expanding the random-play bank must
  // not silently change an existing daily on another device or after an update.
  const bank =
    difficulty === "medium" && seed.startsWith("daily:1:")
      ? DAILY_V1_BANK
      : PUZZLE_BANK[difficulty];
  // Symmetries can change the simplest-first route, so every variant is regraded.
  for (let attempt = 0; attempt < 32; attempt++) {
    const base = bank[Math.floor(rng() * bank.length)],
      puzzle = transform([...base.puzzle].map(Number), rng),
      result = grade(puzzle);
    if (result.difficulty === difficulty) return finish(puzzle, result);
  }
  const base = bank[Math.floor(rng() * bank.length)],
    puzzle = [...base.puzzle].map(Number),
    result = grade(puzzle);
  if (result.difficulty !== difficulty)
    throw new Error("Puzzle bank grade mismatch");
  return finish(puzzle, result);
}
/** Generate off the UI thread when module workers are available; otherwise use sync logic.
 * A worker that fails or does not reply within 12 seconds falls back to sync generation.
 */
export async function generatePuzzleAsync(difficulty, opts) {
  if (typeof globalThis.Worker !== "function")
    return generatePuzzle(difficulty, opts);
  return new Promise((resolve, reject) => {
    let worker,
      timer,
      settled = false;
    const cleanup = () => {
      clearTimeout(timer);
      if (worker) {
        worker.onmessage = worker.onerror = worker.onmessageerror = null;
        worker.terminate();
      }
    };
    const fallback = () => {
      if (settled) return;
      settled = true;
      cleanup();
      try {
        resolve(generatePuzzle(difficulty, opts));
      } catch (error) {
        reject(error);
      }
    };
    try {
      worker = new Worker(new URL("./worker.js", import.meta.url), {
        type: "module",
      });
      worker.onmessage = ({ data }) => {
        if (settled) return;
        settled = true;
        cleanup();
        if (data.error) reject(new Error(data.error));
        else resolve(data.result);
      };
      worker.onerror = fallback;
      worker.onmessageerror = fallback;
      timer = setTimeout(fallback, 12_000);
      worker.postMessage({ difficulty, opts });
    } catch {
      fallback();
    }
  });
}
/** Immutable daily seed namespace; changing it requires an explicit migration. */
export const DAILY_VERSION = 1;
/** ISO date key using UTC, regardless of the device's local timezone.
 * @throws {RangeError} If date is invalid (including new Date(NaN)).
 */
export function dailyKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}
/** Deterministic Medium daily puzzle shared by all devices. */
export function dailyPuzzle(dateKey) {
  if (
    typeof dateKey !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(dateKey) ||
    !Number.isFinite(Date.parse(`${dateKey}T00:00:00Z`)) ||
    dailyKey(new Date(`${dateKey}T00:00:00Z`)) !== dateKey
  )
    throw new RangeError("Expected a valid UTC date key");
  return {
    ...generatePuzzle("medium", { seed: `daily:${DAILY_VERSION}:${dateKey}` }),
    id: `daily-${dateKey}`,
  };
}
