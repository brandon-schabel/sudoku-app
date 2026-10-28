import test from "node:test";
import assert from "node:assert/strict";
import * as legacy from "../src/sudoku.js";
import * as engine from "../src/engine/index.js";
import { getPeers, generateSolvedBoard } from "../src/engine/board.js";

test("legacy sudoku.js delegates solving primitives to the engine", () => {
  assert.equal(legacy.solve, engine.solve);
  assert.equal(legacy.countSolutions, engine.countSolutions);
  assert.equal(legacy.findConflicts, engine.findConflicts);
  assert.equal(legacy.getPeers, getPeers);
  assert.deepEqual(
    legacy.generateSolvedBoard(legacy.createRng(7)),
    generateSolvedBoard(engine.createRng(7)),
  );
  // v1 numeric RNG stays bit-identical to the engine's numeric mulberry32.
  const a = legacy.createRng(123),
    b = engine.createRng(123);
  for (let i = 0; i < 20; i++) assert.equal(a(), b());
});
