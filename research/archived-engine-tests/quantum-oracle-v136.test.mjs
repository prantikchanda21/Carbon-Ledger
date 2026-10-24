import test from 'node:test';import assert from 'node:assert/strict';
import {quantumOracleAllocation} from '../lib/quantumOracleEngine.ts';
const base={costs:Array.from({length:20},(_,i)=>.1+i*.01),caps:Array(20).fill(.08),preferred:Array(20).fill(.05),regularization:.04};
test('independent candidate is feasible and statevector normalized',()=>{const a=quantumOracleAllocation(base);assert.equal(a.feasible,true);assert.ok(Math.abs(a.weights.reduce((x,y)=>x+y,0)-1)<1e-8);assert.equal(a.batches.length,4);assert.ok(a.batches.every(b=>Math.abs(b.norm-1)<1e-10));assert.ok(a.weights.every(w=>w>=0&&w<=.08+1e-8));});
test('responds to objective changes',()=>{const a=quantumOracleAllocation(base),b=quantumOracleAllocation({...base,costs:base.costs.slice().reverse()});assert.notDeepEqual(a.weights,b.weights);});
test('rejects infeasible capacities',()=>{assert.throws(()=>quantumOracleAllocation({...base,caps:Array(20).fill(.01)}));});
