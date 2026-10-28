/**
 * Bootstrap: wires the controller (game + domain data) to the gameplay views,
 * builds the `app` facade for the menu/win/onboarding modules
 * (docs/UI-CONTRACT.md), applies settings to <html>, handles input, autosave,
 * app-state changes and the `?test=1` hooks (ROADMAP §2.5).
 */
import { getHint } from "./engine/index.js";
import * as platform from "./platform/index.js";
import { createController } from "./ui/controller.js";
import { createBoard } from "./ui/board.js";
import { createPad } from "./ui/pad.js";
import { createToolbar } from "./ui/toolbar.js";
import { createStatus } from "./ui/status.js";
import { createHintPanel } from "./ui/hint-panel.js";
import { createConfirm } from "./ui/confirm.js";
import { digitKeyAction, keyToCommand, moveIndex } from "./ui/keys.js";
import { boardView, htmlAttributes, newlyShownErrors, padView } from "./ui/view-model.js";
import { createMenu } from "./ui/menu/index.js";
import { createWinDialog } from "./ui/win.js";
import { createOnboarding } from "./ui/onboarding.js";

/** Hidden longer than this → come back to the pause menu (brief switches never pause). */
const HIDDEN_PAUSE_MS = 10_000;
const AUTOSAVE_MS = 5_000;

const $ = (id) => document.getElementById(id);
const html = document.documentElement;
const params = new URLSearchParams(location.search);

/** localStorage, or an in-memory stand-in when storage is blocked. */
function storageBackend() {
  try {
    const probe = "sudoku:probe";
    localStorage.setItem(probe, "1");
    localStorage.removeItem(probe);
    return localStorage;
  } catch {
    const map = new Map();
    return {
      getItem: (k) => (map.has(k) ? map.get(k) : null),
      setItem: (k, v) => void map.set(k, String(v)),
      removeItem: (k) => void map.delete(k)
    };
  }
}

const ctl = createController({ backend: storageBackend(), platform });

/** Transient UI state (not persisted). */
const ui = {
  notesMode: false,
  /** number-first: the digit being placed */
  selectedDigit: null,
  /** @type {{hint:any, step:number, open:boolean}|null} */
  hint: null,
  /** cells marked by Check → value at the time (cleared when the cell changes) */
  flagged: new Map(),
  /** wrong entries already counted as shown ("index:digit") */
  seenErrors: new Set(),
  gameId: null
};

// ---- settings → <html> ------------------------------------------------------

const media = {
  dark: window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null,
  motion: window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null
};

function applySettings() {
  const a = htmlAttributes(ctl.settings(), {
    prefersDark: Boolean(media.dark && media.dark.matches),
    prefersReducedMotion: Boolean(media.motion && media.motion.matches)
  });
  html.dataset.theme = a.theme;
  html.dataset.mode = a.mode;
  html.dataset.text = a.text;
  html.dataset.motion = a.motion;
  if (a.cb) html.dataset.cb = a.cb;
  else delete html.dataset.cb;
  html.dataset.input = ctl.settings().inputMode;
  // Keep the browser chrome in step with a forced light/dark choice.
  const bg = getComputedStyle(html).getPropertyValue("--bg").trim();
  if (bg) for (const meta of document.querySelectorAll('meta[name="theme-color"]')) meta.setAttribute("content", bg);
}
for (const mq of [media.dark, media.motion]) mq?.addEventListener?.("change", applySettings);

// ---- views ------------------------------------------------------------------

const app = buildFacade();
const confirmDialog = createConfirm($("app"));
const board = createBoard($("board"), { onCellTap });
document.querySelector(".skip-link")?.addEventListener("click", (event) => {
  event.preventDefault();
  board.focus();
});
const pad = createPad($("numpad"), { onDigit });
const toolbar = createToolbar($("tools"), onTool);
const status = createStatus({ status: $("status"), progress: $("progress") }, { onPause: () => menu.open() });
const hintPanel = createHintPanel($("hint-panel"), {
  onStep: hintStep,
  onFill: hintFill,
  onTry: () => {
    if (ui.hint) ui.hint.open = false;
    hintPanel.hide();
    render();
    board.focus();
  },
  onClose: closeHint,
  onReveal: () => {
    closeHint();
    if (ctl.actions.revealCell()) afterReveal();
  }
});
const menu = createMenu({
  root: $("menu-root"),
  app,
  onOpen: () => {
    ctl.hold("menu");
    $("app").dataset.paused = "true";
    ctl.save();
    render();
  },
  onClose: () => {
    ctl.release("menu");
    delete $("app").dataset.paused;
    render();
  }
});
const win = createWinDialog({ root: $("win-root"), app });
const onboarding = createOnboarding({ root: $("onboarding-root"), app });

