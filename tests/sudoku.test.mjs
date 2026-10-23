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
import { Game, MISTAKE_LIMIT } from "../src/game.js";
import {
  GAME_KEY,
  clearGame,
  loadGame,
  loadSettings,
  saveGame,
  saveSettings
} from "../src/storage.js";

const PUZZLE = [..."530070000600195000098000060800060003400803001700020006060000280000419005000080079"].map(
  Number
);
const SOLUTION = [
  ..."534678912672195348198342567859761423426853791713924856961537284287419635345286179"
].map(Number);

function emptyBoard() {
  return new Array(81).fill(0);
}

function blankIndices(game) {
  const indices = [];
  for (let i = 0; i < 81; i++) {
    if (game.state.values[i] === 0) indices.push(i);
  }
  return indices;
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

test("mistakes increment on wrong digits but not on correct ones", () => {
  const game = Game.create("easy", { seed: 11 });
  const [first, second] = blankIndices(game);
  const wrong = game.state.solution[first] === 9 ? 1 : game.state.solution[first] + 1;

  game.enterDigit(first, wrong);
  assert.equal(game.state.mistakes, 1);

  game.enterDigit(second, game.state.solution[second]);
  assert.equal(game.state.mistakes, 1);
});

test("the game-over flag is set once when the mistake limit is reached", () => {
  const game = Game.create("easy", { seed: 12 });
  const blanks = blankIndices(game);

  for (let k = 0; k < MISTAKE_LIMIT; k++) {
    const index = blanks[k];
    const correct = game.state.solution[index];
    game.enterDigit(index, correct === 1 ? 2 : 1);
    assert.equal(game.state.mistakes, k + 1);
  }

  assert.equal(game.state.gameOverShown, true);
  assert.equal(game.state.lastEvent, "gameover");

  const index = blanks[MISTAKE_LIMIT];
  const correct = game.state.solution[index];
  game.enterDigit(index, correct === 1 ? 2 : 1);
  assert.equal(game.state.mistakes, MISTAKE_LIMIT + 1);
  assert.equal(game.state.gameOverShown, true);
  assert.notEqual(game.state.lastEvent, "gameover");
});

test("placing a digit clears its notes from the cell and all peers", () => {
  const game = Game.create("easy", { seed: 13 });
  const target = blankIndices(game)[0];
  const peer = getPeers(target).find((i) => game.state.values[i] === 0);
  assert.ok(peer !== undefined);

  const digit = game.state.solution[target];
  const bit = 1 << (digit - 1);

  game.toggleNote(target, digit);
  game.toggleNote(peer, digit);
  assert.ok((game.state.notes[target] & bit) !== 0);
  assert.ok((game.state.notes[peer] & bit) !== 0);

  game.enterDigit(target, digit);
  assert.equal(game.state.notes[target], 0);
  assert.equal(game.state.notes[peer] & bit, 0);
});

test("undo/redo round-trip values and notes and truncate redo after a new action", () => {
  const game = Game.create("easy", { seed: 14 });
  const [first, second] = blankIndices(game);
  const digit = 1;
  const bit = 1 << (digit - 1);

  game.toggleNote(first, digit);
  assert.ok((game.state.notes[first] & bit) !== 0);

  const correct = game.state.solution[first];
  game.enterDigit(first, correct);
  assert.equal(game.state.values[first], correct);
  assert.equal(game.state.notes[first], 0);

  assert.equal(game.undo(), true);
  assert.equal(game.state.values[first], 0);
  assert.ok((game.state.notes[first] & bit) !== 0);

  assert.equal(game.redo(), true);
  assert.equal(game.state.values[first], correct);
  assert.equal(game.state.notes[first], 0);

  assert.equal(game.undo(), true);
  assert.equal(game.state.values[first], 0);

  game.enterDigit(second, game.state.solution[second]);
  assert.equal(game.state.history.actions.length, 2);
  assert.equal(game.state.history.index, 2);
  assert.equal(game.state.values[first], 0);
  assert.equal(game.state.values[second], game.state.solution[second]);

  assert.equal(game.redo(), false);
  assert.equal(game.state.values[first], 0);
});

test("hint fills an empty cell with the solution and increments the hint count", () => {
  const game = Game.create("medium", { seed: 15 });
  const target = blankIndices(game)[0];

  assert.equal(game.hint(target), target);
  assert.equal(game.state.values[target], game.state.solution[target]);
  assert.equal(game.state.hints, 1);
  assert.equal(game.isGiven(target), false);
});

test("isWon becomes true only when the whole board is correctly solved", () => {
  const game = Game.create("hard", { seed: 16 });
  const blanks = blankIndices(game);

  assert.equal(game.isWon(), false);
  for (let k = 0; k < blanks.length; k++) {
    const index = blanks[k];
    game.enterDigit(index, game.state.solution[index]);
    if (k < blanks.length - 1) assert.equal(game.isWon(), false);
  }

  assert.equal(game.state.mistakes, 0);
  assert.equal(game.isWon(), true);
  assert.equal(game.state.completed, true);
  assert.equal(game.state.running, false);

  const counts = game.remainingCounts();
  for (let digit = 1; digit <= 9; digit++) assert.equal(counts[digit], 0);
});

test("restart resets progress while keeping the original puzzle and solution", () => {
  const game = Game.create("medium", { seed: 18 });
  const original = game.toJSON();
  const blanks = blankIndices(game);
  const [first, second, third, fourth] = blanks;

  const wrong = game.state.solution[first] === 9 ? 1 : game.state.solution[first] + 1;
  game.enterDigit(first, wrong);
  game.toggleNote(second, 2);
  game.hint(third);
  game.enterDigit(fourth, game.state.solution[fourth]);
  game.tick(1000);
  game.tick(2500);
  game.pause();

  assert.equal(game.state.running, false);
  assert.ok(game.state.history.actions.length > 0);

  const restarted = game.restart();

  assert.equal(restarted, game);
  assert.deepEqual(game.state.values, original.puzzle);
  assert.deepEqual(game.state.notes, new Array(81).fill(0));
  assert.equal(game.state.mistakes, 0);
  assert.equal(game.state.hints, 0);
  assert.equal(game.state.elapsedMs, 0);
  assert.equal(game.state.running, true);
  assert.equal(game.state.completed, false);
  assert.equal(game.state.gameOverShown, false);
  assert.equal(game.state.lastEvent, null);
  assert.deepEqual(game.state.history, { actions: [], index: 0 });
  assert.deepEqual(game.state.puzzle, original.puzzle);
  assert.deepEqual(game.state.solution, original.solution);
  assert.equal(game.state.difficulty, original.difficulty);
  assert.equal(game.state.createdAt, original.createdAt);
});

test("storage degrades gracefully when localStorage is unavailable", () => {
  const hadStorage = "localStorage" in globalThis;
  const previous = globalThis.localStorage;
  try {
    Object.defineProperty(globalThis, "localStorage", {
      value: undefined,
      configurable: true,
      writable: true
    });
    assert.equal(loadGame(), null);
    assert.equal(saveGame({}), false);
    assert.equal(clearGame(), false);
    assert.deepEqual(loadSettings(), { theme: "auto" });
    assert.equal(saveSettings({ theme: "dark" }), false);
  } finally {
    if (hadStorage) {
      Object.defineProperty(globalThis, "localStorage", {
        value: previous,
        configurable: true,
        writable: true
      });
    } else {
      delete globalThis.localStorage;
    }
  }
});

test("storage round-trips games/settings and rejects corrupt data", () => {
  const store = new Map();
  const fakeStorage = {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    }
  };

  const hadStorage = "localStorage" in globalThis;
  const previous = globalThis.localStorage;
  try {
    Object.defineProperty(globalThis, "localStorage", {
      value: fakeStorage,
      configurable: true,
      writable: true
    });

    const game = Game.create("easy", { seed: 17 });
    assert.equal(saveGame(game.toJSON()), true);
    const loaded = loadGame();
    assert.ok(loaded instanceof Game);
    assert.deepEqual(loaded.toJSON(), game.toJSON());

    store.set(GAME_KEY, "{not valid json");
    assert.equal(loadGame(), null);
    assert.equal(store.has(GAME_KEY), false);

    assert.equal(saveSettings({ theme: "dark" }), true);
    assert.deepEqual(loadSettings(), { theme: "dark" });
    saveSettings({ theme: "not-a-theme" });
    assert.deepEqual(loadSettings(), { theme: "auto" });
  } finally {
    if (hadStorage) {
      Object.defineProperty(globalThis, "localStorage", {
        value: previous,
        configurable: true,
        writable: true
      });
    } else {
      delete globalThis.localStorage;
    }
  }
});
