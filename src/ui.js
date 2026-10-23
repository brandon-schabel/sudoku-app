const SIZE = 9;
const CELL_COUNT = 81;
const MISTAKE_LIMIT = 3;
const THEME_ORDER = ["auto", "light", "dark"];
const FOCUSABLE_SELECTOR =
  'button:not(:disabled), a[href], summary, input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

const difficultyLabel = (value) =>
  typeof value === "string" && value.length > 0
    ? value.charAt(0).toUpperCase() + value.slice(1)
    : "Easy";

export function formatTime(ms) {
  const totalSeconds = Math.max(0, Math.floor((Number.isFinite(ms) ? ms : 0) / 1000));
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);
  const two = (value) => String(value).padStart(2, "0");
  return hours > 0
    ? `${hours}:${two(minutes)}:${two(seconds)}`
    : `${two(minutes)}:${two(seconds)}`;
}

function countBits(mask) {
  let count = 0;
  while (mask) {
    mask &= mask - 1;
    count++;
  }
  return count;
}

function isPeerOf(index, selectedIndex) {
  if (selectedIndex === null || selectedIndex === undefined) return false;
  if (index === selectedIndex) return false;
  const row = Math.floor(index / SIZE);
  const col = index % SIZE;
  const selectedRow = Math.floor(selectedIndex / SIZE);
  const selectedCol = selectedIndex % SIZE;
  if (row === selectedRow || col === selectedCol) return true;
  return (
    Math.floor(row / 3) === Math.floor(selectedRow / 3) &&
    Math.floor(col / 3) === Math.floor(selectedCol / 3)
  );
}

function cellAriaLabel(index, value, isGiven, noteCount, isConflict) {
  const row = Math.floor(index / SIZE) + 1;
  const col = (index % SIZE) + 1;
  let label = `Row ${row}, column ${col}, `;
  if (value === 0) {
    label += "empty";
  } else {
    label += isGiven ? `given ${value}` : String(value);
  }
  if (value === 0 && noteCount > 0) {
    label += `, ${noteCount} note${noteCount === 1 ? "" : "s"}`;
  }
  if (isConflict) label += ", conflict";
  return label;
}

function nextTheme(theme) {
  const index = THEME_ORDER.indexOf(theme);
  return THEME_ORDER[(index < 0 ? 0 : index + 1) % THEME_ORDER.length];
}

function focusableWithin(container) {
  return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
    (el) => !el.disabled && el.offsetParent !== null
  );
}

function trapFocus(event, container) {
  const focusable = focusableWithin(container);
  if (focusable.length === 0) {
    event.preventDefault();
    return;
  }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement;
  if (event.shiftKey) {
    if (active === first || !container.contains(active)) {
      event.preventDefault();
      last.focus();
    }
  } else if (active === last || !container.contains(active)) {
    event.preventDefault();
    first.focus();
  }
}

