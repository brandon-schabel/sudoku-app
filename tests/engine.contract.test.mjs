import test from 'node:test';
import assert from 'node:assert/strict';
import * as engine from '../src/engine/index.js';
test('engine contract exports and shapes',()=>{
  assert.deepEqual(engine.DIFFICULTIES,['easy','medium','hard','expert']);
  for(const name of ['createRng','peersOf','houseCells','findConflicts','solve','countSolutions','computeCandidates','autoNotes','notesCleanup','findNextStep','grade','generatePuzzle','generatePuzzleAsync','dailyKey','dailyPuzzle','getHint']) assert.equal(typeof engine[name],'function',name);
  assert.equal(Object.keys(engine.TECHNIQUES).length,15);
  const g=engine.generatePuzzle('easy',{seed:'contract'});
  assert.equal(g.seed,'contract');assert.equal(g.id,'easy-contract');assert.equal(engine.countSolutions(g.puzzle),1);
  const hint=engine.getHint(g.puzzle,Array(81).fill(0),g.solution);
  assert.equal(hint.steps.length,3); assert.equal(hint.placement.digit,g.solution[hint.placement.index]);
});
