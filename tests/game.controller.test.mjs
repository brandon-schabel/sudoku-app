import test from "node:test";
import assert from "node:assert/strict";
import { createController } from "../src/ui/controller.js";
import { STORAGE_KEYS, listUnfinished } from "../src/domain/index.js";

const PUZZLE = [..."530070000600195000098000060800060003400803001700020006060000280000419005000080079"].map(Number);
const SOLUTION = [..."534678912672195348198342567859761423426853791713924856961537284287419635345286179"].map(Number);

function memoryBackend() {
  const map = new Map();
  return {
    map,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k)
  };
}

function setup({ backend = memoryBackend(), platform = {}, clock } = {}) {
  let t = 1_800_000_000_000;
  const scheduled = [];
  const generated = [];
  const ctl = createController({
    backend,
    platform,
    clock: clock || (() => (t += 1000)),
    seed: () => `seed${generated.length + 1}`,
    generate: async (difficulty, { seed }) => {
      generated.push({ difficulty, seed });
      return { puzzle: PUZZLE, solution: SOLUTION, difficulty, seed, id: `${difficulty}-${seed}`, grade: { hardest: "naked-single" } };
    },
    daily: (dateKey) => ({ puzzle: PUZZLE, solution: SOLUTION, difficulty: "medium", seed: `daily:1:${dateKey}`, id: `daily-${dateKey}`, grade: null }),
    schedule: (fn) => scheduled.push(fn)
  });
  return { ctl, backend, generated, scheduled, flush: async () => { while (scheduled.length) scheduled.shift()(); await new Promise((r) => setImmediate(r)); } };
}

function solveAllBut(game, n) {
  const empty = game.state.values.flatMap((v, i) => (v === 0 ? [i] : []));
  for (const i of empty.slice(0, empty.length - n)) game.enterDigit(i, game.state.solution[i]);
  return game.state.values.flatMap((v, i) => (v === 0 ? [i] : []));
}

test("init starts a new game at lastDifficulty and persists it as active", async () => {
  const { ctl, backend, generated } = setup();
  await ctl.init();
  assert.deepEqual(generated, [{ difficulty: "easy", seed: "seed1" }]);
  const game = ctl.game();
  assert.equal(game.id, "easy-seed1");
  assert.equal(game.running, true);
  const archive = JSON.parse(backend.getItem(STORAGE_KEYS.archive));
  assert.equal(archive.activeId, "easy-seed1");
  assert.equal(ctl.loading(), null);
});

test("init with ?seed starts that deterministic game", async () => {
  const { ctl, generated } = setup();
  await ctl.init({ seed: "abc", difficulty: "hard" });
  assert.deepEqual(generated, [{ difficulty: "hard", seed: "abc" }]);
  assert.equal(ctl.settings().lastDifficulty, "hard");
});

test("reloading a ?seed URL resumes that game instead of overwriting it", async () => {
  const backend = memoryBackend();
  const a = setup({ backend });
  await a.ctl.init({ seed: "abc", difficulty: "hard" });
  const i = a.ctl.current().state.values.indexOf(0);
  a.ctl.current().enterDigit(i, SOLUTION[i]);
  a.ctl.commit();
  const b = setup({ backend });
  await b.ctl.init({ seed: "abc", difficulty: "hard" });
  assert.equal(b.generated.length, 0);
  assert.equal(b.ctl.game().values[i], SOLUTION[i]);
  const c = setup({ backend });
  await c.ctl.init({ seed: "abc", difficulty: "easy" });
  assert.equal(c.generated.length, 1, "different difficulty is a different game");
});

test("a reload resumes the active game with its undo history", async () => {
  const backend = memoryBackend();
  const first = setup({ backend });
  await first.ctl.init();
  const g = first.ctl.current();
  const i = g.state.values.indexOf(0);
  g.toggleNote(i, 3);
  g.enterDigit(i, SOLUTION[i]);
  first.ctl.commit();

  const second = setup({ backend });
  await second.ctl.init();
  assert.equal(second.generated.length, 0, "no new game generated");
  const restored = second.ctl.current();
  assert.equal(restored.state.values[i], SOLUTION[i]);
  assert.equal(restored.state.running, true, "restored games resume directly");
  assert.equal(restored.undo(), true);
  assert.equal(restored.state.notes[i], 1 << 2);
});

test("newGame never discards the previous unfinished game", async () => {
  const { ctl } = setup();
  await ctl.init();
  const first = ctl.game().id;
  await ctl.actions.newGame("medium");
  assert.notEqual(ctl.game().id, first);
  assert.equal(ctl.game().difficulty, "medium");
  assert.equal(ctl.settings().lastDifficulty, "medium");
  const unfinished = listUnfinished(ctl.data().archive).map((e) => e.id);
  assert.ok(unfinished.includes(first));
  ctl.actions.continueEntry(first);
  assert.equal(ctl.game().id, first);
  assert.equal(ctl.data().archive.activeId, first);
});

