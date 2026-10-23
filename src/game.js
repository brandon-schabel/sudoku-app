import {
  DIFFICULTIES,
  findConflicts,
  generatePuzzle,
  getPeers,
  isBoardComplete
} from "./sudoku.js";

export const MISTAKE_LIMIT = 3;

const CELLS = 81;
const MAX_ACTIONS = 300;
const MAX_FIELD_VALUE = 1_000_000_000_000;

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

function cloneCells(cells) {
  return cells.map((cell) => ({
    i: cell.i,
    before: { v: cell.before.v, n: cell.before.n },
    after: { v: cell.after.v, n: cell.after.n }
  }));
}

function cloneActions(actions) {
  return actions.map((action) => ({ cells: cloneCells(action.cells) }));
}

function validateState(data) {
  invariant(data && typeof data === "object" && !Array.isArray(data), "Invalid game state");

  invariant(
    typeof data.difficulty === "string" &&
      Object.prototype.hasOwnProperty.call(DIFFICULTIES, data.difficulty),
    "Invalid difficulty"
  );

  for (const field of ["puzzle", "solution", "values", "notes"]) {
    invariant(
      Array.isArray(data[field]) && data[field].length === CELLS,
      `Invalid ${field}`
    );
  }

  for (let i = 0; i < CELLS; i++) {
    const puzzle = data.puzzle[i];
    const solution = data.solution[i];
    const value = data.values[i];
    const note = data.notes[i];

    invariant(isIntInRange(puzzle, 0, 9), `Invalid puzzle value at ${i}`);
    invariant(isIntInRange(solution, 1, 9), `Invalid solution value at ${i}`);
    invariant(isIntInRange(value, 0, 9), `Invalid value at ${i}`);
    invariant(isIntInRange(note, 0, 511), `Invalid notes at ${i}`);

    if (puzzle !== 0) {
      invariant(value === puzzle, `Given ${i} was changed`);
      invariant(solution === puzzle, `Solution does not match given ${i}`);
    }
  }

  invariant(
    isBoardComplete(data.solution) && findConflicts(data.solution).size === 0,
    "Invalid solution"
  );

  invariant(
    isIntInRange(data.mistakes, 0, MAX_FIELD_VALUE),
    "Invalid mistake count"
  );
  invariant(isIntInRange(data.hints, 0, MAX_FIELD_VALUE), "Invalid hint count");
  invariant(
    typeof data.elapsedMs === "number" &&
      Number.isFinite(data.elapsedMs) &&
      data.elapsedMs >= 0 &&
      data.elapsedMs <= MAX_FIELD_VALUE,
    "Invalid elapsed time"
  );

  for (const field of ["running", "completed", "gameOverShown"]) {
    invariant(typeof data[field] === "boolean", `Invalid ${field}`);
  }

  invariant(
    typeof data.createdAt === "number" &&
      Number.isFinite(data.createdAt) &&
      data.createdAt >= 0 &&
      data.createdAt <= Number.MAX_SAFE_INTEGER,
    "Invalid createdAt"
  );

  invariant(
    data.history &&
      typeof data.history === "object" &&
      Array.isArray(data.history.actions),
    "Invalid history"
  );
  invariant(
    Number.isInteger(data.history.index) &&
      data.history.index >= 0 &&
      data.history.index <= data.history.actions.length,
    "Invalid history index"
  );
  invariant(
    data.history.actions.length <= MAX_ACTIONS,
    "History is too long"
  );

  for (const action of data.history.actions) {
    invariant(
      action && typeof action === "object" && Array.isArray(action.cells),
      "Invalid history action"
    );
    for (const cell of action.cells) {
      invariant(cell && typeof cell === "object", "Invalid history cell");
      invariant(isIntInRange(cell.i, 0, CELLS - 1), "Invalid history cell index");
      invariant(
        cell.before &&
          cell.after &&
          isIntInRange(cell.before.v, 0, 9) &&
          isIntInRange(cell.after.v, 0, 9) &&
          isIntInRange(cell.before.n, 0, 511) &&
          isIntInRange(cell.after.n, 0, 511),
        "Invalid history transition"
      );
    }
  }

  if (data.completed) {
    invariant(
      data.values.every((value, i) => value === data.solution[i]) &&
        findConflicts(data.values).size === 0,
      "Completed game is not solved"
    );
  }

  return {
    difficulty: data.difficulty,
    puzzle: data.puzzle.slice(),
    solution: data.solution.slice(),
    values: data.values.slice(),
    notes: data.notes.slice(),
    mistakes: data.mistakes,
    hints: data.hints,
    elapsedMs: data.elapsedMs,
    running: data.running,
    completed: data.completed,
    gameOverShown: data.gameOverShown,
    history: {
      actions: cloneActions(data.history.actions),
      index: data.history.index
    },
    createdAt: data.createdAt
  };
}

