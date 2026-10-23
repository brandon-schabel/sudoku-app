import { Game } from "./game.js";

export const GAME_KEY = "sudoku-app:game";
export const SETTINGS_KEY = "sudoku-app:settings";
export const SCHEMA_VERSION = 1;

const THEMES = ["auto", "light", "dark"];

function getStorage() {
  try {
    if (typeof globalThis === "undefined" || !globalThis.localStorage) return null;
    const storage = globalThis.localStorage;
    if (
      typeof storage.getItem !== "function" ||
      typeof storage.setItem !== "function" ||
      typeof storage.removeItem !== "function"
    ) {
      return null;
    }
    return storage;
  } catch {
    // Accessing localStorage can throw (for example in private mode).
    return null;
  }
}

function removeKey(key) {
  const storage = getStorage();
  if (!storage) return false;
  try {
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function saveGame(gameJSON) {
  const storage = getStorage();
  if (!storage || !gameJSON || typeof gameJSON !== "object") return false;
  try {
    const envelope = {
      version: SCHEMA_VERSION,
      savedAt: Date.now(),
      game: gameJSON
    };
    storage.setItem(GAME_KEY, JSON.stringify(envelope));
    return true;
  } catch {
    // Quota or serialization failures are non-fatal.
    return false;
  }
}

export function loadGame() {
  const storage = getStorage();
  if (!storage) return null;

  let raw;
  try {
    raw = storage.getItem(GAME_KEY);
  } catch {
    return null;
  }
  if (raw === null || raw === undefined) return null;

  try {
    const envelope = JSON.parse(raw);
    if (
      !envelope ||
      typeof envelope !== "object" ||
      !Number.isInteger(envelope.version) ||
      envelope.version !== SCHEMA_VERSION ||
      !envelope.game
    ) {
      clearGame();
      return null;
    }
    return Game.fromJSON(envelope.game);
  } catch {
    clearGame();
    return null;
  }
}

export function clearGame() {
  return removeKey(GAME_KEY);
}

export function saveSettings({ theme } = {}) {
  const storage = getStorage();
  if (!storage) return false;
  const safeTheme = THEMES.includes(theme) ? theme : "auto";
  try {
    storage.setItem(SETTINGS_KEY, JSON.stringify({ theme: safeTheme }));
    return true;
  } catch {
    return false;
  }
}

export function loadSettings() {
  const storage = getStorage();
  if (!storage) return { theme: "auto" };

  let raw;
  try {
    raw = storage.getItem(SETTINGS_KEY);
  } catch {
    return { theme: "auto" };
  }
  if (raw === null || raw === undefined) return { theme: "auto" };

  try {
    const settings = JSON.parse(raw);
    if (
      settings &&
      typeof settings === "object" &&
      THEMES.includes(settings.theme)
    ) {
      return { theme: settings.theme };
    }
  } catch {
    // Fall through to the default below.
  }
  removeKey(SETTINGS_KEY);
  return { theme: "auto" };
}
