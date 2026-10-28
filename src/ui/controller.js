/**
 * App controller: owns the current Game, the domain AppData and persistence.
 * DOM-free so it can be unit tested with an in-memory backend; main.js wires
 * it to the views and builds the `app` facade of docs/UI-CONTRACT.md on top.
 * @module ui/controller
 */
import { Game } from "../game.js";
import { DIFFICULTIES, dailyPuzzle, generatePuzzleAsync } from "../engine/index.js";
import {
  createRecord,
  createStore,
  exportData,
  importData,
  markCompleted,
  normalizeSettings,
  personalBest,
  removeEntry,
  restoreRecovery,
  resume as resumeEntry,
  saveActive,
  shouldPromptReview,
  startNew
} from "../domain/index.js";

/** @typedef {import('../game.js').GameJSON} GameJSON */
/** @typedef {'change'|'win'|'check'|'error'|'loading'} ControllerEvent */

/** @returns {string} a random base-36 seed */
function randomSeed() {
  const c = globalThis.crypto;
  if (c && typeof c.getRandomValues === "function") {
    const a = new Uint32Array(2);
    c.getRandomValues(a);
    return a[0].toString(36) + a[1].toString(36);
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/**
 * @param {object} opts
 * @param {import('../domain/index.js').Backend} opts.backend localStorage-compatible
 * @param {{haptic?:Function, playSound?:Function, requestReview?:Function, isNative?:Function}} [opts.platform]
 * @param {(difficulty:string, opts:object) => Promise<object>} [opts.generate]
 * @param {(dateKey:string) => object} [opts.daily]
 * @param {() => number} [opts.clock] wall clock (ms)
 * @param {() => string} [opts.seed] random seed source
 * @param {(fn:Function, ms:number) => any} [opts.schedule]
 */
export function createController({
  backend,
  platform = {},
  generate = generatePuzzleAsync,
  daily = dailyPuzzle,
  clock = () => Date.now(),
  seed = randomSeed,
  schedule = (fn, ms) => setTimeout(fn, ms)
}) {
  const store = createStore(backend);
  /** Yield one task so the loading state can paint before (possibly synchronous) generation. */
  const paint = () => new Promise((r) => setTimeout(r, 0));
  let data = store.load();
  /** @type {Game|null} */
  let game = null;
  /** @type {{label:string}|null} */
  let loading = null;
  let loadToken = 0;
  let selected = null;
  const holds = new Set();
  const listeners = new Map();

  function emit(event, payload) {
    for (const fn of listeners.get(event) || []) {
      try {
        fn(payload);
      } catch (err) {
        if (event !== "error") emit("error", err);
      }
    }
  }

  /**
   * @param {ControllerEvent} event
   * @param {(payload:any) => void} fn
   * @returns {() => void} unsubscribe
   */
  function on(event, fn) {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(fn);
    return () => listeners.get(event).delete(fn);
  }

  function applyHolds() {
    if (!game || game.state.completed) return;
    if (holds.size) game.pause();
    else game.resume();
  }

  /** Persist the current game; returns win info when it just completed. */
  function persist() {
    if (!game) return null;
    const json = game.toJSON();
    const now = clock();
    const prev = data.archive.entries[json.id];
    const newlyWon = json.completed && (!prev || prev.status !== "completed");
    data.archive = saveActive(data.archive, json, now);
    let win = null;
    if (newlyWon) {
      data.archive = markCompleted(data.archive, json.id, now);
      const record = createRecord(json);
      if (data.records.some((r) => r.id === record.id)) record.id = `${record.id}-${json.completedAt}`;
      const pb = personalBest(data.records, record);
      data.records = [...data.records, record];
      data.meta = { ...data.meta, completedCount: (data.meta.completedCount || 0) + 1 };
      store.saveRecords(data.records);
      win = { game: json, record, personalBest: pb, score: record.score };
    }
    store.saveArchive(data.archive);
    if (win) {
      if (shouldPromptReview(data.meta, data.records, now) && platform.isNative?.()) {
        data.meta = { ...data.meta, reviewPromptedAt: now };
        schedule(() => platform.requestReview?.(), 2500);
      }
      store.saveMeta(data.meta);
    }
    return win;
  }

  /**
   * Save after a gameplay action, emit 'change' and, on a fresh completion,
   * record the result and emit 'win'.
   * @param {string} [reason]
   */
  function commit(reason = "action") {
    const win = persist();
    emit("change", { reason });
    if (win) {
      feedback("success");
      emit("win", win);
    }
  }

  /** Save without notifying (timer autosave, app hidden). */
  function save() {
    if (game) game.tick();
    const win = persist();
    if (win) emit("win", win);
  }

  /** @param {Game} next */
  function setGame(next) {
    game = next;
    selected = null;
    applyHolds();
  }

  function loadEntry(id) {
    const entry = data.archive.entries[id];
    if (!entry) return false;
    try {
      setGame(Game.fromJSON({ ...entry.game, id: entry.id }));
      game.resume();
      applyHolds();
      return true;
    } catch (err) {
      emit("error", err);
      return false;
    }
  }

  function setLoading(label) {
    loading = label ? { label } : null;
    emit("loading", loading);
    emit("change", { reason: "loading" });
  }

  /**
   * Generate and start a new random game. The previous game stays in the
   * archive (Continue); it is never discarded.
   * @param {string} difficulty
   * @param {{seed?:string}} [opts]
   */
  async function newGame(difficulty, opts = {}) {
    const diff = DIFFICULTIES.includes(difficulty) ? difficulty : data.settings.lastDifficulty;
    const token = ++loadToken;
    if (game) save();
    setLoading(`Creating a${diff === "easy" || diff === "expert" ? "n" : ""} ${diff} puzzle…`);
    try {
      await paint();
      const generated = await generate(diff, { seed: opts.seed ?? seed() });
      if (token !== loadToken) return;
      const next = Game.create(generated);
      data.archive = startNew(data.archive, next.toJSON(), clock());
      store.saveArchive(data.archive);
      setGame(next);
      if (data.settings.lastDifficulty !== diff) setSetting("lastDifficulty", diff);
    } catch (err) {
      if (token === loadToken) emit("error", err);
    } finally {
      if (token === loadToken) setLoading(null);
    }
  }

  /**
   * Start (or resume) the daily puzzle for a UTC date key.
   * @param {string} dateKey 'YYYY-MM-DD'
   */
  async function startDaily(dateKey) {
    const existing = Object.values(data.archive.entries).find((e) => e.dailyKey === dateKey && e.kind === "daily");
    if (game) save();
    if (existing) {
      data.archive = resumeEntry(data.archive, existing.id);
      store.saveArchive(data.archive);
      loadEntry(existing.id);
      emit("change", { reason: "load" });
      return;
    }
    const token = ++loadToken;
    setLoading("Preparing today’s puzzle…");
    try {
      await paint();
      const generated = await daily(dateKey);
      if (token !== loadToken) return;
      const next = Game.create(generated, { kind: "daily", dailyKey: dateKey });
      data.archive = startNew(data.archive, next.toJSON(), clock());
      store.saveArchive(data.archive);
      setGame(next);
    } catch (err) {
      if (token === loadToken) emit("error", err);
    } finally {
      if (token === loadToken) setLoading(null);
    }
  }

  /**
   * Initial game: `?seed=` starts (or resumes) that deterministic game; otherwise resume
   * the active unfinished game, else start a new one.
   * @param {{seed?:string|null, difficulty?:string|null}} [opts]
   */
  async function init({ seed: forcedSeed = null, difficulty = null } = {}) {
    if (forcedSeed) {
      const diff = DIFFICULTIES.includes(difficulty) ? difficulty : data.settings.lastDifficulty;
      // Reloading a ?seed= URL resumes that game instead of overwriting its progress.
      const same = Object.values(data.archive.entries).find(
        (e) => e.status !== "completed" && e.kind === "random" && e.game?.seed === String(forcedSeed) && e.difficulty === diff
      );
      if (same && loadEntry(same.id)) {
        data.archive = resumeEntry(data.archive, same.id);
        store.saveArchive(data.archive);
        emit("change", { reason: "load" });
        return;
      }
      return newGame(diff, { seed: forcedSeed });
    }
    const active = data.archive.activeId && data.archive.entries[data.archive.activeId];
    if (active && active.status !== "completed" && loadEntry(active.id)) {
      emit("change", { reason: "load" });
      return;
    }
    return newGame(DIFFICULTIES.includes(difficulty) ? difficulty : data.settings.lastDifficulty);
  }

  /**
   * Validate through normalizeSettings and persist; invalid values are ignored.
   * @param {string} key @param {any} value
   */
  function setSetting(key, value) {
    const next = normalizeSettings({ ...data.settings, [key]: value });
    // normalizeSettings resets invalid values to defaults; keep the current value instead.
    if (next[key] !== value || JSON.stringify(next) === JSON.stringify(data.settings)) return;
    data.settings = next;
    store.saveSettings(next);
    emit("change", { reason: "settings", key });
  }

  /** @param {'tap'|'place'|'error'|'success'} kind */
  function feedback(kind) {
    if (data.settings.haptics) platform.haptic?.(kind);
    if (data.settings.sounds) platform.playSound?.(kind);
  }

  function firstOpenCell() {
    if (!game) return null;
    const { values, solution, puzzle } = game.state;
    const wrong = values.findIndex((v, i) => !puzzle[i] && v && v !== solution[i]);
    if (wrong >= 0) return wrong;
    const empty = values.indexOf(0);
    return empty >= 0 ? empty : null;
  }

  const actions = {
    newGame,
    startDaily,
    /** @param {string} id */
    continueEntry(id) {
      if (!data.archive.entries[id]) return;
      if (game) save();
      data.archive = resumeEntry(data.archive, id);
      store.saveArchive(data.archive);
      loadEntry(id);
      emit("change", { reason: "load" });
    },
    /** @param {string} id @param {number} savedAt */
    restoreRecovery(id, savedAt) {
      if (game) save();
      data.archive = restoreRecovery(data.archive, id, savedAt);
      store.saveArchive(data.archive);
      loadEntry(id);
      emit("change", { reason: "load" });
    },
    /** Explicit user delete only. Deleting the current game starts a new one. @param {string} id */
    removeEntry(id) {
      const current = game && game.state.id === id;
      data.archive = removeEntry(data.archive, id);
      store.saveArchive(data.archive);
      if (current) {
        game = null;
        emit("change", { reason: "remove" });
        return newGame(data.settings.lastDifficulty);
      }
      emit("change", { reason: "remove" });
    },
    restart() {
      if (!game) return;
      game.restart();
      applyHolds();
      commit("restart");
    },
    /** @returns {number[]} wrong indices */
    check() {
      if (!game) return [];
      const wrong = game.check();
      commit("check");
      emit("check", wrong);
      feedback(wrong.length ? "error" : "success");
      return wrong;
    },
    /** Reveal the selected cell (or the first wrong/empty one). @returns {boolean} */
    revealCell(index = selected) {
      if (!game) return false;
      let target = Number.isInteger(index) && !game.isGiven(index) ? index : null;
      if (target === null || game.state.values[target] === game.state.solution[target]) target = firstOpenCell();
      if (target === null) return false;
      const ok = game.revealCell(target);
      if (ok) {
        selected = target;
        feedback("place");
        commit("reveal");
      }
      return ok;
    },
    fillNotes() {
      if (!game) return;
      game.fillNotes();
      commit("notes");
    },
    clearNotes() {
      if (!game) return;
      game.clearNotes();
      commit("notes");
    },
    /** @returns {string} export JSON */
    exportData() {
      if (game) save();
      return exportData(data);
    },
    /** @param {string} text @returns {{added:object, conflicts:Array}} throws ImportError */
    importData(text) {
      if (game) save();
      const res = importData(data, text);
      data = { ...res.data, archive: { ...res.data.archive, activeId: data.archive.activeId } };
      store.saveSettings(data.settings);
      store.saveArchive(data.archive);
      store.saveRecords(data.records);
      store.saveMeta(data.meta);
      emit("change", { reason: "import" });
      return { added: res.added, conflicts: res.conflicts };
    }
  };

  return {
    init,
    on,
    commit,
    save,
    feedback,
    setSetting,
    actions,
    /** @returns {import('../domain/index.js').AppData} live data */
    data: () => data,
    settings: () => data.settings,
    /** @returns {Game|null} the live Game instance (gameplay views mutate it, then call commit) */
    current: () => game,
    /** @returns {GameJSON|null} */
    game: () => (game ? game.toJSON() : null),
    loading: () => loading,
    /** Selected cell shared by board, keyboard and the reveal tool. */
    selected: () => selected,
    select(index) {
      selected = Number.isInteger(index) && index >= 0 && index < 81 ? index : null;
    },
    /** Pause the clock for a reason ('menu', 'hidden', 'dialog'); runs again when no reason is left. */
    hold(reason) {
      holds.add(reason);
      applyHolds();
    },
    release(reason) {
      holds.delete(reason);
      applyHolds();
    },
    isHeld: (reason) => (reason ? holds.has(reason) : holds.size > 0),
    /** Replace the current game with a custom puzzle (test hook). */
    loadPuzzle(puzzle, solution, difficulty = "easy") {
      const next = Game.create({ puzzle, solution, difficulty, seed: "test", id: `test-${clock()}`, grade: null });
      if (game) save();
      data.archive = startNew(data.archive, next.toJSON(), clock());
      store.saveArchive(data.archive);
      setGame(next);
      emit("change", { reason: "load" });
    }
  };
}
