/**
 * Board view: 81 labelled grid cells with notes, highlights and hint marks.
 * Rendering is driven by view-model `boardView()` output.
 * @module ui/board
 */
import { attr, el, text } from "./el.js";

/**
 * @param {HTMLElement} root the `[data-testid=board]` element (role=grid)
 * @param {{onCellTap:(index:number) => void}} handlers
 * @returns {{render(views:import('./view-model.js').CellView[], focusSelected?:boolean):void, focus():void}}
 */
export function createBoard(root, { onCellTap }) {
  /** @type {Array<{cell:HTMLElement, value:HTMLElement, notes:HTMLElement[]}>} */
  const cells = [];
  root.textContent = "";
  for (let r = 0; r < 9; r++) {
    const row = el("div", { role: "row", class: "board-row" });
    for (let c = 0; c < 9; c++) {
      const index = r * 9 + c;
      const notes = Array.from({ length: 9 }, (_, k) => el("span", { class: "note", dataset: { d: String(k + 1) } }));
      const value = el("span", { class: "cell-value", "aria-hidden": "true" });
      const cell = el(
        "div",
        {
          role: "gridcell",
          class: "cell",
          tabindex: index === 0 ? "0" : "-1",
          "data-testid": "cell",
          dataset: { index: String(index), row: String(r), col: String(c) }
        },
        [value, el("span", { class: "cell-notes", "aria-hidden": "true" }, notes)]
      );
      row.append(cell);
      cells.push({ cell, value, notes });
    }
    root.append(row);
  }

  root.addEventListener("click", (event) => {
    const cell = event.target.closest(".cell");
    if (cell && root.contains(cell)) onCellTap(Number(cell.dataset.index));
  });

  let focusIndex = 0;

  return {
    render(views, focusSelected = false) {
      let selected = -1;
      for (const v of views) {
        const { cell, value, notes } = cells[v.index];
        text(value, v.value ? String(v.value) : "");
        attr(cell, "data-given", v.given ? "true" : "false");
        attr(cell, "data-value", String(v.value));
        attr(cell, "data-wrong", v.wrong ? "true" : null);
        attr(cell, "data-conflict", v.conflict ? "true" : null);
        attr(cell, "data-selected", v.selected ? "true" : null);
        attr(cell, "aria-selected", v.selected ? "true" : "false");
        attr(cell, "data-related", v.related ? "true" : null);
        attr(cell, "data-same", v.same ? "true" : null);
        attr(cell, "data-hint-area", v.hintArea ? "true" : null);
        attr(cell, "data-hint-cell", v.hintCell ? "true" : null);
        attr(cell, "data-hint-target", v.hintTarget ? "true" : null);
        attr(cell, "aria-label", v.label);
        const marks = v.hintMarks;
        attr(cell, "data-marks", marks ? "true" : null);
        for (let k = 0; k < 9; k++) {
          const d = k + 1;
          const shown = marks ? Boolean(marks[d]) : v.notes.includes(d);
          text(notes[k], shown ? String(d) : "");
          attr(notes[k], "data-mark", marks && marks[d] ? marks[d] : null);
          attr(notes[k], "data-hl", !marks && v.noteHighlight === d ? "true" : null);
        }
        if (v.selected) selected = v.index;
      }
      const next = selected >= 0 ? selected : focusIndex;
      if (next !== focusIndex) {
        attr(cells[focusIndex].cell, "tabindex", "-1");
        focusIndex = next;
      }
      attr(cells[focusIndex].cell, "tabindex", "0");
      if (focusSelected && selected >= 0 && root.contains(document.activeElement)) cells[selected].cell.focus();
    },
    focus() {
      cells[focusIndex].cell.focus();
    }
  };
}
