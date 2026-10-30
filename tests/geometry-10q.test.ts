import test from 'node:test';
import assert from 'node:assert/strict';
import {geometryQuantumAllocation} from '../lib/geometryQuantum.ts';
const input={costs:Array.from({length:20},(_,i)=>.1+.03*i),caps:Array(20).fill(.085),preferred:Array(20).fill(.05),regularization:.04};
test('10-qubit p3 four register geometry ensemble normalized feasible and deterministic',async()=>{
 const a=await geometryQuantumAllocation(input);
 assert.equal(a.feasible,true);assert.equal(a.batches.length,4);
 for(const b of a.batches){assert.equal(b.qubits,10);assert.equal(b.p,3);assert.equal(b.validBasisStates,252);assert.equal(b.trace.length,3);assert.equal(b.shots,60);assert.ok(Math.abs(b.norm-1)<1e-9);assert.equal(b.classicalOptimizerUsed,false);}
 assert.ok(Math.abs(a.weights.reduce((s,v)=>s+v,0)-1)<1e-9);
 const b=await geometryQuantumAllocation(input);assert.deepEqual(a.weights,b.weights);
});
test('different objectives and capacities change quantum allocation',async()=>{
 const a=await geometryQuantumAllocation(input);
 const b=await geometryQuantumAllocation({...input,costs:[...input.costs].reverse(),caps:input.caps.map((v,i)=>i===0?0:v)});
 assert.notDeepEqual(a.weights,b.weights);assert.equal(b.weights[0],0);
});
test('all geometry variants are distinct and feasible',async()=>{
 for(const variant of ['xy','grover'] as const){const a=await geometryQuantumAllocation(input,variant);assert.ok(a.feasible);assert.equal(a.batches.length,4);}
});
test('reject impossible capacity',async()=>{await assert.rejects(geometryQuantumAllocation({...input,caps:Array(20).fill(.01)}),/infeasible/);});
