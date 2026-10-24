import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {adiabaticQuantumAllocation} from '../lib/adiabaticQuantum.ts';
const input={costs:Array.from({length:20},(_,i)=>.08+i*.012),caps:Array.from({length:20},()=>.105),preferred:Array(20).fill(.05),regularization:.035};
test('digitized adiabatic search yields feasible 20-region allocation, no LP fallback',()=>{
 const r=adiabaticQuantumAllocation(input);
 assert.equal(r.feasible,true);assert.equal(r.weights.length,20);
 assert.ok(Math.abs(r.weights.reduce((a,b)=>a+b,0)-1)<1e-8);
 assert.ok(r.weights.every((w,i)=>w>=0&&w<=input.caps[i]+1e-9));
 assert.equal(r.batches.length,4);assert.ok(r.batches.every(b=>Math.abs(b.norm-1)<1e-10));
 assert.equal(r.method.includes('no GLPK'),true);
});
test('changes in objective costs change energy calculation',()=>{
 const a=adiabaticQuantumAllocation(input),b=adiabaticQuantumAllocation({...input,costs:input.costs.map(x=>x+0.1)});
 assert.ok(Math.abs((b.objective-a.objective)-.1)<1e-9);
});
test('rejects insufficient region capacity',()=>{
 assert.throws(()=>adiabaticQuantumAllocation({...input,caps:Array(20).fill(.02)}),/Invalid adiabatic input/);
});
