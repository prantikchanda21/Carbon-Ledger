import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultInput} from '../lib/lab/engine.ts';
import {workloadBenchmark} from '../lib/lab/workloadQuantum.ts';
test('feasible-subspace warm QAOA conserves probability and feasibility',()=>{
 const input=defaultInput();const result=workloadBenchmark(input,{depth:3,iterations:8,restarts:1,warmStart:true,feasibleMixer:true,cvarAlpha:.25,seed:42});
 assert.ok(Math.abs(result.distribution.reduce((s,r)=>s+r.probability,0)-1)<1e-9);
 assert.ok(Math.abs(result.qaoa.feasibleProbability-1)<1e-9);
 assert.ok(result.qaoa.cost!>=result.exact.cost-1e-8);
 assert.ok(result.distribution.every(r=>r.feasible||r.probability<1e-10));
});
test('paired runs reproduce outputs at a fixed seed and retain classical references',()=>{
 const input=defaultInput(),opts={depth:2,iterations:8,restarts:2,warmStart:true,cvarAlpha:.5,seed:17};
 const a=workloadBenchmark(input,opts),b=workloadBenchmark(input,opts);
 assert.deepEqual(a.qaoa,b.qaoa);assert.deepEqual(a.distribution,b.distribution);
 assert.ok(a.greedy.cost>=a.exact.cost-1e-8);assert.ok(a.simulatedAnnealing.cost>=a.exact.cost-1e-8);
});
test('parameter transfer initializes the requested circuit without retraining',()=>{
 const input=defaultInput();const transfer={gamma:[.11,.22],beta:[.33,.44]};
 const r=workloadBenchmark(input,{depth:2,iterations:0,restarts:1,transfer});
 assert.deepEqual(r.qaoa.gamma,transfer.gamma);assert.deepEqual(r.qaoa.beta,transfer.beta);
 assert.ok(Math.abs(r.distribution.reduce((s,x)=>s+x.probability,0)-1)<1e-9);
});
