/**
 * Game state v2 (ROADMAP §2.3). Pure: no DOM, no storage. Every board change
 * is recorded as one undoable action of cell transitions.
 * @module game
 */
import { DIFFICULTIES, autoNotes, findConflicts, peersOf } from "./engine/index.js";

const CELLS = 81;
const MAX_ACTIONS = 500;
const MAX_FIELD_VALUE = 1_000_000_000_000;
const ASSIST_KEYS = ["hints", "checks", "reveals", "errorsShown", "autoNotes"];

/** @typedef {import('./engine/index.js').Difficulty} Difficulty */
/** @typedef {{hints:number, checks:number, reveals:number, errorsShown:number, autoNotes:number}} Assist */
/** @typedef {{i:number, before:{v:number,n:number}, after:{v:number,n:number}}} CellChange */
/** @typedef {{cells:CellChange[]}} Action */
/**
 * @typedef {{schema:2, id:string, kind:'random'|'daily', dailyKey:string|null, seed:string|null,
 *   difficulty:Difficulty, gradeHardest:string|null, puzzle:number[], solution:number[], values:number[],
 *   notes:number[], mistakes:number, assist:Assist, elapsedMs:number, running:boolean, completed:boolean,
 *   completedAt:number|null, history:{actions:Action[], index:number}, createdAt:number, updatedAt:number}} GameJSON
 */

function now() {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}

function invariant(condition, message) {
  if (!condition) throw new TypeError(message);
}

function isIntInRange(value, min, max) {
  return Number.isInteger(value) && value >= min && value <= max;
}

function isTimestamp(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER;
}

function cloneActions(actions) {
  return actions.map((action) => ({
    cells: action.cells.map((cell) => ({
      i: cell.i,
      before: { v: cell.before.v, n: cell.before.n },
      after: { v: cell.after.v, n: cell.after.n }
    }))
  }));
}

/** @returns {Assist} */
function zeroAssist() {
  return { hints: 0, checks: 0, reveals: 0, errorsShown: 0, autoNotes: 0 };
}

function isSolvedGrid(board) {
  return board.every((v) => v >= 1 && v <= 9) && findConflicts(board).size === 0;
}

/**
 * Validate a v1 or v2 payload and return a normalised v2 state (deep copy).
 * @param {any} data
 * @returns {GameJSON}
 */
