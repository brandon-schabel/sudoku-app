import {computeCandidates,TECHNIQUES} from './core.js';
import {findConflicts} from './board.js';
import {techniqueSteps,applyStep} from './techniques.js';

const location=index=>`row ${Math.floor(index/9)+1}, column ${index%9+1}`;
const houseName=house=>`${house.type==='col'?'column':house.type} ${house.index+1}`;
const list=values=>values.length<2?String(values[0]??''):values.slice(0,-1).join(', ')+` and ${values.at(-1)}`;
function explanation(step) {
  const {technique,placement,candidates,houses}=step;
  const digits=list([...new Set(candidates.map(c=>c.digit))].sort((a,b)=>a-b));
  const area=houses[0]?houseName(houses[0]):'highlighted cells';
  switch(technique) {
    case 'incorrect-entry':return `This entry does not match the solution. The correct digit is ${placement.digit}.`;
    case 'full-house':return `${area[0].toUpperCase()+area.slice(1)} has one empty cell. Its missing digit is ${placement.digit}.`;
    case 'naked-single':return `Every digit except ${placement.digit} is already in this cell's row, column or box, or has been ruled out by the preceding deductions.`;
    case 'hidden-single':return `${placement.digit} can only go in one cell of ${area}.`;
    case 'naked-pair':case 'naked-triple':return `These ${step.cells.length} cells can contain only ${digits}. Those digits must occupy these cells, so remove them from other cells in ${area}.`;
    case 'hidden-pair':case 'hidden-triple':return `In ${area}, ${digits} can appear only in these ${step.cells.length} cells. Reserve these cells for those digits and remove their other candidates.`;
    case 'pointing':return `In ${area}, ${digits} is confined to ${houseName(houses[1])}. Remove it from the rest of that ${houses[1].type==='col'?'column':'row'}.`;
    case 'claiming':return `In ${area}, ${digits} is confined to ${houseName(houses[1])}. Remove it from other cells in that box.`;
    case 'x-wing':case 'swordfish':{
      const n=technique==='x-wing'?2:3;
      return `In ${list(houses.slice(0,n).map(houseName))}, ${digits} can occur only in ${list(houses.slice(n).map(houseName))}. These ${n} placements use all ${n} crossing houses, so remove ${digits} from their other cells.`;
    }
    case 'xy-wing':return `The pivot has two candidates. Either choice forces the shared digit in one of the two wings. A cell that sees both wings cannot contain that digit.`;
    case 'xyz-wing':return `The pivot has three candidates and each wing has two. The shared digit must occur in the pivot or a wing. Remove it only from cells that see all three.`;
    case 'skyscraper':return `Each highlighted line has two positions for this digit. The aligned ends cannot both hold it, so at least one outer end must. Remove the digit from cells that see both outer ends.`;
    default:throw new Error(`Unknown hint technique: ${technique}`);
  }
}
function easiestSteps(board,candidates) {
  for(const technique of Object.keys(TECHNIQUES)) {
    const steps=[...techniqueSteps(board,candidates,technique)];
    if(steps.length) return steps;
  }
  return [];
}
function choose(steps,focusIndex) {
  return steps.find(s=>s.placement?.index===focusIndex)??steps.find(s=>s.eliminations.some(e=>e.index===focusIndex))??steps[0];
}
function makeHint(chain) {
  const hardest=chain.reduce((a,b)=>TECHNIQUES[a.technique].rank>=TECHNIQUES[b.technique].rank?a:b);
  const placement=chain.at(-1).placement,cells=[...new Set(chain.flatMap(s=>s.cells))].sort((a,b)=>a-b);
  const houses=[...new Map(chain.flatMap(s=>s.houses).map(h=>[`${h.type}:${h.index}`,h])).values()];
  const candidates=[...new Map(chain.flatMap(s=>s.candidates).map(c=>[`${c.index}:${c.digit}`,c])).values()];
  const eliminations=chain.flatMap(s=>s.eliminations);
  const highlight=hardest.houses.length?`Look at ${list(hardest.houses.map(houseName))}.`:`Look at ${list(hardest.cells.map(location))}.`;
  return {technique:hardest.technique,techniqueName:TECHNIQUES[hardest.technique].name,placement,cells,houses,candidates,eliminations,chain,
    steps:[{kind:'highlight',text:highlight,cells,houses},
      {kind:'explain',text:chain.map(explanation).join(' '),candidates,eliminations},
      {kind:'fill',text:`Place ${placement.digit} in ${location(placement.index)}.`,placement}]};
}
/** Return three teaching stages ending in a justified placement. Notes are deliberately
 * ignored. Wrong entries take priority; otherwise exhaust simpler techniques first,
 * preferring a direct placement chain and the focused cell among equal-rank choices.
 */
export function getHint(board, notes, solution, {focusIndex}={}) {
  if(!Array.isArray(board)||board.length!==81||!Array.isArray(solution)||solution.length!==81) return null;
  const incorrect=board.flatMap((v,i)=>v&&v!==solution[i]?[i]:[]);
  if(incorrect.length) {
    const index=incorrect.includes(focusIndex)?focusIndex:incorrect[0];
    return makeHint([{technique:'incorrect-entry',placement:{index,digit:solution[index]},eliminations:[],cells:[index],houses:[],candidates:[]}]);
  }
  if(findConflicts(board).size) return null;
  const values=board.slice(),candidates=computeCandidates(board),chain=[];
  while(values.includes(0)) {
    if(values.some((v,i)=>!v&&!candidates[i])) return null;
    const options=easiestSteps(values,candidates);if(!options.length)return null;
    if(options[0].placement) return makeHint([...chain,choose(options,focusIndex)]);
    // Prefer a single elimination pattern that immediately yields a placement.
    const direct=[];
    for(const step of options) {
      const nextValues=values.slice(),nextCandidates=candidates.slice();applyStep(nextValues,nextCandidates,step);
      for(const technique of ['full-house','naked-single','hidden-single']) {
        const placements=[...techniqueSteps(nextValues,nextCandidates,technique)];
        if(placements.length) {direct.push([step,choose(placements,focusIndex)]);break;}
      }
    }
    if(direct.length) {
      const selected=direct.find(([,s])=>s.placement.index===focusIndex)??direct[0];
      return makeHint([...chain,...selected]);
    }
    const step=choose(options,focusIndex);chain.push(step);applyStep(values,candidates,step);
  }
  return null;
}
