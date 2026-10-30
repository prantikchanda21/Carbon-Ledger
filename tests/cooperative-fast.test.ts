import test from 'node:test';
import assert from 'node:assert/strict';
import {cooperativeDispatch} from '../lib/cooperativeHybrid.ts';
import {solveResidualDispatch} from '../lib/hybridResidualGlpk.ts';
import {solveClassicalDispatch,loadGlpk} from '../lib/classicalWasmSolver.ts';
import type {DispatchProblem} from '../lib/optimizer.ts';
const p:DispatchProblem={ids:['mumbai','frankfurt','virginia'],costs:[.1,.2,.3],eligible:[true,true,false],cap:1,caps:[.7,.6,0],preferred:[.6,.4,0],regularization:.2};
test('GLPK initialization is shared across calls',async()=>{assert.strictEqual(await loadGlpk(),await loadGlpk());});
test('baseline reuse equals residual GLPK optimum with regularization',async()=>{
 const a=await cooperativeDispatch(p,0,solveClassicalDispatch,.1);
 assert.equal(a.reusedBaseline,true);
 const residual=await solveResidualDispatch(p,0,.1);
 residual[0]+=.1;
 residual.forEach((w,i)=>assert.ok(Math.abs(w-a.weights[i])<1e-8));
 assert.ok(a.hybridCost>=a.classicalCost-1e-9);
});
test('binding quantum commitment executes residual LP and preserves constraints',async()=>{
 const a=await cooperativeDispatch(p,1,solveClassicalDispatch,.55);
 assert.equal(a.reusedBaseline,false);
 assert.ok(a.weights[1]>=.55-1e-9);
 assert.equal(a.weights[2],0);
 assert.ok(a.hybridCost>=a.classicalCost-1e-9);
});
test('ineligible or over-cap quantum commitments are rejected',async()=>{
 await assert.rejects(cooperativeDispatch(p,2,solveClassicalDispatch,.1));
 await assert.rejects(cooperativeDispatch(p,0,solveClassicalDispatch,.8));
});
test('quality guard avoids residual solve and preserves exact GLPK allocation',async()=>{
 const baseline=await solveClassicalDispatch(p);
 let calls=0;
 const a=await cooperativeDispatch(p,1,async()=>{calls++;return baseline;},.55,true);
 assert.equal(calls,1);
 assert.equal(a.qualityGuardRejected,true);
 assert.equal(a.committedFraction,0);
 assert.deepEqual(a.weights,baseline.weights);
 assert.equal(a.hybridCost,a.classicalCost);
});
