/**
 * Status bar (difficulty + dots, mistakes, timer, pause) and progress bar.
 * @module ui/status
 */
import { attr, el, text } from "./el.js";
import { ICONS } from "./icons.js";
import { difficultyView, formatTime, progressView } from "./view-model.js";

/**
 * @param {{status:HTMLElement, progress:HTMLElement}} roots
 * @param {{onPause:() => void}} handlers
 */
export function createStatus({ status, progress }, { onPause }) {
  const dots = Array.from({ length: 4 }, () => el("span", { class: "dot" }));
  const diffLabel = el("span", { class: "difficulty-label" });
  const difficulty = el("span", { class: "status-item difficulty", "data-testid": "status-difficulty" }, [
    diffLabel,
    el("span", { class: "dots", "aria-hidden": "true" }, dots)
  ]);
  const mistakesValue = el("span", { class: "mistakes-value" });
  const mistakes = el("span", { class: "status-item mistakes", "data-testid": "status-mistakes" }, [
    el("span", { class: "status-icon", html: ICONS.mistake, "aria-hidden": "true" }),
    el("span", { class: "mistakes-word", text: "Mistakes", "aria-hidden": "true" }),
    mistakesValue
  ]);
  const timer = el("span", { class: "status-item timer", "data-testid": "status-timer", role: "timer", "aria-live": "off" });
  const pause = el("button", {
    type: "button",
    class: "pause-btn",
    "data-testid": "pause",
    "aria-label": "Pause and open menu",
    title: "Pause (P)",
    html: ICONS.pause,
    onClick: onPause
  });
  status.textContent = "";
  status.append(difficulty, mistakes, el("span", { class: "status-spacer" }), timer, pause);

  const progressText = el("span", { class: "progress-text" });
  const fill = el("span", { class: "progress-fill" });
  const bar = el("span", { class: "progress-bar", role: "progressbar", "aria-label": "Puzzle progress" }, [fill]);
  progress.textContent = "";
  progress.append(progressText, bar);

  return {
    /** @param {import('../game.js').GameJSON & {progress:{filled:number,total:number}}} game @param {{showTimer:boolean}} settings */
    render(game, settings) {
      const d = difficultyView(game.difficulty);
      text(diffLabel, game.kind === "daily" ? `Daily · ${d.label}` : d.label);
      attr(difficulty, "aria-label", game.kind === "daily" ? `Daily puzzle, ${d.text}` : d.text);
      dots.forEach((dot, k) => attr(dot, "data-on", k < d.dots ? "true" : null));
      text(mistakesValue, String(game.mistakes));
      attr(mistakes, "aria-label", `Mistakes: ${game.mistakes}`);
      timer.hidden = !settings.showTimer;
      this.renderTime(game.elapsedMs);
      const p = progressView(game.progress);
      text(progressText, p.text);
      fill.style.transform = `scaleX(${p.ratio})`;
      attr(bar, "aria-valuenow", String(game.progress.filled));
      attr(bar, "aria-valuemin", "0");
      attr(bar, "aria-valuemax", String(game.progress.total));
    },
    /** @param {number} ms */
    renderTime(ms) {
      const t = formatTime(ms);
      text(timer, t);
      attr(timer, "aria-label", `Time ${t}`);
    }
  };
}