/** The facade of docs/UI-CONTRACT.md handed to C2 modules. */
function buildFacade() {
  const thenClose = (fn) => async (...args) => {
    const result = await fn(...args);
    if (menu.isOpen()) menu.close();
    return result;
  };
  return {
    data: ctl.data,
    settings: ctl.settings,
    setSetting: ctl.setSetting,
    game: ctl.game,
    actions: {
      ...ctl.actions,
      resume: () => (menu.isOpen() ? menu.close() : ctl.release("menu")),
      newGame: thenClose(ctl.actions.newGame),
      startDaily: thenClose(ctl.actions.startDaily),
      continueEntry: thenClose(ctl.actions.continueEntry),
      restoreRecovery: thenClose(ctl.actions.restoreRecovery),
      revealCell: () => {
        const ok = ctl.actions.revealCell();
        if (ok) afterReveal();
        return ok;
      }
    },
    on: ctl.on
  };
}

// ---- rendering ----------------------------------------------------------------

function announce(message) {
  const node = $("sr-status");
  node.textContent = "";
  requestAnimationFrame(() => (node.textContent = message));
}

let toastTimer = 0;
function toast(message) {
  const node = $("toast");
  node.textContent = message;
  node.hidden = false;
  node.dataset.show = "true";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    delete node.dataset.show;
    node.hidden = true;
  }, 2200);
}

function resetForGame(game) {
  ui.gameId = game.state.id;
  ui.hint = null;
  hintPanel.hide();
  ui.flagged.clear();
  ui.seenErrors = new Set();
  ui.selectedDigit = null;
  // Wrong entries visible on load were counted when they were first shown.
  if (ctl.settings().showMistakes) newlyShownErrors(game.state, ui.seenErrors);
}

function flaggedSet(values) {
  const set = new Set();
  for (const [i, v] of ui.flagged) {
    if (values[i] === v) set.add(i);
    else ui.flagged.delete(i);
  }
  return set;
}

function render(focusSelected = false) {
  const game = ctl.current();
  const loading = ctl.loading();
  $("app").dataset.ready = game ? "true" : "false";
  if (!game) return;
  if (game.state.id !== ui.gameId) resetForGame(game);
  const s = ctl.settings();
  const state = game.state;
  const numberFirst = s.inputMode === "number-first";
  const remaining = game.remainingCounts();
  if (numberFirst && ui.selectedDigit && remaining[ui.selectedDigit] === 0 && !ui.notesMode) ui.selectedDigit = null;

  board.render(
    boardView({
      state,
      selected: ctl.selected(),
      digit: numberFirst ? ui.selectedDigit : null,
      settings: s,
      flagged: flaggedSet(state.values),
      hint: ui.hint ? { hint: ui.hint.hint, step: ui.hint.open ? ui.hint.step : 0 } : null
    }),
    focusSelected
  );
  pad.render(padView(remaining, { selectedDigit: numberFirst ? ui.selectedDigit : null, notesMode: ui.notesMode }));
  toolbar.render({
    canUndo: game.canUndo(),
    canRedo: game.canRedo(),
    notes: ui.notesMode,
    playable: !state.completed && !loading
  });
  status.render({ ...state, progress: game.progress() }, s);
  $("app").dataset.notes = ui.notesMode ? "on" : "off";
  $("app").dataset.completed = state.completed ? "true" : "false";
}

// ---- gameplay -----------------------------------------------------------------

function playable() {
  const game = ctl.current();
  return game && !game.state.completed && !ctl.loading() ? game : null;
}

/** Count newly visible mistakes, drop a stale hint, persist and re-render. */
function afterAction(reason = "action") {
  const game = ctl.current();
  if (ui.hint) {
    ui.hint = null;
    hintPanel.hide();
  }
  if (game && ctl.settings().showMistakes) {
    const n = newlyShownErrors(game.state, ui.seenErrors);
    if (n) game.markErrorsShown(n);
  }
  ctl.commit(reason);
}

function afterReveal() {
  ui.hint = null;
  hintPanel.hide();
  render();
  announce("Cell revealed.");
}

function applyDigit(index, digit, forceNote = false) {
  const game = playable();
  if (!game || game.isGiven(index)) return;
  const s = ctl.settings();
  let changed;
  if (forceNote || ui.notesMode) {
    changed = game.toggleNote(index, digit);
    if (changed) ctl.feedback("tap");
  } else if (game.state.values[index] === digit) {
    changed = game.erase(index);
    if (changed) ctl.feedback("tap");
  } else {
    changed = game.enterDigit(index, digit, { cleanupNotes: s.cleanupNotes });
    if (changed && !game.state.completed) ctl.feedback(game.state.lastEvent === "mistake" ? "error" : "place");
  }
  if (changed) afterAction("input");
}

