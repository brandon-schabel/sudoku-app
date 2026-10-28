import {computeCandidates,TECHNIQUES} from './core.js';
import {findNextStep,applyStep} from './techniques.js';
/** Teaching hint from board candidates, ignoring unreliable handwritten notes. */
export function getHint(board, notes, solution, {focusIndex}={}) {
  let incorrect=board.map((v,i)=>v&&v!==solution[i]?i:-1).filter(i=>i>=0);
  if(incorrect.includes(focusIndex)) incorrect=[focusIndex,...incorrect.filter(i=>i!==focusIndex)];
  const chain=[];
  if(incorrect.length) { const index=incorrect[0];chain.push({technique:'incorrect-entry',placement:{index,digit:solution[index]},eliminations:[],cells:[index],houses:[],candidates:[]}); }
  else {const values=board.slice(), candidates=computeCandidates(board);while(true){const step=findNextStep(values,candidates);if(!step)return null;chain.push(step);if(step.placement)break;applyStep(values,candidates,step);}}
  const last=chain.at(-1), hardest=chain.reduce((a,b)=>TECHNIQUES[a.technique].rank>=TECHNIQUES[b.technique].rank?a:b), placement=last.placement;
  const cells=[...new Set(chain.flatMap(s=>s.cells))],houses=hardest.houses,candidates=chain.flatMap(s=>s.candidates),eliminations=chain.flatMap(s=>s.eliminations);
  const location=`row ${Math.floor(placement.index/9)+1}, column ${placement.index%9+1}`;
  return {technique:hardest.technique,techniqueName:TECHNIQUES[hardest.technique].name,placement,cells,houses,candidates,eliminations,chain,steps:[{kind:'highlight',text:`Look at ${location}.`,cells,houses},{kind:'explain',text:hardest.technique==='incorrect-entry'?`This entry does not match the solution. The correct digit is ${placement.digit}.`:`${TECHNIQUES[hardest.technique].name} shows that ${placement.digit} belongs here.`,candidates,eliminations},{kind:'fill',text:`Place ${placement.digit} in ${location}.`,placement}]};
}
