import { Game } from "./game.js";
import { DIFFICULTIES, findConflicts } from "./sudoku.js";
import {
  loadGame,
  loadSettings,
  saveGame,
  saveSettings
} from "./storage.js";
import { createUI, formatTime } from "./ui.js";

const THEME_ORDER = ["auto", "light", "dark"];
const root = document.getElementById("app");

const mediaQuery =
  typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-color-scheme: dark)")
    : { matches: false, addEventListener: null, addListener: null };

const settings = loadSettings();
let theme = settings.theme;
let selectedDifficulty = "easy";
let selectedIndex = 0;
let noteMode = false;
let game = null;
let ui = null;
let timerId = null;
let lastSavedAt = 0;
let pauseMenuOpen = false;

function firstEmptyIndex(state) {
  const index = state.values.findIndex((value) => value === 0);
  return index === -1 ? 0 : index;
}

function resolvedTheme() {
  return theme === "auto" ? (mediaQuery.matches ? "dark" : "light") : theme;
}

function applyTheme() {
  document.documentElement.dataset.theme = resolvedTheme();
}

function nextTheme(value) {
  const index = THEME_ORDER.indexOf(value);
  return THEME_ORDER[(index < 0 ? 0 : index + 1) % THEME_ORDER.length];
}

function isPaused() {
  return !game.state.running && !game.state.completed;
}

function render() {
  const state = game.state;
  ui.render(state, {
    selectedIndex,
    noteMode,
    conflicts: findConflicts(state.values),
    paused: isPaused(),
    theme,
    selectedDifficulty
  });
}

function save() {
  saveGame(game.toJSON());
  lastSavedAt = Date.now();
}

function closePauseMenu({ resume = true } = {}) {
  if (!pauseMenuOpen) return;
  pauseMenuOpen = false;
  ui.closePauseMenu();
  if (resume && !game.state.completed) game.resume();
  save();
  render();
  if (resume) ui.announce("Timer resumed.");
}

function openPauseMenu() {
  if (!game || game.state.completed || ui.isModalOpen()) return;
  if (game.state.running) game.pause();
  pauseMenuOpen = true;
  save();
  render();
  ui.openPauseMenu({
    difficulty: selectedDifficulty,
    theme,
    hasProgress: hasProgress()
  });
  ui.announce("Game paused.");
}

function handleEvent() {
  const event = game.state.lastEvent;
  if (!event) return false;
  game.state.lastEvent = null;

  if (pauseMenuOpen) {
    pauseMenuOpen = false;
    ui.closePauseMenu({ restoreFocus: false });
  }

  if (event === "gameover") {
    ui.showModal("gameover", { mistakes: game.state.mistakes });
    ui.announce(
      "Game over. Three mistakes reached. Choose New game or Keep playing."
    );
    return true;
  }

  if (event === "win") {
    const state = game.state;
    ui.showModal("win", {
      time: formatTime(state.elapsedMs),
      difficulty: state.difficulty,
      mistakes: state.mistakes,
      hints: state.hints
    });
    ui.announce(
      `You solved the puzzle in ${formatTime(state.elapsedMs)} with ${
        state.mistakes
      } mistakes and ${state.hints} hints.`
    );
    return true;
  }

  return false;
}

function commit() {
  save();
  render();
  handleEvent();
}

function hasProgress() {
  const state = game.state;
  return (
    !state.completed &&
    (state.history.actions.length > 0 ||
      state.mistakes > 0 ||
      state.hints > 0 ||
      state.elapsedMs > 1500)
  );
}

function startNewGame(force) {
  if (!force && hasProgress()) {
    const confirmed = window.confirm(
      "A game is in progress. Start a new game? Your current progress will be lost."
    );
    if (!confirmed) return;
  }

  let nextGame;
  try {
    nextGame = Game.create(selectedDifficulty);
  } catch {
    ui.announce("Could not create a new puzzle. Please try again.");
    return;
  }

  game = nextGame;
  selectedIndex = firstEmptyIndex(game.state);
  noteMode = false;
  pauseMenuOpen = false;
  ui.closePauseMenu({ restoreFocus: false });
  ui.closeModal();
  save();
  render();
  ui.focusCell(selectedIndex);
  ui.announce(`New ${selectedDifficulty} game started.`);
}

