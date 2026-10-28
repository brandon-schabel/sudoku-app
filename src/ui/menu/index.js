/**
 * STUB owned by C2 (docs/UI-CONTRACT.md): minimal pause menu so the app is
 * usable before the real unified menu lands. C2 replaces this file.
 * @module ui/menu
 */
import { h } from "../dom.js";
import { dailyKey } from "../../engine/index.js";

const DIFFS = [["easy", "Easy"], ["medium", "Medium"], ["hard", "Hard"], ["expert", "Expert"]];

function fmt(ms) {
  const s = Math.floor((ms || 0) / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * @param {{root:HTMLElement, app:any, onOpen?:() => void, onClose?:() => void}} opts
 * @returns {{open(view?:string):void, close():void, isOpen():boolean, refresh():void}}
 */
export function createMenu({ root, app, onOpen = () => {}, onClose = () => {} }) {
  let open = false;
  let previous = null;
  const summary = h("p", { class: "menu-summary" });
  const panel = h(
    "div",
    { class: "menu-panel", role: "dialog", "aria-modal": "true", "aria-labelledby": "menu-title", "data-testid": "menu" },
    h("h2", { id: "menu-title" }, "Paused"),
    summary,
    h("button", { type: "button", class: "btn btn-primary", "data-testid": "menu-resume", onClick: () => app.actions.resume() }, "Resume puzzle"),
    h("button", { type: "button", class: "btn", "data-testid": "menu-daily", onClick: () => app.actions.startDaily(dailyKey()) }, "Daily puzzle"),
    h("p", { class: "menu-label" }, "New game"),
    h("div", { class: "menu-row", "data-testid": "menu-new" },
      DIFFS.map(([id, label]) => h("button", { type: "button", class: "btn", "data-difficulty": id, onClick: () => app.actions.newGame(id) }, label))),
    h("button", { type: "button", class: "btn", "data-testid": "setting-colorMode",
      onClick: () => app.setSetting("colorMode", document.documentElement.dataset.mode === "dark" ? "light" : "dark") }, "Toggle dark mode"),
    h("button", { type: "button", class: "btn btn-quiet", "data-testid": "menu-return", onClick: () => app.actions.resume() }, "Return to puzzle")
  );
  const overlay = h("div", { class: "menu-overlay", hidden: true }, panel);
  root.append(overlay);
  overlay.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      api.close();
    }
  });

  const api = {
    open() {
      if (open) return;
      open = true;
      previous = document.activeElement;
      api.refresh();
      overlay.hidden = false;
      onOpen();
      panel.querySelector("[data-testid=menu-resume]").focus();
    },
    close() {
      if (!open) return;
      open = false;
      overlay.hidden = true;
      onClose();
      if (previous && previous.focus) previous.focus();
    },
    isOpen: () => open,
    refresh() {
      const g = app.game();
      summary.textContent = g
        ? `${g.difficulty[0].toUpperCase()}${g.difficulty.slice(1)} · ${fmt(g.elapsedMs)} · ${g.mistakes} mistakes · ${g.assist.hints} hints`
        : "";
    }
  };
  return api;
}
