export const DIFFICULTIES = {
  easy: { min: 38, max: 42, target: 40 },
  medium: { min: 32, max: 35, target: 34 },
  hard: { min: 28, max: 31, target: 30 },
  expert: { min: 24, max: 27, target: 26 }
};

const SIZE = 9;
const CELLS = 81;
const ALL_DIGITS = 0x3fe; // bits 1..9

// Precompute the 20 peers (row, column, box) for every cell.
const PEERS = (() => {
  const peers = new Array(CELLS);
  for (let i = 0; i < CELLS; i++) {
    const r = Math.floor(i / SIZE);
    const c = i % SIZE;
    const br = Math.floor(r / 3) * 3;
    const bc = Math.floor(c / 3) * 3;
    const set = new Set();
    for (let k = 0; k < SIZE; k++) {
      if (k !== c) set.add(r * SIZE + k);
      if (k !== r) set.add(k * SIZE + c);
    }
    for (let rr = br; rr < br + 3; rr++) {
      for (let cc = bc; cc < bc + 3; cc++) {
        const j = rr * SIZE + cc;
        if (j !== i) set.add(j);
      }
    }
    peers[i] = Array.from(set);
  }
  return peers;
})();

function now() {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}

function boxOf(r, c) {
  return Math.floor(r / 3) * 3 + Math.floor(c / 3);
}

function countBits(mask) {
  let count = 0;
  while (mask) {
    mask &= mask - 1;
    count++;
  }
  return count;
}

function shuffle(values, rng) {
  for (let i = values.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = values[i];
    values[i] = values[j];
    values[j] = tmp;
  }
  return values;
}