function validateState(data) {
  invariant(data && typeof data === "object" && !Array.isArray(data), "Invalid game state");
  const v1 = data.schema === undefined;
  invariant(v1 || data.schema === 2, "Unsupported game schema");
  invariant(DIFFICULTIES.includes(data.difficulty), "Invalid difficulty");

  for (const field of ["puzzle", "solution", "values", "notes"]) {
    invariant(Array.isArray(data[field]) && data[field].length === CELLS, `Invalid ${field}`);
  }
  for (let i = 0; i < CELLS; i++) {
    invariant(isIntInRange(data.puzzle[i], 0, 9), `Invalid puzzle value at ${i}`);
    invariant(isIntInRange(data.solution[i], 1, 9), `Invalid solution value at ${i}`);
    invariant(isIntInRange(data.values[i], 0, 9), `Invalid value at ${i}`);
    invariant(isIntInRange(data.notes[i], 0, 511), `Invalid notes at ${i}`);
    if (data.puzzle[i] !== 0) {
      invariant(data.values[i] === data.puzzle[i], `Given ${i} was changed`);
      invariant(data.solution[i] === data.puzzle[i], `Solution does not match given ${i}`);
    }
  }
  invariant(isSolvedGrid(data.solution), "Invalid solution");
  invariant(isIntInRange(data.mistakes, 0, MAX_FIELD_VALUE), "Invalid mistake count");
  invariant(
    typeof data.elapsedMs === "number" && Number.isFinite(data.elapsedMs) &&
      data.elapsedMs >= 0 && data.elapsedMs <= MAX_FIELD_VALUE,
    "Invalid elapsed time"
  );
  for (const field of ["running", "completed"]) {
    invariant(typeof data[field] === "boolean", `Invalid ${field}`);
  }
  invariant(isTimestamp(data.createdAt), "Invalid createdAt");

  const history = data.history;
  invariant(history && typeof history === "object" && Array.isArray(history.actions), "Invalid history");
  invariant(
    Number.isInteger(history.index) && history.index >= 0 && history.index <= history.actions.length,
    "Invalid history index"
  );
  invariant(history.actions.length <= MAX_ACTIONS, "History is too long");
  for (const action of history.actions) {
    invariant(action && typeof action === "object" && Array.isArray(action.cells), "Invalid history action");
    for (const cell of action.cells) {
      invariant(cell && typeof cell === "object", "Invalid history cell");
      invariant(isIntInRange(cell.i, 0, CELLS - 1), "Invalid history cell index");
      invariant(
        cell.before && cell.after &&
          isIntInRange(cell.before.v, 0, 9) && isIntInRange(cell.after.v, 0, 9) &&
          isIntInRange(cell.before.n, 0, 511) && isIntInRange(cell.after.n, 0, 511),
        "Invalid history transition"
      );
    }
  }
  if (data.completed) {
    invariant(data.values.every((v, i) => v === data.solution[i]), "Completed game is not solved");
  }

  let assist = zeroAssist();
  if (v1) {
    invariant(isIntInRange(data.hints ?? 0, 0, MAX_FIELD_VALUE), "Invalid hint count");
    assist.hints = data.hints ?? 0;
  } else {
    invariant(data.assist && typeof data.assist === "object", "Invalid assist");
    for (const key of ASSIST_KEYS) {
      invariant(isIntInRange(data.assist[key], 0, MAX_FIELD_VALUE), `Invalid assist.${key}`);
      assist[key] = data.assist[key];
    }
  }

  const kind = data.kind === "daily" ? "daily" : "random";
  const dailyKey = kind === "daily" && typeof data.dailyKey === "string" ? data.dailyKey : null;
  const updatedAt = isTimestamp(data.updatedAt) ? data.updatedAt : isTimestamp(data.savedAt) ? data.savedAt : data.createdAt;
  return {
    schema: 2,
    id: typeof data.id === "string" && data.id ? data.id : `legacy-${data.createdAt}`,
    kind,
    dailyKey,
    seed: typeof data.seed === "string" ? data.seed : null,
    difficulty: data.difficulty,
    gradeHardest: typeof data.gradeHardest === "string" ? data.gradeHardest : null,
    puzzle: data.puzzle.slice(),
    solution: data.solution.slice(),
    values: data.values.slice(),
    notes: data.notes.slice(),
    mistakes: data.mistakes,
    assist,
    elapsedMs: data.elapsedMs,
    running: data.completed ? false : data.running,
    completed: data.completed,
    completedAt: data.completed ? (isTimestamp(data.completedAt) ? data.completedAt : updatedAt) : null,
    history: { actions: cloneActions(history.actions), index: history.index },
    createdAt: data.createdAt,
    updatedAt
  };
}

/** A single Sudoku game: values, notes, undo history, timer and assist counters. */
export class Game {
  /**
   * Start a fresh game from a generated puzzle.
   * @param {import('./engine/index.js').GeneratedPuzzle} generated
   * @param {{kind?:'random'|'daily', dailyKey?:string|null}} [opts]
   * @returns {Game}
   */
  static create(generated, { kind = "random", dailyKey = null } = {}) {
    invariant(generated && Array.isArray(generated.puzzle) && Array.isArray(generated.solution), "Invalid puzzle");
    const createdAt = Date.now();
    const state = validateState({
      schema: 2,
      id: generated.id || `${generated.difficulty}-${generated.seed ?? createdAt}`,
      kind,
      dailyKey: kind === "daily" ? dailyKey : null,
      seed: generated.seed == null ? null : String(generated.seed),
      difficulty: generated.difficulty,
      gradeHardest: generated.grade?.hardest ?? null,
      puzzle: generated.puzzle,
      solution: generated.solution,
      values: generated.puzzle,
      notes: new Array(CELLS).fill(0),
      mistakes: 0,
      assist: zeroAssist(),
      elapsedMs: 0,
      running: true,
      completed: false,
      completedAt: null,
      history: { actions: [], index: 0 },
      createdAt,
      updatedAt: createdAt
    });
    return new Game(state);
  }

