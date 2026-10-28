import {generateSolvedBoard,countSolutions} from './board.js';
import {createRng} from './core.js';
import {grade} from './techniques.js';
/** Deterministic initial generator; replaced by tier-checked generation next. */
export function generatePuzzle(difficulty='easy',{seed=String(Date.now()),maxAttempts=4}={}) {
  seed=String(seed);const rng=createRng(seed),solution=generateSolvedBoard(rng),puzzle=solution.slice();
  const target=({easy:40,medium:34,hard:30,expert:26})[difficulty]??40;
  const order=Array.from({length:81},(_,i)=>i);
  for(let i=80;i>0;i--){const j=Math.floor(rng()*(i+1));[order[i],order[j]]=[order[j],order[i]];}
  let clueCount=81;for(const index of order){if(clueCount<=target)break;const digit=puzzle[index];puzzle[index]=0;if(countSolutions(puzzle)===1)clueCount--;else puzzle[index]=digit;}
  return {puzzle,solution,difficulty,grade:grade(puzzle),seed,clueCount,id:`${difficulty}-${seed}`};
}
/** Promise interface, with a synchronous fallback for environments without workers. */
export async function generatePuzzleAsync(difficulty,opts) {return generatePuzzle(difficulty,opts);}
/** Version of the immutable daily seed namespace. */
export const DAILY_VERSION=1;
/** ISO calendar day in UTC. */
export function dailyKey(date=new Date()) {return date.toISOString().slice(0,10);}
/** Shared daily puzzle. */
export function dailyPuzzle(dateKey) {return {...generatePuzzle('medium',{seed:`daily:${DAILY_VERSION}:${dateKey}`}),id:`daily-${dateKey}`};}
