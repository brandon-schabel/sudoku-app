/** Base scores by locally defined difficulty. */
export const SCORE_BASE = Object.freeze({ easy: 1000, medium: 2000, hard: 3000, expert: 4000 });
/** Par times in milliseconds. */
export const PAR_MS = Object.freeze({ easy: 600000, medium: 900000, hard: 1500000, expert: 2400000 });
/** @typedef {{hints:number,checks:number,reveals:number,errorsShown:number,autoNotes:number}} Assist */
/** Return time bonus, clamped to [0,1200]. */
export function timeBonus(difficulty, elapsedMs) {
  const par = PAR_MS[difficulty];
  if (!par || !Number.isFinite(elapsedMs)) return 0;
  const elapsed = Math.max(0, elapsedMs);
  const remainingFraction = Math.max(0, Math.min(1, 1 - elapsed / (2 * par)));
  return Math.round(1200 * remainingFraction);
}
/** Compute final game score. */
export function computeScore({ difficulty, elapsedMs, hints = 0, mistakes = 0 }) {
  const base = SCORE_BASE[difficulty] || 0;
  const hintPenalty = 100 * Math.max(0, Number(hints) || 0);
  const mistakePenalty = 25 * Math.max(0, Number(mistakes) || 0);
  return Math.max(100, base + timeBonus(difficulty, elapsedMs) - hintPenalty - mistakePenalty);
}
/** Whether any assist counter is positive. */
export function isAssisted(assist = {}) {
  return ['hints', 'checks', 'reveals', 'errorsShown', 'autoNotes'].some(key => Number(assist?.[key]) > 0);
}
