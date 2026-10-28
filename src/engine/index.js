/**
 * Pure Sudoku engine. All indices are zero-based; boards are row-major arrays.
 * @typedef {'easy'|'medium'|'hard'|'expert'} Difficulty
 * @typedef {'full-house'|'naked-single'|'hidden-single'|'naked-pair'|'hidden-pair'|'pointing'|'claiming'|'naked-triple'|'hidden-triple'|'x-wing'|'swordfish'|'xy-wing'|'xyz-wing'|'skyscraper'|'incorrect-entry'} TechniqueId
 * @typedef {number[]} Board 81 digits, with zero for an empty cell.
 * @typedef {number[]} Notes 81 masks; digit d uses bit 1 << (d - 1).
 * @typedef {{type:'row'|'col'|'box',index:number}} House
 * @typedef {{index:number,digit:number}} CellDigit
 * @typedef {{technique:TechniqueId,placement:CellDigit|null,eliminations:CellDigit[],cells:number[],houses:House[],candidates:CellDigit[]}} Step
 * @typedef {{difficulty:Difficulty|null,hardest:TechniqueId|null,score:number,steps:number,counts:Partial<Record<TechniqueId,number>>,solved:boolean}} Grade
 * @typedef {{puzzle:Board,solution:Board,difficulty:Difficulty,grade:Grade,seed:string,clueCount:number,id:string}} GeneratedPuzzle
 * @typedef {{kind:'highlight',text:string,cells:number[],houses:House[]}|{kind:'explain',text:string,candidates:CellDigit[],eliminations:CellDigit[]}|{kind:'fill',text:string,placement:CellDigit}} HintStep
 * @typedef {{technique:TechniqueId,techniqueName:string,placement:CellDigit,cells:number[],houses:House[],candidates:CellDigit[],eliminations:CellDigit[],chain:Step[],steps:[HintStep,HintStep,HintStep]}} Hint
 */
export {
  DIFFICULTIES,
  DIFFICULTY_META,
  TECHNIQUES,
  createRng,
  peersOf,
  houseCells,
  computeCandidates,
  autoNotes,
  notesCleanup,
} from "./core.js";
export { findConflicts, solve, countSolutions } from "./board.js";
export { findNextStep, grade } from "./techniques.js";
export {
  generatePuzzle,
  generatePuzzleAsync,
  DAILY_VERSION,
  dailyKey,
  dailyPuzzle,
} from "./generator.js";
export { getHint } from "./hints.js";
