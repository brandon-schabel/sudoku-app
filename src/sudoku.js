/**
 * Legacy compatibility shim over src/engine. New code should import from
 * ./engine/index.js; this module keeps the v1 clue-count API used by the
 * current game until it migrates to graded generation.
 */
import { peersOf } from "./engine/core.js";
import {
  getPeers,
  findConflicts,
  solve,
  countSolutions,
  generateSolvedBoard as engineSolvedBoard,
} from "./engine/board.js";

export { getPeers, findConflicts, solve, countSolutions };

/** Legacy clue-count ranges per difficulty (the engine grades by technique instead). */
export const DIFFICULTIES = {
  easy: { min: 38, max: 42, target: 40 },
  medium: { min: 32, max: 35, target: 34 },
  hard: { min: 28, max: 31, target: 30 },
  expert: { min: 24, max: 27, target: 26 },
};

const CELLS = 81;

function now() {
  return typeof performance !== "undefined" &&
    typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}

function shuffle(values, rng) {
  for (let i = values.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [values[i], values[j]] = [values[j], values[i]];
  }
  return values;
}

/** Numeric mulberry32 RNG (v1 semantics: the seed is coerced to uint32). */
export function createRng(seed) {
  let a = seed >>> 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** True when `digit` (0 clears) does not repeat in the cell's peers; board[index] is ignored. */
export function isPlacementValid(board, index, digit) {
  if (!Array.isArray(board) || board.length !== CELLS) return false;
  if (!Number.isInteger(index) || index < 0 || index >= CELLS) return false;
  if (!Number.isInteger(digit) || digit < 0 || digit > 9) return false;
  if (digit === 0) return true;
  return peersOf(index).every((peer) => board[peer] !== digit);
}

/** True when all 81 cells hold a digit 1-9 (validity is not checked). */
export function isBoardComplete(board) {
  return (
    Array.isArray(board) &&
    board.length === CELLS &&
    board.every((v) => Number.isInteger(v) && v >= 1 && v <= 9)
  );
}

/** Create a solved grid; defaults to Math.random for unseeded legacy callers. */
export function generateSolvedBoard(rng = Math.random) {
  return engineSolvedBoard(typeof rng === "function" ? rng : Math.random);
}

/**
 * v1 generator: remove clues toward the difficulty's target count while keeping a
 * unique solution, within a time budget.
 */
export function generatePuzzle(difficulty = "easy", opts = {}) {
  const selectedDifficulty = Object.prototype.hasOwnProperty.call(
    DIFFICULTIES,
    difficulty,
  )
    ? difficulty
    : "easy";
  const config = DIFFICULTIES[selectedDifficulty];
  const timeBudgetMs = Number.isFinite(opts.timeBudgetMs)
    ? opts.timeBudgetMs
    : 750;
  const maxAttempts = Number.isFinite(opts.maxAttempts)
    ? Math.max(1, Math.floor(opts.maxAttempts))
    : 4;
  const rng =
    typeof opts.rng === "function"
      ? opts.rng
      : opts.seed !== undefined
        ? createRng(opts.seed)
        : Math.random;

  const start = now();
  const deadline = start + timeBudgetMs;
  let best = null;
  let attempts = 0;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Always make one attempt, even with a zero budget.
    if (attempt > 0 && now() >= deadline && best) break;
    attempts++;
    const solution = generateSolvedBoard(rng);
    const puzzle = solution.slice();
    const order = shuffle(
      Array.from({ length: CELLS }, (_, i) => i),
      rng,
    );
    let clueCount = CELLS;
    for (const index of order) {
      if (clueCount <= config.target || now() >= deadline) break;
      const saved = puzzle[index];
      puzzle[index] = 0;
      // Uniqueness is never sacrificed.
      if (countSolutions(puzzle, 2) === 1) clueCount--;
      else puzzle[index] = saved;
    }
    if (!best || clueCount < best.clueCount)
      best = { puzzle: puzzle.slice(), solution, clueCount };
    if (clueCount <= config.target) break;
  }

  return {
    puzzle: best.puzzle,
    solution: best.solution,
    difficulty: selectedDifficulty,
    clueCount: best.clueCount,
    attempts,
    elapsedMs: now() - start,
    bestEffort: best.clueCount > config.target,
  };
}
