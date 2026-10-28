/**
 * Number pad: digits 1-9 with "N left" counts.
 * @module ui/pad
 */
import { attr, el, text } from "./el.js";

/**
 * @param {HTMLElement} root
 * @param {{onDigit:(digit:number) => void}} handlers
 * @returns {{render(keys:ReturnType<typeof import('./view-model.js').padView>):void}}
 */
export function createPad(root, { onDigit }) {
  root.textContent = "";
  const keys = Array.from({ length: 9 }, (_, k) => {
    const digit = k + 1;
    const left = el("span", { class: "key-left", "aria-hidden": "true" });
    const button = el(
      "button",
      { type: "button", class: "key", "data-testid": `numpad-${digit}`, onClick: () => onDigit(digit) },
      [el("span", { class: "key-digit", "aria-hidden": "true", text: String(digit) }), left]
    );
    root.append(button);
    return { button, left };
  });
  return {
    render(view) {
      for (const v of view) {
        const { button, left } = keys[v.digit - 1];
        text(left, v.left ? `${v.left} left` : "done");
        attr(button, "data-left", String(v.left));
        attr(button, "aria-label", v.label);
        attr(button, "aria-pressed", v.pressed ? "true" : null);
        button.disabled = v.disabled;
      }
    }
  };
}