test("loading state is emitted around generation", async () => {
  const { ctl } = setup();
  const states = [];
  ctl.on("loading", (l) => states.push(l && l.label));
  await ctl.init();
  assert.deepEqual(states, ["Creating an easy puzzle…", null]);
});

test("winning records the result once, marks the entry completed and emits 'win'", async () => {
  const { ctl, backend } = setup();
  await ctl.init();
  const wins = [];
  ctl.on("win", (w) => wins.push(w));
  const g = ctl.current();
  const [last] = solveAllBut(g, 1);
  ctl.commit();
  g.enterDigit(last, SOLUTION[last]);
  ctl.commit();
  ctl.commit();
  ctl.save();
  assert.equal(wins.length, 1);
  const { record, score, personalBest, game } = wins[0];
  assert.equal(game.completed, true);
  assert.equal(record.difficulty, "easy");
  assert.equal(record.assisted, false);
  assert.equal(score, record.score);
  assert.equal(personalBest.isBestTime, true);
  assert.equal(ctl.data().records.length, 1);
  assert.equal(ctl.data().meta.completedCount, 1);
  assert.equal(ctl.data().archive.entries[game.id].status, "completed");
  assert.equal(JSON.parse(backend.getItem(STORAGE_KEYS.records)).length, 1);
});

test("a replayed (restarted) puzzle gets a distinct record id", async () => {
  const { ctl } = setup();
  await ctl.init();
  let g = ctl.current();
  g.revealCell(solveAllBut(g, 1)[0]);
  ctl.commit();
  ctl.actions.restart();
  g = ctl.current();
  g.revealCell(solveAllBut(g, 1)[0]);
  ctl.commit();
  const ids = ctl.data().records.map((r) => r.id);
  assert.equal(ids.length, 2);
  assert.equal(new Set(ids).size, 2);
  assert.equal(ctl.data().records[1].assisted, true, "assists survive restart");
});

test("a completed active game is not resumed on reload", async () => {
  const backend = memoryBackend();
  const a = setup({ backend });
  await a.ctl.init();
  const g = a.ctl.current();
  g.revealCell(solveAllBut(g, 1)[0]);
  a.ctl.commit();
  const b = setup({ backend });
  await b.ctl.init();
  assert.equal(b.generated.length, 1);
  assert.equal(b.ctl.game().completed, false);
});

test("holds pause the clock until every reason is released", async () => {
  const { ctl } = setup();
  await ctl.init();
  ctl.hold("menu");
  assert.equal(ctl.current().state.running, false);
  ctl.hold("hidden");
  ctl.release("menu");
  assert.equal(ctl.current().state.running, false);
  assert.equal(ctl.isHeld("hidden"), true);
  ctl.release("hidden");
  assert.equal(ctl.current().state.running, true);
  assert.equal(ctl.isHeld(), false);
  ctl.hold("menu");
  await ctl.actions.newGame("hard");
  assert.equal(ctl.current().state.running, false, "games loaded behind the menu stay paused");
});

test("setSetting validates, persists and emits", async () => {
  const { ctl, backend } = setup();
  const changes = [];
  ctl.on("change", (c) => changes.push(c));
  ctl.setSetting("theme", "ocean");
  ctl.setSetting("theme", "neon");
  ctl.setSetting("showTimer", false);
  assert.equal(ctl.settings().theme, "ocean");
  assert.equal(ctl.settings().showTimer, false);
  assert.equal(JSON.parse(backend.getItem(STORAGE_KEYS.settings)).theme, "ocean");
  assert.deepEqual(changes.map((c) => c.key), ["theme", "showTimer"], "no-op updates are not emitted");
});

test("startDaily creates the daily once and resumes it afterwards", async () => {
  const { ctl, flush } = setup();
  await ctl.init();
  const p = ctl.actions.startDaily("2026-10-28");
  await flush();
  await p;
  assert.equal(ctl.game().kind, "daily");
  assert.equal(ctl.game().dailyKey, "2026-10-28");
  const i = ctl.current().state.values.indexOf(0);
  ctl.current().enterDigit(i, SOLUTION[i]);
  ctl.commit();
  await ctl.actions.newGame("easy");
  await ctl.actions.startDaily("2026-10-28");
  assert.equal(ctl.game().id, "daily-2026-10-28");
  assert.equal(ctl.game().values[i], SOLUTION[i], "progress kept");
});