export class Game {
  static create(difficulty = "easy", opts = {}) {
    const generated = generatePuzzle(difficulty, opts);
    return new Game({
      difficulty: generated.difficulty,
      puzzle: generated.puzzle.slice(),
      solution: generated.solution.slice(),
      values: generated.puzzle.slice(),
      notes: new Array(CELLS).fill(0),
      mistakes: 0,
      hints: 0,
      elapsedMs: 0,
      running: true,
      completed: false,
      gameOverShown: false,
      history: { actions: [], index: 0 },
      createdAt: Date.now()
    });
  }

  static fromJSON(data) {
    return new Game(validateState(data));
  }

  constructor(state) {
    const source = state && typeof state === "object" ? state : {};
    this._state = {
      difficulty: source.difficulty ?? "easy",
      puzzle: Array.isArray(source.puzzle) ? source.puzzle.slice() : new Array(CELLS).fill(0),
      solution: Array.isArray(source.solution)
        ? source.solution.slice()
        : new Array(CELLS).fill(0),
      values: Array.isArray(source.values) ? source.values.slice() : new Array(CELLS).fill(0),
      notes: Array.isArray(source.notes) ? source.notes.slice() : new Array(CELLS).fill(0),
      mistakes: source.mistakes ?? 0,
      hints: source.hints ?? 0,
      elapsedMs: source.elapsedMs ?? 0,
      running: source.running ?? true,
      completed: source.completed ?? false,
      gameOverShown: source.gameOverShown ?? false,
      history: {
        actions: cloneActions(source.history?.actions ?? []),
        index: source.history?.index ?? 0
      },
      createdAt: source.createdAt ?? Date.now(),
      lastEvent: null
    };
    this._lastTick = null;
  }

  get state() {
    return this._state;
  }

  isGiven(index) {
    return this._state.puzzle[index] !== 0;
  }

  _clearEvent() {
    this._state.lastEvent = null;
  }

  _applyCells(cells, phase) {
    for (const cell of cells) {
      this._state.values[cell.i] = cell[phase].v;
      this._state.notes[cell.i] = cell[phase].n;
    }
  }

  _pushAction(action) {
    if (action.cells.length === 0) return;
    const history = this._state.history;
    history.actions.length = history.index;
    history.actions.push(action);
    history.index = history.actions.length;
    if (history.actions.length > MAX_ACTIONS) {
      // Drop the oldest action; the history index stays at the end.
      history.actions.shift();
      history.index = history.actions.length;
    }
  }

  _valueAction(index, digit) {
    const { values, notes } = this._state;
    const cells = [];
    const seen = new Set();
    const add = (i, nextValue, nextNotes) => {
      if (seen.has(i)) return;
      seen.add(i);
      const before = { v: values[i], n: notes[i] };
      if (before.v === nextValue && before.n === nextNotes) return;
      cells.push({ i, before, after: { v: nextValue, n: nextNotes } });
    };

    add(index, digit, 0);
    const bit = 1 << (digit - 1);
    for (const peer of getPeers(index)) {
      add(peer, values[peer], notes[peer] & ~bit);
    }
    return { cells };
  }

  _checkWin() {
    if (!this.isWon()) return false;
    if (!this._state.completed) {
      this._state.completed = true;
      this._state.running = false;
      this._lastTick = null;
      this._state.lastEvent = "win";
    }
    return true;
  }

  enterDigit(index, digit) {
    this._clearEvent();
    if (!isIntInRange(index, 0, CELLS - 1) || !isIntInRange(digit, 1, 9)) {
      return this._state.mistakes;
    }
    if (this._state.completed) return this._state.mistakes;
    if (this._state.puzzle[index] !== 0) return this._state.mistakes;
    if (this._state.values[index] === digit) return this._state.mistakes;

    const action = this._valueAction(index, digit);
    this._applyCells(action.cells, "after");
    this._pushAction(action);

    if (digit !== this._state.solution[index]) {
      this._state.mistakes++;
      if (
        this._state.mistakes >= MISTAKE_LIMIT &&
        !this._state.gameOverShown
      ) {
        this._state.gameOverShown = true;
        this._state.lastEvent = "gameover";
      }
    }

    this._checkWin();
    return this._state.mistakes;
  }