  /**
   * Restore a saved game. Accepts v2 JSON and legacy v1 JSON (no `schema`):
   * v1 `hints` become `assist.hints`, `gameOverShown` is dropped.
   * @param {any} data
   * @returns {Game}
   * @throws {TypeError} when the payload is not a valid game
   */
  static fromJSON(data) {
    return new Game(validateState(data));
  }

  /** @param {GameJSON} state already validated state (owned by the instance) */
  constructor(state) {
    /** @type {GameJSON & {lastEvent:'win'|'mistake'|null}} */
    this._state = { ...state, lastEvent: null };
    this._lastTick = null;
    this._countedHint = null;
  }

  /** Live state (do not mutate). Includes `lastEvent`: 'win' | 'mistake' | null. */
  get state() {
    return this._state;
  }

  /** @param {number} index @returns {boolean} true for a puzzle clue */
  isGiven(index) {
    return this._state.puzzle[index] !== 0;
  }

  /** @returns {boolean} whether undo is possible */
  canUndo() {
    return !this._state.completed && this._state.history.index > 0;
  }

  /** @returns {boolean} whether redo is possible */
  canRedo() {
    return !this._state.completed && this._state.history.index < this._state.history.actions.length;
  }

  _editable(index) {
    return isIntInRange(index, 0, CELLS - 1) && !this._state.completed && this._state.puzzle[index] === 0;
  }

  _touch() {
    this._state.updatedAt = Date.now();
  }

  _applyCells(cells, phase) {
    for (const cell of cells) {
      this._state.values[cell.i] = cell[phase].v;
      this._state.notes[cell.i] = cell[phase].n;
    }
  }

  /** Build, apply and record an action from target {i: {v, n}}; returns false if nothing changed. */
  _commit(targets) {
    const { values, notes } = this._state;
    const cells = [];
    for (const [key, next] of targets) {
      const i = Number(key);
      const before = { v: values[i], n: notes[i] };
      if (before.v === next.v && before.n === next.n) continue;
      cells.push({ i, before, after: { v: next.v, n: next.n } });
    }
    if (cells.length === 0) return false;
    this._applyCells(cells, "after");
    const history = this._state.history;
    history.actions.length = history.index;
    history.actions.push({ cells });
    if (history.actions.length > MAX_ACTIONS) history.actions.shift();
    history.index = history.actions.length;
    this._touch();
    return true;
  }

  /** Targets for placing `digit` at `index` (own notes cleared, optional peer cleanup). */
  _placement(index, digit, cleanupNotes) {
    const targets = new Map([[index, { v: digit, n: 0 }]]);
    if (cleanupNotes) {
      const bit = 1 << (digit - 1);
      const { values, notes } = this._state;
      for (const peer of peersOf(index)) {
        if (values[peer] === 0 && notes[peer] & bit) targets.set(peer, { v: 0, n: notes[peer] & ~bit });
      }
    }
    return targets;
  }

  _checkWin() {
    if (this._state.completed || !this.isWon()) return false;
    this.tick(now());
    this._state.completed = true;
    this._state.completedAt = Date.now();
    this._state.running = false;
    this._lastTick = null;
    this._state.lastEvent = "win";
    return true;
  }

  /**
   * Place a digit. A digit that does not match the solution counts a mistake
   * (always, even if undone later). There is no game over.
   * @param {number} index @param {number} digit 1-9
   * @param {{cleanupNotes?:boolean}} [opts] remove `digit` from peer notes
   * @returns {boolean} whether the board changed
   */
  enterDigit(index, digit, { cleanupNotes = true } = {}) {
    this._state.lastEvent = null;
    if (!this._editable(index) || !isIntInRange(digit, 1, 9)) return false;
    if (this._state.values[index] === digit) return false;
    this._commit(this._placement(index, digit, cleanupNotes));
    if (digit !== this._state.solution[index]) {
      this._state.mistakes++;
      this._state.lastEvent = "mistake";
    }
    this._checkWin();
    return true;
  }

