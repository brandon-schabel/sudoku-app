/**
 * STUB owned by C2 (docs/UI-CONTRACT.md): minimal win dialog. C2 replaces this file.
 * @module ui/win
 */
import { h } from "./dom.js";

/**
 * @param {{root:HTMLElement, app:any}} opts
 * @returns {{show(result:{game:any, record:any, score:number, personalBest:any}):void, hide():void}}
 */
export function createWinDialog({ root, app }) {
  const body = h("p", {});
  const dialog = h(
    "div",
    { class: "win-overlay", hidden: true },
    h("div", { class: "win-panel", role: "dialog", "aria-modal": "true", "aria-labelledby": "win-title", "data-testid": "win-dialog" },
      h("h2", { id: "win-title" }, "Solved!"),
      body,
      h("button", { type: "button", class: "btn btn-primary", onClick: () => { api.hide(); app.actions.newGame(app.settings().lastDifficulty); } }, "New game"),
      h("button", { type: "button", class: "btn", onClick: () => api.hide() }, "View board"))
  );
  root.append(dialog);
  const api = {
    show({ score, personalBest }) {
      body.textContent = `Score ${score}${personalBest && personalBest.isBestScore ? " · New best!" : ""}`;
      dialog.hidden = false;
      dialog.querySelector("button").focus();
    },
    hide() {
      dialog.hidden = true;
    }
  };
  return api;
}
