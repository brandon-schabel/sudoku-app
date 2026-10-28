/**
 * 3-step teaching hint panel: 1 highlight the area, 2 explain candidates and
 * eliminations, 3 fill the cell. "I'll try it" closes the panel and leaves
 * the area highlighted on the board.
 * @module ui/hint-panel
 */
import { attr, el, text } from "./el.js";
import { ICONS } from "./icons.js";

const NEXT_LABELS = ["Explain", "Show answer"];

/**
 * @param {HTMLElement} root `[data-testid=hint-panel]`
 * @param {{onStep:(step:number) => void, onFill:() => void, onTry:() => void, onClose:() => void,
 *   onReveal:() => void}} handlers
 */
export function createHintPanel(root, { onStep, onFill, onTry, onClose, onReveal }) {
  const title = el("h2", { class: "hint-title", id: "hint-title" });
  const stepLabel = el("span", { class: "hint-step" });
  const body = el("p", { class: "hint-text", id: "hint-text" });
  const tryBtn = el("button", { type: "button", class: "btn", "data-testid": "hint-try", text: "I’ll try it", onClick: onTry });
  const nextBtn = el("button", { type: "button", class: "btn btn-primary", "data-testid": "hint-next", onClick: () => onStep(step + 1) });
  const fillBtn = el("button", { type: "button", class: "btn btn-primary", "data-testid": "hint-fill", text: "Fill it in", onClick: onFill });
  const revealBtn = el("button", { type: "button", class: "btn btn-primary", text: "Reveal a cell", onClick: onReveal });
  const close = el("button", { type: "button", class: "icon-btn hint-close", "aria-label": "Close hint", html: ICONS.close, onClick: onClose });
  root.textContent = "";
  root.setAttribute("role", "region");
  root.setAttribute("aria-labelledby", "hint-title");
  root.append(
    el("div", { class: "hint-head" }, [el("div", { class: "hint-heading" }, [title, stepLabel]), close]),
    el("div", { class: "hint-body", "aria-live": "polite" }, [body]),
    el("div", { class: "hint-actions" }, [tryBtn, nextBtn, fillBtn, revealBtn])
  );
  root.hidden = true;
  let step = 0;

  return {
    /**
     * @param {import('../engine/index.js').Hint|null} hint null → "no step found"
     * @param {number} s step 0-2
     */
    show(hint, s) {
      step = s;
      root.hidden = false;
      document.documentElement.dataset.hint = "open";
      if (!hint) {
        text(title, "No hint found");
        text(stepLabel, "");
        text(body, "No logical step is available from here with the techniques this app teaches. You can reveal one cell instead.");
        tryBtn.hidden = false;
        nextBtn.hidden = true;
        fillBtn.hidden = true;
        revealBtn.hidden = false;
        return;
      }
      revealBtn.hidden = true;
      text(title, hint.techniqueName);
      text(stepLabel, `Step ${s + 1} of 3`);
      text(body, hint.steps[s].text);
      tryBtn.hidden = s === 2;
      nextBtn.hidden = s === 2;
      fillBtn.hidden = s !== 2;
      if (s < 2) text(nextBtn, NEXT_LABELS[s]);
      attr(root, "data-step", String(s + 1));
    },
    hide() {
      root.hidden = true;
      delete document.documentElement.dataset.hint;
    },
    isOpen: () => !root.hidden,
    /** Focus the primary action (keyboard users). */
    focus() {
      const target = [fillBtn, nextBtn, revealBtn].find((b) => !b.hidden);
      target?.focus();
    }
  };
}