  /** Clear a cell's value and notes. @param {number} index @returns {boolean} */
  erase(index) {
    this._state.lastEvent = null;
    if (!this._editable(index)) return false;
    return this._commit(new Map([[index, { v: 0, n: 0 }]]));
  }

  /** Toggle a pencil note on an empty cell. @param {number} index @param {number} digit @returns {boolean} */
  toggleNote(index, digit) {
    this._state.lastEvent = null;
    if (!this._editable(index) || !isIntInRange(digit, 1, 9)) return false;
    if (this._state.values[index] !== 0) return false;
    const n = this._state.notes[index] ^ (1 << (digit - 1));
    return this._commit(new Map([[index, { v: 0, n }]]));
  }

  /** @returns {boolean} whether an action was undone */
  undo() {
    this._state.lastEvent = null;
    if (!this.canUndo()) return false;
    const history = this._state.history;
    this._applyCells(history.actions[history.index - 1].cells, "before");
    history.index--;
    this._touch();
    return true;
  }

  /** @returns {boolean} whether an action was redone */
  redo() {
    this._state.lastEvent = null;
    if (!this.canRedo()) return false;
    const history = this._state.history;
    this._applyCells(history.actions[history.index].cells, "after");
    history.index++;
    this._touch();
    this._checkWin();
    return true;
  }

  /** @returns {number[]} indices of entries that do not match the solution */
  wrongEntries() {
    const { puzzle, values, solution } = this._state;
    const wrong = [];
    for (let i = 0; i < CELLS; i++) {
      if (puzzle[i] === 0 && values[i] !== 0 && values[i] !== solution[i]) wrong.push(i);
    }
    return wrong;
  }

  /** Check entries against the solution. Counts as an assist. @returns {number[]} wrong indices */
  check() {
    this._state.lastEvent = null;
    if (this._state.completed) return [];
    this._state.assist.checks++;
    this._touch();
    return this.wrongEntries();
  }

  /**
   * Fill one cell with its solution digit (undoable; counts as an assist).
   * @param {number} index
   * @returns {boolean} false if the cell is a given or already correct
   */
  revealCell(index) {
    this._state.lastEvent = null;
    if (!this._editable(index)) return false;
    const digit = this._state.solution[index];
    if (this._state.values[index] === digit) return false;
    this._commit(this._placement(index, digit, true));
    this._state.assist.reveals++;
    this._checkWin();
    return true;
  }

  /** Replace all notes with the board's candidates (one undoable action; counts as an assist). */
  fillNotes() {
    this._state.lastEvent = null;
    if (this._state.completed) return false;
    const next = autoNotes(this._state.values, this._state.notes, { mode: "replace" });
    const targets = new Map();
    for (let i = 0; i < CELLS; i++) {
      if (this._state.values[i] === 0) targets.set(i, { v: 0, n: next[i] });
    }
    this._commit(targets);
    this._state.assist.autoNotes++;
    this._touch();
    return true;
  }

  /** Remove every pencil note (one undoable action). @returns {boolean} */
  clearNotes() {
    this._state.lastEvent = null;
    if (this._state.completed) return false;
    const targets = new Map();
    this._state.notes.forEach((n, i) => {
      if (n) targets.set(i, { v: this._state.values[i], n: 0 });
    });
    return this._commit(targets);
  }

  /**
   * Record that a hint was opened (step 1). Counts once per Hint object.
   * @param {object} [hint]
   * @returns {boolean} whether the counter moved
   */
  hintShown(hint) {
    if (this._state.completed) return false;
    if (hint && hint === this._countedHint) return false;
    this._countedHint = hint ?? null;
    this._state.assist.hints++;
    this._touch();
    return true;
  }