export function createRng(seed) {
  // mulberry32: small, fast, deterministic.
  let a = seed >>> 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function getPeers(index) {
  if (!Number.isInteger(index) || index < 0 || index >= CELLS) return [];
  return PEERS[index].slice();
}

export function isPlacementValid(board, index, digit) {
  if (!Array.isArray(board) || board.length !== CELLS) return false;
  if (!Number.isInteger(index) || index < 0 || index >= CELLS) return false;
  if (!Number.isInteger(digit) || digit < 0 || digit > 9) return false;
  if (digit === 0) return true;
  // Deliberately ignore board[index] so callers can validate a replacement.
  for (const peer of PEERS[index]) {
    if (board[peer] === digit) return false;
  }
  return true;
}

export function findConflicts(board) {
  const conflicts = new Set();
  if (!Array.isArray(board) || board.length !== CELLS) return conflicts;

  const scan = (indices) => {
    const seen = new Map();
    for (const i of indices) {
      const value = board[i];
      if (value < 1 || value > 9) continue;
      const list = seen.get(value);
      if (list) list.push(i);
      else seen.set(value, [i]);
    }
    for (const list of seen.values()) {
      if (list.length > 1) {
        for (const i of list) conflicts.add(i);
      }
    }
  };

  const rows = Array.from({ length: SIZE }, () => []);
  const cols = Array.from({ length: SIZE }, () => []);
  const boxes = Array.from({ length: SIZE }, () => []);
  for (let i = 0; i < CELLS; i++) {
    const r = Math.floor(i / SIZE);
    const c = i % SIZE;
    rows[r].push(i);
    cols[c].push(i);
    boxes[boxOf(r, c)].push(i);
  }
  for (const unit of [...rows, ...cols, ...boxes]) scan(unit);
  return conflicts;
}

export function isBoardComplete(board) {
  if (!Array.isArray(board) || board.length !== CELLS) return false;
  for (let i = 0; i < CELLS; i++) {
    const value = board[i];
    if (!Number.isInteger(value) || value < 1 || value > 9) return false;
  }
  return true;
}

function buildMasks(board) {
  if (!Array.isArray(board) || board.length !== CELLS) return null;
  const rowMask = new Int32Array(SIZE);
  const colMask = new Int32Array(SIZE);
  const boxMask = new Int32Array(SIZE);

  for (let i = 0; i < CELLS; i++) {
    const value = board[i];
    if (!Number.isInteger(value) || value < 0 || value > 9) return null;
    if (value === 0) continue;
    const r = Math.floor(i / SIZE);
    const c = i % SIZE;
    const b = boxOf(r, c);
    const bit = 1 << value;
    // Duplicate givens make the board unsolvable.
    if ((rowMask[r] & bit) || (colMask[c] & bit) || (boxMask[b] & bit)) return null;
    rowMask[r] |= bit;
    colMask[c] |= bit;
    boxMask[b] |= bit;
  }
  return { rowMask, colMask, boxMask };
}

function search(board, limit, rng) {
  const state = buildMasks(board);
  if (!state) return { count: 0, solution: null };

  const values = board.slice();
  const { rowMask, colMask, boxMask } = state;
  let count = 0;
  let solution = null;

  function recurse() {
    if (count >= limit) return;

    // Most-constrained cell (MRV); ties go to the lowest index.
    let best = -1;
    let bestMask = 0;
    let bestCount = SIZE + 1;
    for (let i = 0; i < CELLS; i++) {
      if (values[i] !== 0) continue;
      const r = Math.floor(i / SIZE);
      const c = i % SIZE;
      const b = boxOf(r, c);
      const mask = ALL_DIGITS & ~(rowMask[r] | colMask[c] | boxMask[b]);
      const n = countBits(mask);
      if (n === 0) return;
      if (n < bestCount) {
        best = i;
        bestMask = mask;
        bestCount = n;
        if (n === 1) break;
      }
    }

    if (best === -1) {
      count++;
      if (!solution) solution = values.slice();
      return;
    }

    const digits = [];
    for (let d = 1; d <= 9; d++) {
      if (bestMask & (1 << d)) digits.push(d);
    }
    if (rng) shuffle(digits, rng);

    const r = Math.floor(best / SIZE);
    const c = best % SIZE;
    const b = boxOf(r, c);
    for (const d of digits) {
      const bit = 1 << d;
      values[best] = d;
      rowMask[r] |= bit;
      colMask[c] |= bit;
      boxMask[b] |= bit;

      recurse();

      values[best] = 0;
      rowMask[r] &= ~bit;
      colMask[c] &= ~bit;
      boxMask[b] &= ~bit;
      if (count >= limit) return;
    }
  }

  recurse();
  return { count, solution };
}

export function solve(board) {
  return search(board, 1, null).solution;
}

export function countSolutions(board, limit = 2) {
  if (!Number.isInteger(limit) || limit <= 0) return 0;
  return search(board, limit, null).count;
}

export function generateSolvedBoard(rng = Math.random) {
  const random = typeof rng === "function" ? rng : Math.random;
  const result = search(new Array(CELLS).fill(0), 1, random);
  return result.solution;
}

export function generatePuzzle(difficulty = "easy", opts = {}) {
  const knownDifficulty = Object.prototype.hasOwnProperty.call(DIFFICULTIES, difficulty);
  const selectedDifficulty = knownDifficulty ? difficulty : "easy";
  const config = DIFFICULTIES[selectedDifficulty];

  const timeBudgetMs = Number.isFinite(opts.timeBudgetMs) ? opts.timeBudgetMs : 750;
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
      rng
    );
    let clueCount = CELLS;

    for (const index of order) {
      if (clueCount <= config.target) break;
      if (now() >= deadline) break;

      const saved = puzzle[index];
      puzzle[index] = 0;
      if (countSolutions(puzzle, 2) === 1) {
        clueCount--;
      } else {
        // Uniqueness is never sacrificed.
        puzzle[index] = saved;
      }
    }

    if (!best || clueCount < best.clueCount) {
      best = { puzzle: puzzle.slice(), solution, clueCount };
    }
    if (clueCount <= config.target) break;
  }

  const elapsedMs = now() - start;
  return {
    puzzle: best.puzzle,
    solution: best.solution,
    difficulty: selectedDifficulty,
    clueCount: best.clueCount,
    attempts,
    elapsedMs,
    bestEffort: best.clueCount > config.target
  };
}