export function createUI({ root, dispatch }) {
  if (!root) throw new Error("createUI requires a root element");
  if (typeof dispatch !== "function") {
    throw new Error("createUI requires a dispatch function");
  }

  const els = {
    board: root.querySelector("#board"),
    pauseOverlay: root.querySelector("#pause-overlay"),
    timer: root.querySelector("#timer"),
    pause: root.querySelector("#pause"),
    mistakes: root.querySelector("#mistakes"),
    mistakesValue: root.querySelector("#mistakes-value"),
    hints: root.querySelector("#hints"),
    hintsValue: root.querySelector("#hints-value"),
    mistakesSide: root.querySelector("#mistakes-side"),
    hintsSide: root.querySelector("#hints-side"),
    numberPad: root.querySelector("#number-pad"),
    notes: root.querySelector("#notes"),
    erase: root.querySelector("#erase"),
    undo: root.querySelector("#undo"),
    redo: root.querySelector("#redo"),
    hint: root.querySelector("#hint"),
    pauseMenu: root.querySelector("#pause-menu"),
    pauseSheet: root.querySelector("#pause-sheet"),
    pauseClose: root.querySelector("#pause-close"),
    resume: root.querySelector("#resume"),
    difficultyPicker: root.querySelector("#difficulty-picker"),
    themePicker: root.querySelector("#theme-picker"),
    newGame: root.querySelector("#new-game"),
    restart: root.querySelector("#restart"),
    pauseConfirm: root.querySelector("#pause-confirm"),
    pauseConfirmText: root.querySelector("#pause-confirm-text"),
    confirmCancel: root.querySelector("#confirm-cancel"),
    confirmOk: root.querySelector("#confirm-ok"),
    modalOverlay: root.querySelector("#modal-overlay"),
    modal: root.querySelector(".modal"),
    modalTitle: root.querySelector("#modal-title"),
    modalBody: root.querySelector("#modal-body"),
    modalActions: root.querySelector("#modal-actions"),
    status: root.querySelector("#sr-status")
  };

  for (const [name, el] of Object.entries(els)) {
    if (!el) throw new Error(`Missing required element: ${name}`);
  }

  const cells = [];
  let lastSelected = null;
  let modalKind = null;
  let previousFocus = null;
  let announceTimer = null;
  let pauseHasProgress = false;
  let pendingAction = null;
  let pendingOrigin = null;

  for (let index = 0; index < CELL_COUNT; index++) {
    const row = Math.floor(index / SIZE);
    const col = index % SIZE;
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "cell";
    cell.dataset.index = String(index);
    cell.setAttribute("role", "gridcell");
    cell.setAttribute("aria-rowindex", String(row + 1));
    cell.setAttribute("aria-colindex", String(col + 1));
    if (col === 2 || col === 5) cell.classList.add("br");
    if (row === 2 || row === 5) cell.classList.add("bb");

    const value = document.createElement("span");
    value.className = "cell-value";
    cell.append(value);

    const notes = document.createElement("div");
    notes.className = "cell-notes";
    notes.setAttribute("aria-hidden", "true");
    const notesForCell = [];
    for (let digit = 1; digit <= 9; digit++) {
      const note = document.createElement("span");
      note.className = "note";
      notes.append(note);
      notesForCell.push(note);
    }
    cell.append(notes);

    els.board.append(cell);
    cells.push({ button: cell, value, notes, noteEls: notesForCell });
  }

  const padButtons = [];
  for (let digit = 1; digit <= 9; digit++) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "pad-btn";
    button.dataset.digit = String(digit);

    const label = document.createElement("span");
    label.className = "pad-digit";
    label.textContent = String(digit);

    const count = document.createElement("span");
    count.className = "pad-count";

    button.append(label, count);
    button.addEventListener("click", () => {
      dispatch({ type: "digit", digit });
    });
    els.numberPad.append(button);
    padButtons.push({ button, count });
  }

  function resetConfirm() {
    pendingAction = null;
    pendingOrigin = null;
    els.pauseConfirm.hidden = true;
    els.pauseConfirmText.textContent = "";
  }

  function showConfirm(action, message, origin) {
    pendingAction = action;
    pendingOrigin = origin ?? null;
    els.pauseConfirmText.textContent = message;
    els.pauseConfirm.hidden = false;
    els.confirmCancel.focus({ preventScroll: true });
  }

  function setSegmented(container, attribute, value) {
    const buttons = container.querySelectorAll(`[data-${attribute}]`);
    for (const button of buttons) {
      button.setAttribute(
        "aria-pressed",
        button.dataset[attribute] === value ? "true" : "false"
      );
    }
  }

  function setDifficulty(difficulty) {
    if (!difficulty) return;
    setSegmented(els.difficultyPicker, "difficulty", difficulty);
  }

  function setTheme(theme) {
    setSegmented(
      els.themePicker,
      "theme",
      THEME_ORDER.includes(theme) ? theme : "auto"
    );
  }

  function openPauseMenu({ difficulty, theme, hasProgress = false } = {}) {
    if (difficulty) setDifficulty(difficulty);
    if (theme) setTheme(theme);
    pauseHasProgress = Boolean(hasProgress);
    resetConfirm();
    els.pauseMenu.hidden = false;
    els.pause.setAttribute("aria-expanded", "true");
    els.resume.focus({ preventScroll: true });
  }

  function closePauseMenu({ restoreFocus = true } = {}) {
    if (els.pauseMenu.hidden) return;
    els.pauseMenu.hidden = true;
    els.pause.setAttribute("aria-expanded", "false");
    resetConfirm();
    if (restoreFocus) {
      const index = Number.isInteger(lastSelected) ? lastSelected : 0;
      focusCell(index);
    }
  }

  els.board.addEventListener("pointerdown", (event) => {
    const cell = event.target.closest(".cell");
    if (!cell || !els.board.contains(cell)) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    const index = Number(cell.dataset.index);
    dispatch({ type: "select", index });
    cell.focus({ preventScroll: true });
  });

  els.board.addEventListener("click", (event) => {
    const cell = event.target.closest(".cell");
    if (!cell || !els.board.contains(cell)) return;
    dispatch({ type: "select", index: Number(cell.dataset.index) });
  });

  els.board.addEventListener("focusin", (event) => {
    const cell = event.target.closest(".cell");
    if (!cell || !els.board.contains(cell)) return;
    const index = Number(cell.dataset.index);
    if (index !== lastSelected) dispatch({ type: "select", index });
  });

  els.notes.addEventListener("click", () => dispatch({ type: "notes-toggle" }));
  els.erase.addEventListener("click", () => dispatch({ type: "erase" }));
  els.undo.addEventListener("click", () => dispatch({ type: "undo" }));
  els.redo.addEventListener("click", () => dispatch({ type: "redo" }));
  els.hint.addEventListener("click", () => dispatch({ type: "hint" }));
  els.pause.addEventListener("click", () => dispatch({ type: "pause" }));
  els.resume.addEventListener("click", () => dispatch({ type: "resume" }));
  els.pauseClose.addEventListener("click", () => dispatch({ type: "resume" }));

  els.pauseMenu.addEventListener("click", (event) => {
    if (event.target === els.pauseMenu) dispatch({ type: "resume" });
  });

  els.difficultyPicker.addEventListener("click", (event) => {
    const button = event.target.closest("[data-difficulty]");
    if (!button) return;
    dispatch({ type: "difficulty", difficulty: button.dataset.difficulty });
  });

  els.themePicker.addEventListener("click", (event) => {
    const button = event.target.closest("[data-theme]");
    if (!button) return;
    dispatch({ type: "theme", theme: button.dataset.theme });
  });

  els.newGame.addEventListener("click", () => {
    if (pauseHasProgress) {
      showConfirm(
        "new-game",
        "Start a new game? Current progress will be lost.",
        els.newGame
      );
      return;
    }
    dispatch({ type: "new-game", force: true });
  });

  els.restart.addEventListener("click", () => {
    if (pauseHasProgress) {
      showConfirm(
        "restart",
        "Restart this puzzle? Values, notes, history, mistakes, hints, and timer will reset.",
        els.restart
      );
      return;
    }
    dispatch({ type: "restart", force: true });
  });

  els.confirmOk.addEventListener("click", () => {
    const action = pendingAction;
    if (!action) return;
    resetConfirm();
    dispatch({ type: action, force: true });
  });

  els.confirmCancel.addEventListener("click", () => {
    const origin = pendingOrigin;
    resetConfirm();
    if (origin && origin.isConnected && typeof origin.focus === "function") {
      origin.focus({ preventScroll: true });
    }
  });

  els.modalOverlay.addEventListener("click", (event) => {
    if (event.target === els.modalOverlay && modalKind === "win") closeModal();
  });

  document.addEventListener("keydown", (event) => {
    const pauseOpen = !els.pauseMenu.hidden;
    if (!pauseOpen && !modalKind) return;

    if (event.key === "Escape") {
      if (pauseOpen) {
        event.preventDefault();
        event.stopImmediatePropagation();
        dispatch({ type: "resume" });
        return;
      }
      if (modalKind === "win") {
        event.preventDefault();
        event.stopImmediatePropagation();
        closeModal();
      }
      return;
    }

    if (event.key !== "Tab") return;
    if (pauseOpen) trapFocus(event, els.pauseSheet);
    else if (modalKind) trapFocus(event, els.modal);
  });

  function modalButton(text, kind, variant) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `btn${variant === "primary" ? " btn-primary" : ""}`;
    button.dataset.modalAction = kind;
    button.textContent = text;
    if (kind === "new-game") {
      button.addEventListener("click", () => dispatch({ type: "modal-new-game" }));
    } else {
      button.addEventListener("click", () => dispatch({ type: "close-modal" }));
    }
    els.modalActions.append(button);
    return button;
  }

  function showModal(kind, data = {}) {
    if (!modalKind) previousFocus = document.activeElement;
    modalKind = kind;
    els.modalTitle.textContent = "";
    els.modalBody.textContent = "";
    els.modalActions.textContent = "";

    let primary = null;

    if (kind === "gameover") {
      els.modalTitle.textContent = "Game over";
      const first = document.createElement("p");
      first.textContent = `You have reached ${MISTAKE_LIMIT} mistakes. Start a new game, or keep playing this puzzle.`;
      const second = document.createElement("p");
      second.textContent =
        "Keep playing dismisses this message for the rest of the game. Further mistakes still count, and you can still finish the puzzle.";
      els.modalBody.append(first, second);
      primary = modalButton("New game", "new-game", "primary");
      modalButton("Keep playing", "keep-playing");
    } else if (kind === "win") {
      els.modalTitle.textContent = "You solved it!";
      const intro = document.createElement("p");
      intro.textContent = "Every cell is correct. Nicely done.";
      const summary = document.createElement("dl");
      summary.className = "modal-summary";
      const entries = [
        ["Time", data.time ?? "00:00"],
        ["Difficulty", difficultyLabel(data.difficulty)],
        ["Mistakes", String(data.mistakes ?? 0)],
        ["Hints", String(data.hints ?? 0)]
      ];
      for (const [term, description] of entries) {
        const wrap = document.createElement("div");
        const dt = document.createElement("dt");
        dt.textContent = term;
        const dd = document.createElement("dd");
        dd.textContent = description;
        wrap.append(dt, dd);
        summary.append(wrap);
      }
      els.modalBody.append(intro, summary);
      modalButton("View board", "view-board");
      primary = modalButton("New game", "new-game", "primary");
    } else {
      return;
    }

    els.modalOverlay.hidden = false;
    if (primary) primary.focus({ preventScroll: true });
  }

  function closeModal() {
    if (!modalKind) return;
    modalKind = null;
    els.modalOverlay.hidden = true;
    els.modalTitle.textContent = "";
    els.modalBody.textContent = "";
    els.modalActions.textContent = "";
    const focusTarget = previousFocus;
    previousFocus = null;
    if (focusTarget && focusTarget.isConnected && typeof focusTarget.focus === "function") {
      focusTarget.focus({ preventScroll: true });
    }
  }

  function announce(message) {
    if (!els.status) return;
    els.status.textContent = "";
    clearTimeout(announceTimer);
    announceTimer = setTimeout(() => {
      els.status.textContent = message;
    }, 30);
  }

  function focusCell(index) {
    if (!Number.isInteger(index) || index < 0 || index >= CELL_COUNT) return;
    cells[index].button.focus({ preventScroll: true });
  }

  function render(state, view = {}) {
    const selectedIndex =
      Number.isInteger(view.selectedIndex) &&
      view.selectedIndex >= 0 &&
      view.selectedIndex < CELL_COUNT
        ? view.selectedIndex
        : null;
    const selectedValue =
      selectedIndex === null ? 0 : state.values[selectedIndex] || 0;
    const noteMode = Boolean(view.noteMode);
    const conflicts = view.conflicts instanceof Set ? view.conflicts : new Set();
    const paused = Boolean(view.paused);
    const theme = THEME_ORDER.includes(view.theme) ? view.theme : "auto";

    lastSelected = selectedIndex;

    for (let index = 0; index < CELL_COUNT; index++) {
      const { button, value, notes, noteEls: notesForCell } = cells[index];
      const cellValue = state.values[index];
      const noteMask = state.notes[index];
      const isGiven = state.puzzle[index] !== 0;
      const conflict = conflicts.has(index);
      const noteCount = cellValue === 0 ? countBits(noteMask) : 0;

      button.classList.toggle("given", isGiven);
      button.classList.toggle("user", !isGiven && cellValue !== 0);
      button.classList.toggle("selected", index === selectedIndex);
      button.classList.toggle("peer", isPeerOf(index, selectedIndex));
      button.classList.toggle(
        "same",
        selectedValue !== 0 && index !== selectedIndex && cellValue === selectedValue
      );
      button.classList.toggle("conflict", conflict);
      button.tabIndex = index === selectedIndex ? 0 : -1;
      button.setAttribute(
        "aria-selected",
        index === selectedIndex ? "true" : "false"
      );
      button.setAttribute(
        "aria-label",
        cellAriaLabel(index, cellValue, isGiven, noteCount, conflict)
      );

      value.textContent = cellValue === 0 ? "" : String(cellValue);
      notes.hidden = cellValue !== 0 || noteMask === 0;
      for (let digit = 1; digit <= 9; digit++) {
        const noteEl = notesForCell[digit - 1];
        const active = (noteMask & (1 << (digit - 1))) !== 0;
        noteEl.textContent = active ? String(digit) : "";
        noteEl.classList.toggle("active", active);
      }
    }

    els.board.classList.toggle("note-mode", noteMode);
    els.board.classList.toggle("is-paused", paused);
    els.pauseOverlay.hidden = !paused;

    els.timer.textContent = formatTime(state.elapsedMs);
    els.timer.setAttribute(
      "aria-label",
      `Elapsed time ${formatTime(state.elapsedMs)}`
    );

    const completed = Boolean(state.completed);
    els.pause.disabled = completed;
    els.pause.setAttribute("aria-pressed", paused ? "true" : "false");
    els.pause.setAttribute("aria-label", paused ? "Resume" : "Pause");

    const mistakesLabel = `Mistakes ${state.mistakes} of ${MISTAKE_LIMIT}`;
    els.mistakesValue.textContent = `${state.mistakes}/${MISTAKE_LIMIT}`;
    els.mistakes.setAttribute("aria-label", mistakesLabel);
    els.mistakesSide.textContent = `Mistakes ${state.mistakes}/${MISTAKE_LIMIT}`;
    els.mistakesSide.setAttribute("aria-label", mistakesLabel);

    const hintsLabel = `Hints used: ${state.hints}`;
    els.hintsValue.textContent = String(state.hints);
    els.hints.setAttribute("aria-label", hintsLabel);
    els.hintsSide.textContent = `Hints ${state.hints}`;
    els.hintsSide.setAttribute("aria-label", hintsLabel);

    els.notes.disabled = completed;
    els.notes.setAttribute("aria-pressed", noteMode ? "true" : "false");
    els.erase.disabled = paused || completed;
    els.undo.disabled = paused || completed || state.history.index <= 0;
    els.redo.disabled =
      paused ||
      completed ||
      state.history.index >= state.history.actions.length;
    els.hint.disabled = paused || completed;

    const remaining = {};
    for (let digit = 1; digit <= 9; digit++) remaining[digit] = 9;
    for (const cellValue of state.values) {
      if (cellValue >= 1 && cellValue <= 9) remaining[cellValue]--;
    }

    for (let digit = 1; digit <= 9; digit++) {
      const { button, count } = padButtons[digit - 1];
      const left = Math.max(0, remaining[digit]);
      count.textContent = String(left);
      button.disabled = left <= 0 || paused || completed;
      button.setAttribute("aria-label", `${digit}, ${left} remaining`);
    }

    setTheme(theme);
    if (view.selectedDifficulty) setDifficulty(view.selectedDifficulty);
  }

  return {
    render,
    showModal,
    closeModal,
    focusCell,
    announce,
    isModalOpen: () => modalKind !== null,
    isPauseMenuOpen: () => !els.pauseMenu.hidden,
    openPauseMenu,
    closePauseMenu,
    setDifficulty
  };
}