function onCellTap(index) {
  const s = ctl.settings();
  ctl.select(index);
  if (s.inputMode === "number-first" && ui.selectedDigit) {
    applyDigit(index, ui.selectedDigit);
    render();
    return;
  }
  render();
}

function onDigit(digit) {
  if (!playable()) return;
  if (ctl.settings().inputMode === "number-first") {
    ui.selectedDigit = ui.selectedDigit === digit ? null : digit;
    ctl.feedback("tap");
    render();
    return;
  }
  const selected = ctl.selected();
  if (selected === null) {
    announce("Select a cell first.");
    toast("Select a cell first");
    return;
  }
  applyDigit(selected, digit);
}

function eraseSelected() {
  const game = playable();
  const selected = ctl.selected();
  if (!game || selected === null) return;
  if (game.erase(selected)) {
    ctl.feedback("tap");
    afterAction("erase");
  }
}

function toggleNotesMode() {
  ui.notesMode = !ui.notesMode;
  announce(ui.notesMode ? "Notes on" : "Notes off");
  render();
}

function undo() {
  const game = ctl.current();
  if (game && game.undo()) afterAction("undo");
}

function redo() {
  const game = ctl.current();
  if (game && game.redo()) afterAction("redo");
}

function openHint() {
  const game = playable();
  if (!game) return;
  if (ui.hint && ui.hint.open) {
    if (ui.hint.hint && ui.hint.step < 2) hintStep(ui.hint.step + 1);
    else hintPanel.focus();
    return;
  }
  const { values, notes, solution } = game.state;
  const selected = ctl.selected();
  const hint = getHint(values, notes, solution, selected === null ? {} : { focusIndex: selected });
  ui.hint = { hint, step: 0, open: true };
  hintPanel.show(hint, 0);
  if (hint) {
    game.hintShown(hint);
    ctl.commit("hint");
  } else {
    render();
  }
  hintPanel.focus();
}

function hintStep(step) {
  if (!ui.hint || !ui.hint.hint) return;
  ui.hint.step = Math.min(2, step);
  hintPanel.show(ui.hint.hint, ui.hint.step);
  if (ui.hint.step === 2) ctl.select(ui.hint.hint.placement.index);
  render();
  hintPanel.focus();
}

function hintFill() {
  const game = playable();
  if (!game || !ui.hint || !ui.hint.hint) return closeHint();
  const hint = ui.hint.hint;
  if (game.applyHint(hint)) {
    ctl.select(hint.placement.index);
    if (!game.state.completed) ctl.feedback("place");
    afterAction("hint");
  } else {
    closeHint();
  }
  board.focus();
}

function closeHint() {
  ui.hint = null;
  hintPanel.hide();
  render();
}

async function restart() {
  const game = ctl.current();
  if (!game || ctl.loading()) return;
  if (ctl.settings().confirmRestart) {
    ctl.hold("dialog");
    const ok = await confirmDialog({
      title: "Restart this puzzle?",
      body: "Your entries, notes, mistakes and time will be cleared. Assists already used still count.",
      confirm: "Restart"
    });
    ctl.release("dialog");
    if (!ok) return;
  }
  ui.hint = null;
  hintPanel.hide();
  ctl.actions.restart();
}

function onTool(id) {
  switch (id) {
    case "undo": return undo();
    case "redo": return redo();
    case "erase": return eraseSelected();
    case "notes": return toggleNotesMode();
    case "hint": return openHint();
    case "check": {
      if (!playable()) return;
      const wrong = ctl.actions.check();
      const msg = wrong.length
        ? `${wrong.length} incorrect ${wrong.length === 1 ? "entry" : "entries"} marked`
        : "No mistakes so far";
      toast(msg);
      announce(msg);
      return;
    }
    case "autonotes":
      if (!playable()) return;
      ctl.actions.fillNotes();
      toast("Notes filled in");
      return;
    case "restart": return restart();
    default:
  }
}

// ---- keyboard -------------------------------------------------------------------

function modalOpen() {
  if (menu.isOpen()) return true;
  return [...document.querySelectorAll('[aria-modal="true"]')].some((n) => n.getClientRects().length > 0);
}

