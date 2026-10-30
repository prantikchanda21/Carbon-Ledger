import test from 'node:test';
import assert from 'node:assert/strict';
import {flowGasCandidate} from '../lib/quantumEngineModes.ts';
import {flowGasCandidate as original} from '../scripts/reference-v91/quantumEngineModes.ts';
test('optimized kernels preserve v91 candidates and probabilities across masks and sizes',()=>{
 for(const mode of ['fluid','gaseous'] as const)for(const n of [1,3,5,7,20])for(let seed=1;seed<=20;seed++){
  const costs=Array.from({length:n},(_,i)=>Math.sin(seed*13+i*7)*.4+.5);
  const allowed=costs.map((_,i)=>i===0||(i+seed)%3!==0);
  const a=flowGasCandidate(costs,allowed,mode),b=original(costs,allowed,mode);
  assert.equal(a.index,b.index);assert.equal(a.optimizerEvals,b.optimizerEvals);
  assert.ok(Math.abs(a.probability-b.probability)<1e-10);
  assert.ok(Math.abs(a.expectedCost-b.expectedCost)<1e-10);
 }
});