  erase(index) {
    this._clearEvent();
    if (!isIntInRange(index, 0, CELLS - 1)) return false;
    if (this._state.completed) return false;
    if (this._state.puzzle[index] !== 0) return false;

    const before = { v: this._state.values[index], n: this._state.notes[index] };
    if (before.v === 0 && before.n === 0) return false;

    const action = {
      cells: [{ i: index, before, after: { v: 0, n: 0 } }]
    };
    this._applyCells(action.cells, "after");
    this._pushAction(action);
    return true;
  }

  toggleNote(index, digit) {
    this._clearEvent();
    if (!isIntInRange(index, 0, CELLS - 1) || !isIntInRange(digit, 1, 9)) {
      return false;
    }
    if (this._state.completed) return false;
    if (this._state.puzzle[index] !== 0) return false;
    if (this._state.values[index] !== 0) return false;

    const bit = 1 << (digit - 1);
    const before = this._state.notes[index];
    const after = before ^ bit;
    const action = {
      cells: [{ i: index, before: { v: 0, n: before }, after: { v: 0, n: after } }]
    };
    this._applyCells(action.cells, "after");
    this._pushAction(action);
    return true;
  }

  undo() {
    this._clearEvent();
    const history = this._state.history;
    if (history.index <= 0) return false;
    const action = history.actions[history.index - 1];
    this._applyCells(action.cells, "before");
    history.index--;
    return true;
  }

  redo() {
    this._clearEvent();
    const history = this._state.history;
    if (history.index >= history.actions.length) return false;
    const action = history.actions[history.index];
    this._applyCells(action.cells, "after");
    history.index++;
    return true;
  }

  hint(index = null) {
    this._clearEvent();
    if (this._state.completed) return null;

    let target = null;
    if (
      isIntInRange(index, 0, CELLS - 1) &&
      this._state.puzzle[index] === 0 &&
      this._state.values[index] === 0
    ) {
      target = index;
    } else {
      for (let i = 0; i < CELLS; i++) {
        if (this._state.values[i] === 0) {
          target = i;
          break;
        }
      }
    }
    if (target === null) return null;

    const digit = this._state.solution[target];
    const action = this._valueAction(target, digit);
    this._applyCells(action.cells, "after");
    this._pushAction(action);
    this._state.hints++;
    this._checkWin();
    return target;
  }

  pause() {
    if (!this._state.running || this._state.completed) return false;
    this.tick(now());
    this._state.running = false;
    this._lastTick = null;
    return true;
  }

  resume() {
    if (this._state.completed || this._state.running) return false;
    this._state.running = true;
    this._lastTick = null;
    return true;
  }

  pauseToggle() {
    this._clearEvent();
    if (this._state.completed) return false;
    if (this._state.running) this.pause();
    else this.resume();
    return this._state.running;
  }

  tick(nowMs = now()) {
    if (!this._state.running) {
      this._lastTick = null;
      return this._state.elapsedMs;
    }
    if (typeof nowMs !== "number" || !Number.isFinite(nowMs)) {
      return this._state.elapsedMs;
    }
    if (this._lastTick === null) {
      this._lastTick = nowMs;
      return this._state.elapsedMs;
    }
    const delta = nowMs - this._lastTick;
    this._lastTick = nowMs;
    if (delta > 0) this._state.elapsedMs += delta;
    return this._state.elapsedMs;
  }

  isWon() {
    const { values, solution } = this._state;
    if (!isBoardComplete(values)) return false;
    for (let i = 0; i < CELLS; i++) {
      if (values[i] !== solution[i]) return false;
    }
    return findConflicts(values).size === 0;
  }

  remainingCounts() {
    const counts = {};
    for (let digit = 1; digit <= 9; digit++) counts[digit] = 9;
    for (const value of this._state.values) {
      if (value >= 1 && value <= 9) counts[value]--;
    }
    for (let digit = 1; digit <= 9; digit++) {
      if (counts[digit] < 0) counts[digit] = 0;
    }
    return counts;
  }

  toJSON() {
    const state = this._state;
    return {
      difficulty: state.difficulty,
      puzzle: state.puzzle.slice(),
      solution: state.solution.slice(),
      values: state.values.slice(),
      notes: state.notes.slice(),
      mistakes: state.mistakes,
      hints: state.hints,
      elapsedMs: state.elapsedMs,
      running: state.running,
      completed: state.completed,
      gameOverShown: state.gameOverShown,
      history: {
        actions: cloneActions(state.history.actions),
        index: state.history.index
      },
      createdAt: state.createdAt
    };
  }
}