function moveSelection(key) {
  const current = Number.isInteger(selectedIndex) ? selectedIndex : 0;
  let row = Math.floor(current / 9);
  let col = current % 9;

  if (key === "ArrowUp") row = Math.max(0, row - 1);
  else if (key === "ArrowDown") row = Math.min(8, row + 1);
  else if (key === "ArrowLeft") col = Math.max(0, col - 1);
  else if (key === "ArrowRight") col = Math.min(8, col + 1);
  else return;

  const next = row * 9 + col;
  if (next === selectedIndex) return;
  selectedIndex = next;
  render();
  ui.focusCell(next);
}

function dispatch(intent) {
  if (!intent || !game) return;
  const state = game.state;

  switch (intent.type) {
    case "select": {
      if (
        !Number.isInteger(intent.index) ||
        intent.index < 0 ||
        intent.index >= 81
      ) {
        return;
      }
      selectedIndex = intent.index;
      render();
      return;
    }

    case "digit": {
      if (isPaused() || state.completed) return;
      if (!Number.isInteger(intent.digit) || intent.digit < 1 || intent.digit > 9) {
        return;
      }
      if (noteMode) game.toggleNote(selectedIndex, intent.digit);
      else game.enterDigit(selectedIndex, intent.digit);
      commit();
      return;
    }

    case "erase": {
      if (isPaused() || state.completed) return;
      if (game.erase(selectedIndex)) commit();
      else render();
      return;
    }

    case "notes-toggle": {
      noteMode = !noteMode;
      render();
      ui.announce(noteMode ? "Notes mode on." : "Notes mode off.");
      return;
    }

    case "undo": {
      if (isPaused() || state.completed) return;
      if (game.undo()) {
        commit();
        ui.announce("Move undone.");
      } else {
        render();
      }
      return;
    }

    case "redo": {
      if (isPaused() || state.completed) return;
      if (game.redo()) {
        commit();
        ui.announce("Move redone.");
      } else {
        render();
      }
      return;
    }

    case "hint": {
      if (isPaused() || state.completed) return;
      const target = game.hint(selectedIndex);
      if (target === null) return;
      selectedIndex = target;
      save();
      render();
      if (!handleEvent()) {
        const row = Math.floor(target / 9) + 1;
        const col = (target % 9) + 1;
        ui.announce(`Hint placed in row ${row}, column ${col}.`);
      }
      return;
    }

    case "pause": {
      if (state.completed) return;
      if (pauseMenuOpen) closePauseMenu({ resume: true });
      else openPauseMenu();
      return;
    }

    case "resume": {
      closePauseMenu({ resume: true });
      return;
    }

    case "new-game": {
      startNewGame(Boolean(intent.force));
      return;
    }

    case "modal-new-game": {
      startNewGame(true);
      return;
    }

    case "restart": {
      if (!intent.force && hasProgress()) return;
      game.restart();
      selectedIndex = firstEmptyIndex(game.state);
      noteMode = false;
      if (pauseMenuOpen) {
        pauseMenuOpen = false;
        ui.closePauseMenu({ restoreFocus: false });
      }
      save();
      render();
      ui.focusCell(selectedIndex);
      ui.announce("Puzzle restarted.");
      return;
    }

    case "difficulty": {
      if (Object.prototype.hasOwnProperty.call(DIFFICULTIES, intent.difficulty)) {
        selectedDifficulty = intent.difficulty;
        ui.setDifficulty(selectedDifficulty);
        render();
        ui.announce(`Difficulty set to ${selectedDifficulty}.`);
      }
      return;
    }

    case "theme": {
      theme = THEME_ORDER.includes(intent.theme)
        ? intent.theme
        : nextTheme(theme);
      saveSettings({ theme });
      applyTheme();
      render();
      ui.announce(`Theme set to ${theme}.`);
      return;
    }

    case "close-modal": {
      ui.closeModal();
      return;
    }

    default:
      return;
  }
}

function isTextEntry(target) {
  if (!target) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable === true
  );
}