document.addEventListener("keydown", (event) => {
  if (event.defaultPrevented || event.isComposing) return;
  const target = event.target;
  if (target instanceof HTMLElement && target.closest("input, textarea, select, [contenteditable='true']")) return;
  const cmd = keyToCommand(event);
  if (!cmd) return;
  if (modalOpen()) {
    if (cmd.type === "pause" && menu.isOpen()) {
      event.preventDefault();
      menu.close();
    }
    return;
  }
  event.preventDefault();
  const selected = ctl.selected();
  switch (cmd.type) {
    case "digit":
      if (digitKeyAction(cmd, { inputMode: ctl.settings().inputMode, selected }) === "pick") return onDigit(cmd.digit);
      return applyDigit(selected, cmd.digit, cmd.note);
    case "move":
      ctl.select(moveIndex(selected, cmd.dr, cmd.dc));
      render();
      return board.focus();
    case "erase": return eraseSelected();
    case "toggleNotes": return toggleNotesMode();
    case "undo": return undo();
    case "redo": return redo();
    case "hint": return openHint();
    case "pause": return menu.open();
    case "escape":
      if (ui.hint && ui.hint.open) {
        closeHint();
        return board.focus();
      }
      if (ui.hint) return closeHint();
      if (ui.selectedDigit) {
        ui.selectedDigit = null;
        return render();
      }
      return menu.open();
    default:
  }
});

// Keyboard focus entering the board (Tab) selects the focused cell.
$("board").addEventListener("focusin", (event) => {
  const cell = event.target.closest(".cell");
  if (cell && Number(cell.dataset.index) !== ctl.selected()) {
    ctl.select(Number(cell.dataset.index));
    render();
  }
});

// ---- controller events ------------------------------------------------------------

ctl.on("change", ({ reason, key } = {}) => {
  if (reason === "settings") {
    applySettings();
    if (key === "inputMode") ui.selectedDigit = null;
    if (key === "showMistakes" && ctl.settings().showMistakes) {
      const game = ctl.current();
      const n = game ? newlyShownErrors(game.state, ui.seenErrors) : 0;
      if (n) {
        game.markErrorsShown(n);
        ctl.save();
      }
    }
  }
  if (reason === "restart") {
    ui.flagged.clear();
    ui.seenErrors = new Set();
  }
  render();
  if (menu.isOpen()) menu.refresh();
});

ctl.on("check", (wrong) => {
  const game = ctl.current();
  if (!game) return;
  for (const i of wrong) ui.flagged.set(i, game.state.values[i]);
  render();
});

ctl.on("loading", (loading) => {
  const node = $("loading");
  node.hidden = !loading;
  $("loading-text").textContent = loading ? loading.label : "";
  $("app").dataset.loading = loading ? "true" : "false";
});

ctl.on("win", (result) => {
  ui.hint = null;
  ui.selectedDigit = null;
  hintPanel.hide();
  render();
  announce("Puzzle solved!");
  const delay = html.dataset.motion === "reduce" ? 0 : 700;
  setTimeout(() => win.show(result), delay);
});

ctl.on("error", (err) => {
  toast("Something went wrong. Please try again.");
  if (typeof console !== "undefined") console.error(err);
});

// ---- timer, autosave and app state ---------------------------------------------------

let lastSave = 0;
setInterval(() => {
  const game = ctl.current();
  if (!game || !game.state.running) return;
  status.renderTime(game.tick());
  const now = Date.now();
  if (now - lastSave >= AUTOSAVE_MS) {
    lastSave = now;
    ctl.save();
  }
}, 250);

let hiddenAt = null;
platform.onAppStateChange((active) => {
  if (!active) {
    if (hiddenAt === null) hiddenAt = Date.now();
    ctl.hold("hidden");
    ctl.save();
    return;
  }
  const away = hiddenAt === null ? 0 : Date.now() - hiddenAt;
  hiddenAt = null;
  const game = ctl.current();
  // Brief switches resume silently; long absences come back to the pause menu.
  if (away > HIDDEN_PAUSE_MS && game && !game.state.completed && !menu.isOpen() && !modalOpen()) menu.open();
  ctl.release("hidden");
  render();
});
window.addEventListener("pagehide", () => ctl.save());

// ---- test hooks (ROADMAP §2.5) -----------------------------------------------------------

if (params.get("test") === "1") {
  window.__sudoku = {
    state: () => ctl.game(),
    load(puzzle, solution) {
      ctl.loadPuzzle(puzzle, solution);
      render();
    },
    fillAllBut(n) {
      const game = ctl.current();
      if (!game || game.state.completed) return;
      const { values, solution } = game.state;
      const open = values.flatMap((v, i) => (v !== solution[i] ? [i] : []));
      const keep = Math.max(0, Math.min(open.length, Number(n) || 0));
      for (const i of open.slice(0, open.length - keep)) game.enterDigit(i, solution[i], { cleanupNotes: true });
      afterAction("test");
    },
    settings: () => ctl.settings()
  };
}

// ---- start ---------------------------------------------------------------------------------

applySettings();
ctl
  .init({ seed: params.get("seed"), difficulty: params.get("difficulty") })
  .then(async () => {
    if (!ctl.current()) await ctl.actions.newGame("easy");
    render();
    onboarding.maybeShow();
    setTimeout(() => platform.registerServiceWorker(), 0);
  });