test("check, reveal, fill/clear notes go through the facade actions", async () => {
  const { ctl } = setup();
  await ctl.init();
  const checks = [];
  ctl.on("check", (w) => checks.push(w));
  const g = ctl.current();
  const i = g.state.values.indexOf(0);
  g.enterDigit(i, (SOLUTION[i] % 9) + 1);
  ctl.commit();
  assert.deepEqual(ctl.actions.check(), [i]);
  assert.deepEqual(checks, [[i]]);
  ctl.select(0);
  assert.equal(ctl.actions.revealCell(), true, "given selected → first wrong cell");
  assert.equal(ctl.game().values[i], SOLUTION[i]);
  assert.equal(ctl.selected(), i);
  ctl.actions.fillNotes();
  assert.ok(ctl.game().notes.some((n) => n));
  ctl.actions.clearNotes();
  assert.ok(ctl.game().notes.every((n) => n === 0));
  assert.deepEqual(ctl.game().assist, { hints: 0, checks: 1, reveals: 1, errorsShown: 0, autoNotes: 1 });
});

test("removeEntry of the current game starts a fresh one; other entries just go", async () => {
  const { ctl } = setup();
  await ctl.init();
  const first = ctl.game().id;
  await ctl.actions.newGame("easy");
  const second = ctl.game().id;
  ctl.actions.removeEntry(first);
  assert.equal(ctl.data().archive.entries[first], undefined);
  assert.equal(ctl.game().id, second);
  await ctl.actions.removeEntry(second);
  assert.notEqual(ctl.game().id, second);
  assert.ok(ctl.game());
});

test("export/import round trip keeps the current game active", async () => {
  const a = setup();
  await a.ctl.init();
  const text = a.ctl.actions.exportData();
  const b = setup();
  await b.ctl.init();
  const active = b.ctl.game().id;
  const res = b.ctl.actions.importData(text);
  assert.ok(res.added);
  assert.equal(b.ctl.data().archive.activeId, active);
  assert.throws(() => b.ctl.actions.importData("{nope"));
});

test("feedback is gated by the haptics/sounds settings", async () => {
  const calls = [];
  const platform = { haptic: (k) => calls.push(`h:${k}`), playSound: (k) => calls.push(`s:${k}`) };
  const { ctl } = setup({ platform });
  ctl.feedback("tap");
  assert.deepEqual(calls, []);
  ctl.setSetting("haptics", true);
  ctl.feedback("tap");
  ctl.setSetting("sounds", true);
  ctl.feedback("error");
  assert.deepEqual(calls, ["h:tap", "h:error", "s:error"]);
});

test("review prompt: only on native, only when the domain policy allows, at most once", async () => {
  const requests = [];
  const platform = { isNative: () => true, requestReview: () => requests.push(1) };
  const { ctl, flush } = setup({ platform });
  await ctl.init();
  for (let n = 0; n < 6; n++) {
    const g = ctl.current();
    g.enterDigit(...(() => { const [i] = solveAllBut(g, 1); return [i, SOLUTION[i]]; })());
    ctl.commit();
    await ctl.actions.newGame("easy");
  }
  await flush();
  assert.equal(requests.length, 1);
  assert.ok(ctl.data().meta.reviewPromptedAt > 0);

  const web = setup({ platform: { isNative: () => false, requestReview: () => requests.push(2) } });
  await web.ctl.init();
  for (let n = 0; n < 6; n++) {
    const g = web.ctl.current();
    const [i] = solveAllBut(g, 1);
    g.enterDigit(i, SOLUTION[i]);
    web.ctl.commit();
    await web.ctl.actions.newGame("easy");
  }
  await web.flush();
  assert.equal(requests.length, 1);
  assert.equal(web.ctl.data().meta.reviewPromptedAt, null);
});

test("legacy v1 saves are migrated and resumed", async () => {
  const backend = memoryBackend();
  const values = PUZZLE.slice();
  const i = values.indexOf(0);
  values[i] = SOLUTION[i];
  backend.setItem("sudoku-app:game", JSON.stringify({
    version: 1, savedAt: 1700000005000,
    game: {
      difficulty: "medium", puzzle: PUZZLE, solution: SOLUTION, values, notes: new Array(81).fill(0),
      mistakes: 1, hints: 2, elapsedMs: 5000, running: false, completed: false, gameOverShown: false,
      history: { actions: [{ cells: [{ i, before: { v: 0, n: 0 }, after: { v: SOLUTION[i], n: 0 } }] }], index: 1 },
      createdAt: 1700000000000
    }
  }));
  backend.setItem("sudoku-app:settings", JSON.stringify({ theme: "dark" }));
  const { ctl, generated } = setup({ backend });
  await ctl.init();
  assert.equal(generated.length, 0);
  const g = ctl.game();
  assert.equal(g.difficulty, "medium");
  assert.equal(g.assist.hints, 2);
  assert.equal(g.values[i], SOLUTION[i]);
  assert.equal(ctl.settings().colorMode, "dark");
  assert.equal(Object.keys(ctl.data().archive.entries).length, 1, "same archive entry, no duplicate");
  assert.ok(backend.getItem("sudoku-app:game"), "legacy key left in place");
});