function handleKeydown(event) {
  if (event.defaultPrevented) return;
  if (ui.isModalOpen()) return;
  if (isTextEntry(event.target)) return;

  if (pauseMenuOpen) {
    const pauseKey = event.key.toLowerCase();
    if (event.key === "Escape") {
      event.preventDefault();
      dispatch({ type: "resume" });
      return;
    }
    if (pauseKey === "p") {
      event.preventDefault();
      dispatch({ type: "resume" });
      return;
    }
    if (event.key === " " || event.key === "Spacebar") {
      const target = event.target;
      const interactive = target && target.closest
        ? target.closest("button, summary")
        : null;
      if (interactive) return;
      event.preventDefault();
      dispatch({ type: "resume" });
      return;
    }
    return;
  }

  const modifier = event.metaKey || event.ctrlKey;
  const key = event.key;

  if (modifier) {
    const lower = key.toLowerCase();
    if (lower === "z" && !event.altKey) {
      event.preventDefault();
      dispatch({ type: event.shiftKey ? "redo" : "undo" });
      return;
    }
    if (lower === "y" && !event.altKey) {
      event.preventDefault();
      dispatch({ type: "redo" });
      return;
    }
    return;
  }

  if (event.altKey) return;

  if (key === "Escape") {
    event.preventDefault();
    dispatch({ type: "pause" });
    return;
  }

  if (/^[1-9]$/.test(key)) {
    event.preventDefault();
    dispatch({ type: "digit", digit: Number(key) });
    return;
  }

  if (key === "Backspace" || key === "Delete" || key === "0") {
    event.preventDefault();
    dispatch({ type: "erase" });
    return;
  }

  if (key.startsWith("Arrow")) {
    event.preventDefault();
    moveSelection(key);
    return;
  }

  if (key === " " || key === "Spacebar") {
    const target = event.target;
    if (
      target &&
      target.tagName === "BUTTON" &&
      !target.classList.contains("cell")
    ) {
      return;
    }
    event.preventDefault();
    dispatch({ type: "pause" });
    return;
  }

  const lower = key.toLowerCase();
  if (lower === "n") {
    event.preventDefault();
    dispatch({ type: "notes-toggle" });
  } else if (lower === "e") {
    event.preventDefault();
    dispatch({ type: "erase" });
  } else if (lower === "h") {
    event.preventDefault();
    dispatch({ type: "hint" });
  } else if (lower === "p") {
    event.preventDefault();
    dispatch({ type: "pause" });
  } else if (lower === "m") {
    event.preventDefault();
    dispatch({ type: "theme" });
  }
}

function startTimerLoop() {
  if (timerId !== null) return;
  timerId = window.setInterval(() => {
    if (!game.state.running) return;
    game.tick(performance.now());
    render();
    if (Date.now() - lastSavedAt >= 5000) save();
  }, 250);
}

function handleVisibilityChange() {
  if (document.hidden) {
    if (game.state.running) {
      game.pause();
      save();
      render();
      ui.announce("Game paused automatically while the tab was hidden.");
    }
    return;
  }

  if (
    !game.state.running &&
    !game.state.completed &&
    !ui.isModalOpen() &&
    !pauseMenuOpen
  ) {
    openPauseMenu();
  }
}

function handleSystemThemeChange() {
  if (theme !== "auto") return;
  applyTheme();
  render();
}

function initialGame() {
  const restored = loadGame();
  if (restored) {
    if (!restored.state.completed) restored.resume();
    return restored;
  }
  const fresh = Game.create("easy");
  saveGame(fresh.toJSON());
  return fresh;
}

applyTheme();
game = initialGame();
selectedDifficulty = game.state.difficulty;
selectedIndex = firstEmptyIndex(game.state);
ui = createUI({ root, dispatch });
ui.setDifficulty(selectedDifficulty);
render();
save();
lastSavedAt = Date.now();
startTimerLoop();

document.addEventListener("keydown", handleKeydown);
document.addEventListener("visibilitychange", handleVisibilityChange);
window.addEventListener("pagehide", save);

if (typeof mediaQuery.addEventListener === "function") {
  mediaQuery.addEventListener("change", handleSystemThemeChange);
} else if (typeof mediaQuery.addListener === "function") {
  mediaQuery.addListener(handleSystemThemeChange);
}
