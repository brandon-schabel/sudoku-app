/** Base scores by locally defined difficulty. */
export const SCORE_BASE = Object.freeze({easy:1000,medium:2000,hard:3000,expert:4000});
/** Par times in milliseconds. */
export const PAR_MS = Object.freeze({easy:600000,medium:900000,hard:1500000,expert:2400000});
/** @typedef {{hints:number,checks:number,reveals:number,errorsShown:number,autoNotes:number}} Assist */
/** Return time bonus, clamped to [0,1200]. */
export function timeBonus(difficulty, elapsedMs) { const p=PAR_MS[difficulty]; if (!p || !Number.isFinite(elapsedMs)) return 0; const time=Math.max(0,elapsedMs); return Math.round(1200*Math.max(0,Math.min(1,1-time/(2*p)))); }
/** Compute final game score. */
export function computeScore({difficulty,elapsedMs,hints=0,mistakes=0}) { return Math.max(100,(SCORE_BASE[difficulty]||0)+timeBonus(difficulty,elapsedMs)-100*Math.max(0,Number(hints)||0)-25*Math.max(0,Number(mistakes)||0)); }
/** Whether any assist counter is positive. */
export function isAssisted(assist={}) { return ['hints','checks','reveals','errorsShown','autoNotes'].some(k=>Number(assist?.[k])>0); }
