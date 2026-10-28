/** Base scores by locally defined difficulty. */
export const SCORE_BASE = Object.freeze({easy:1000,medium:2000,hard:3000,expert:4000});
/** Par times in milliseconds. */
export const PAR_MS = Object.freeze({easy:600000,medium:900000,hard:1500000,expert:2400000});
/** @typedef {{hints:number,checks:number,reveals:number,errorsShown:number,autoNotes:number}} Assist */
/** Return time bonus, clamped to [0,1200]. */
export function timeBonus(difficulty, elapsedMs) { const p=PAR_MS[difficulty]; return p ? Math.round(1200*Math.max(0,Math.min(1,1-(Number(elapsedMs)||0)/(2*p)))) : 0; }
/** Compute final game score. */
export function computeScore({difficulty,elapsedMs,hints=0,mistakes=0}) { return Math.max(100,(SCORE_BASE[difficulty]||0)+timeBonus(difficulty,elapsedMs)-100*(Number(hints)||0)-25*(Number(mistakes)||0)); }
/** Whether any assist counter is positive. */
export function isAssisted(assist={}) { return Object.values(assist||{}).some(n=>Number(n)>0); }
