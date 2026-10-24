import test from 'node:test';
import assert from 'node:assert/strict';
import {quadQuantumAllocation} from '../lib/quadQuantum.ts';
const input={costs:Array.from({length:20},(_,i)=>i/20),caps:Array(20).fill(.16),preferred:Array(20).fill(.05),regularization:.1};
test('four parallel statevectors produce feasible, normalized, input-responsive allocations',async()=>{
 const a=await quadQuantumAllocation(input);
 assert.equal(a.batches.length,4);
 for(const b of a.batches){assert.ok(Math.abs(b.norm-1)<1e-9);assert.equal(b.trace.length,3);assert.ok(Math.abs(b.weights.reduce((x,y)=>x+y,0)-1)<1e-8);assert.ok(b.weights.every(w=>w>=0&&w<=.16+1e-8));}
 const b=await quadQuantumAllocation({...input,costs:[...input.costs].reverse(),caps:input.caps.map((c,i)=>i===0?0:c)});
 assert.equal(b.weights[0],0);assert.notDeepEqual(a.weights,b.weights);
 const replay=await quadQuantumAllocation(input);assert.deepEqual(replay.weights,a.weights);
});
test('single eligible region and infeasible capacity are handled honestly',async()=>{
 const result=await quadQuantumAllocation({costs:[1,2],caps:[1,0],preferred:[1,0],regularization:0});
 assert.deepEqual(result.weights,[1,0]);
 await assert.rejects(quadQuantumAllocation({...input,caps:Array(20).fill(.01)}),/infeasible/);
});

test('no classical optimizer or analytical fallback can select winning allocation',async()=>{const r=await quadQuantumAllocation(input);assert.equal(r.classicalCandidateUsed,false);for(const b of r.batches){assert.equal(b.classicalCandidateUsed,false);assert.equal(b.graphSearch?.usedAnalyticalFallback,false);}});
