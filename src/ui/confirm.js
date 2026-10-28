/**
 * Small modal confirmation dialog (used for Restart).
 * @module ui/confirm
 */
import { el } from "./el.js";

/**
 * @param {HTMLElement} root container appended to
 * @returns {(opts:{title:string, body:string, confirm:string, cancel?:string}) => Promise<boolean>}
 */
export function createConfirm(root) {
  return ({ title, body, confirm, cancel = "Cancel" }) =>
    new Promise((resolve) => {
      const previous = document.activeElement;
      const done = (value) => {
        overlay.remove();
        document.removeEventListener("keydown", onKey, true);
        if (previous && typeof previous.focus === "function") previous.focus();
        resolve(value);
      };
      const ok = el("button", { type: "button", class: "btn btn-primary", "data-testid": "confirm-ok", text: confirm, onClick: () => done(true) });
      const no = el("button", { type: "button", class: "btn", "data-testid": "confirm-cancel", text: cancel, onClick: () => done(false) });
      const overlay = el(
        "div",
        { class: "confirm-overlay", onClick: (e) => e.target === overlay && done(false) },
        [
          el("div", { class: "confirm", role: "alertdialog", "aria-modal": "true", "aria-labelledby": "confirm-title", "aria-describedby": "confirm-body" }, [
            el("h2", { id: "confirm-title", text: title }),
            el("p", { id: "confirm-body", text: body }),
            el("div", { class: "confirm-actions" }, [no, ok])
          ])
        ]
      );
      const onKey = (e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          done(false);
        } else if (e.key === "Tab") {
          e.preventDefault();
          (document.activeElement === ok ? no : ok).focus();
        }
      };
      document.addEventListener("keydown", onKey, true);
      root.append(overlay);
      ok.focus();
    });
}