  /**
   * Apply a hint's placement as an undoable action (no extra assist count).
   * @param {{placement:{index:number, digit:number}}} hint
   * @returns {boolean}
   */
  applyHint(hint) {
    this._state.lastEvent = null;
    const p = hint && hint.placement;
    if (!p || !this._editable(p.index) || !isIntInRange(p.digit, 1, 9)) return false;
    if (this._state.values[p.index] === p.digit) return false;
    this._commit(this._placement(p.index, p.digit, true));
    this._checkWin();
    return true;
  }

  /** The UI rendered `n` wrong entries with "show mistakes" on. @param {number} n */
  markErrorsShown(n) {
    if (!Number.isInteger(n) || n <= 0 || this._state.completed) return;
    this._state.assist.errorsShown += n;
    this._touch();
  }

  /** Stop the clock. @param {number} [nowMs] @returns {boolean} */
  pause(nowMs = now()) {
    if (!this._state.running || this._state.completed) return false;
    this.tick(nowMs);
    this._state.running = false;
    this._lastTick = null;
    return true;
  }

  /** Restart the clock. @returns {boolean} */
  resume() {
    if (this._state.completed || this._state.running) return false;
    this._state.running = true;
    this._lastTick = null;
    return true;
  }

  /**
   * Advance active time. The first tick after (re)starting only sets the
   * reference point, so paused/hidden time never counts.
   * @param {number} [nowMs] monotonic milliseconds
   * @returns {number} elapsedMs
   */
  tick(nowMs = now()) {
    if (!this._state.running) {
      this._lastTick = null;
      return this._state.elapsedMs;
    }
    if (typeof nowMs !== "number" || !Number.isFinite(nowMs)) return this._state.elapsedMs;
    if (this._lastTick !== null && nowMs > this._lastTick) {
      this._state.elapsedMs += nowMs - this._lastTick;
    }
    this._lastTick = nowMs;
    return this._state.elapsedMs;
  }

  /**
   * Back to the original puzzle: entries, notes, history, time and mistakes
   * are cleared. Assist counters are kept so a restart never launders a game.
   * @returns {Game}
   */
  restart() {
    const state = this._state;
    state.values = state.puzzle.slice();
    state.notes = new Array(CELLS).fill(0);
    state.mistakes = 0;
    state.elapsedMs = 0;
    state.running = true;
    state.completed = false;
    state.completedAt = null;
    state.history = { actions: [], index: 0 };
    state.lastEvent = null;
    this._lastTick = null;
    this._touch();
    return this;
  }

  /** @returns {boolean} true when every cell matches the solution */
  isWon() {
    const { values, solution } = this._state;
    return values.every((v, i) => v === solution[i]);
  }

  /** @returns {Record<number, number>} digits 1-9 → how many are still to place */
  remainingCounts() {
    const counts = {};
    for (let d = 1; d <= 9; d++) counts[d] = 9;
    for (const v of this._state.values) if (v) counts[v]--;
    for (let d = 1; d <= 9; d++) counts[d] = Math.max(0, counts[d]);
    return counts;
  }

  /** @returns {{filled:number, total:number}} filled cells among the puzzle's empty cells */
  progress() {
    const { puzzle, values } = this._state;
    let filled = 0;
    let total = 0;
    for (let i = 0; i < CELLS; i++) {
      if (puzzle[i] !== 0) continue;
      total++;
      if (values[i] !== 0) filled++;
    }
    return { filled, total };
  }

  /** @returns {GameJSON} deep copy, safe to persist */
  toJSON() {
    const s = this._state;
    return {
      schema: 2,
      id: s.id,
      kind: s.kind,
      dailyKey: s.dailyKey,
      seed: s.seed,
      difficulty: s.difficulty,
      gradeHardest: s.gradeHardest,
      puzzle: s.puzzle.slice(),
      solution: s.solution.slice(),
      values: s.values.slice(),
      notes: s.notes.slice(),
      mistakes: s.mistakes,
      assist: { ...s.assist },
      elapsedMs: s.elapsedMs,
      running: s.running,
      completed: s.completed,
      completedAt: s.completedAt,
      history: { actions: cloneActions(s.history.actions), index: s.history.index },
      createdAt: s.createdAt,
      updatedAt: s.updatedAt
    };
  }
}
