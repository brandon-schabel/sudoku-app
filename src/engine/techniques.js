import {computeCandidates, houseCells, peersOf, TECHNIQUES} from './core.js';
import {findConflicts} from './board.js';
const houses = ['row','col','box'].flatMap(type=>Array.from({length:9},(_,index)=>({type,index})));
/** Return the simplest available human deduction. */
export function findNextStep(board, candidates=computeCandidates(board)) {
  for (const house of houses) {
    const cells=houseCells(house).filter(i=>!board[i]);
    if(cells.length===1 && candidates[cells[0]]) return single('full-house',cells[0],candidates[cells[0]],[house]);
  }
  for(let i=0;i<81;i++) if(!board[i]&&candidates[i]&&(candidates[i]&(candidates[i]-1))===0) return single('naked-single',i,candidates[i],[]);
  for(const house of houses) for(let d=1;d<=9;d++) {
    const cells=houseCells(house).filter(i=>!board[i]&&(candidates[i]&(1<<(d-1))));
    if(cells.length===1) return single('hidden-single',cells[0],1<<(d-1),[house]);
  }
  return null;
}
function single(technique,index,mask,houses) { const digit=32-Math.clz32(mask); return {technique,placement:{index,digit},eliminations:[],cells:[index],houses,candidates:[{index,digit}]}; }
/** Apply a logical step to working board/candidates. */
export function applyStep(board,candidates,step) {
  for(const {index,digit} of step.eliminations) candidates[index]&=~(1<<(digit-1));
  if(step.placement) {const {index,digit}=step.placement; board[index]=digit;candidates[index]=0;for(const i of peersOf(index)) candidates[i]&=~(1<<(digit-1));}
}
/** Grade by the hardest deduction in a simplest-first solve. */
export function grade(puzzle) {
  const board=puzzle.slice(), candidates=computeCandidates(board), counts={}; let hardest=null,steps=0,score=0;
  if(board.length!==81||board.some(v=>!Number.isInteger(v)||v<0||v>9)||findConflicts(board).size) return {difficulty:null,hardest,score,steps,counts,solved:false};
  while(board.includes(0)) {const step=findNextStep(board,candidates);if(!step) break;applyStep(board,candidates,step);steps++;counts[step.technique]=(counts[step.technique]??0)+1;score+=TECHNIQUES[step.technique].rank+1;if(hardest===null||TECHNIQUES[step.technique].rank>TECHNIQUES[hardest].rank) hardest=step.technique;}
  const solved=!board.includes(0)&&!findConflicts(board).size;
  return {difficulty:solved?(hardest?TECHNIQUES[hardest].difficulty:'easy'):null,hardest,score,steps,counts,solved};
}
