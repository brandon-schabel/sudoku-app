import test from 'node:test';
import assert from 'node:assert/strict';
import {computeCandidates,autoNotes,notesCleanup,peersOf,houseCells,createRng,generatePuzzle,solve,countSolutions,findConflicts,grade} from '../src/engine/index.js';
function brute(board,index) {
  if(board[index])return 0;let mask=0;
  for(let digit=1;digit<=9;digit++) {
    let legal=true;
    for(let j=0;j<81;j++)if(j!==index&&board[j]===digit&&(Math.floor(j/9)===Math.floor(index/9)||j%9===index%9||(Math.floor(j/27)===Math.floor(index/27)&&Math.floor(j%9/3)===Math.floor(index%9/3))))legal=false;
    if(legal)mask|=1<<(digit-1);
  }
  return mask;
}
test('all 81 peer sets and all 27 houses have correct geometry',()=>{
  for(let i=0;i<81;i++){const p=peersOf(i);assert.equal(p.length,20);assert.equal(new Set(p).size,20);assert.ok(!p.includes(i));assert.ok(Object.isFrozen(p));for(const j of p)assert.ok(peersOf(j).includes(i));}
  for(const type of ['row','col','box']){const cells=Array.from({length:9},(_,index)=>houseCells({type,index}));assert.ok(cells.every(c=>c.length===9));assert.equal(new Set(cells.flat()).size,81);}
});
test('candidates and both auto-note modes agree with independent brute force and stay pure',()=>{
  const rng=createRng('notes');
  for(let seed=0;seed<30;seed++) {
    const board=Object.freeze(generatePuzzle('medium',{seed}).puzzle),notes=Object.freeze(Array.from({length:81},()=>Math.floor(rng()*512)));
    const expected=board.map((_,i)=>brute(board,i));
    assert.deepEqual(computeCandidates(board),expected);assert.deepEqual(autoNotes(board,notes),expected);
    assert.deepEqual(autoNotes(board,notes,{mode:'merge'}),expected.map((m,i)=>notes[i]?m&notes[i]:m));
    const result=autoNotes(board,notes);result.fill(0);assert.deepEqual(computeCandidates(board),expected);
  }
});
test('cleanup removes only the placed digit from empty peers and reports exact before/after masks',()=>{
  const board=generatePuzzle('easy',{seed:'cleanup'}).puzzle,index=board.indexOf(0),notes=Array(81).fill(511),digit=4;
  const expected=peersOf(index).filter(i=>!board[i]).map(index=>({index,before:511,after:503}));
  Object.freeze(board);Object.freeze(notes);
  assert.deepEqual(notesCleanup(board,notes,index,digit),expected);assert.deepEqual(notesCleanup(board,Array(81).fill(0),index,digit),[]);
  assert.ok(!expected.some(e=>e.index===index));
});
test('solver and grader reject invalid or contradictory boards and never mutate inputs',()=>{
  for(const board of [Array(80).fill(0),Array(81).fill(-1),Array(81).fill(1)]) {assert.equal(solve(board),null);assert.equal(countSolutions(board),0);assert.equal(grade(board).difficulty,null);assert.equal(grade(board).solved,false);}
  const bad=Array(81).fill(0);bad[0]=bad[1]=bad[9]=1;assert.deepEqual([...findConflicts(bad)].sort((a,b)=>a-b),[0,1,9]);
  assert.equal(countSolutions(Array(81).fill(0),0),0);assert.equal(countSolutions(Array(81).fill(0),2),2);
  const board=Object.freeze(generatePuzzle('hard',{seed:'pure'}).puzzle);assert.ok(solve(board));assert.equal(countSolutions(board),1);assert.equal(grade(board).difficulty,'hard');
  assert.equal(grade(Array(81).fill(0)).solved,false);
});
