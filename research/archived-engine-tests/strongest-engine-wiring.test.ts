import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {quadQuantumAllocation} from '../lib/quadQuantum.ts';
const read=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8');

test('v134 A*-guided engine is an explicit dashboard option with its own API path',()=>{
 const dropdown=read('../components/ControllerDashboard.tsx');
 const modes=read('../lib/quantumEngineModes.ts');
 const route=read('../app/api/cooperative-allocation/route.ts');
 assert.match(dropdown,/value="quad">A\*-Guided Quantum Ensemble/);
 assert.match(modes,/quad:'A\*-Guided Quantum Ensemble/);
 assert.match(route,/if\(mode==='quad'\)\s*\{[\s\S]*?quadQuantumAllocation\(/);
 assert.match(route,/outcome:\{weights:run.weights/);
 assert.match(dropdown,/applyOverride\(optimizerResult,allocation/);
 assert.match(dropdown,/const netTreasuryYield = result/);
 assert.match(dropdown,/cooperative.key===cooperativeKey/);
 assert.doesNotMatch(dropdown,/Final selection also compares an exact classical analytical candidate/);
 assert.doesNotMatch(route,/Final ranking includes an exact classical candidate/);
});

test('selected engine produces feasible allocations that change modeled KPIs with inputs',async()=>{
 const base={costs:Array.from({length:20},(_,i)=>.2+i*.05),caps:Array(20).fill(.12),preferred:Array(20).fill(.05),regularization:.03};
 const changed={...base,costs:[...base.costs].reverse()};
 const x=await quadQuantumAllocation(base),y=await quadQuantumAllocation(changed);
 const validate=(weights:number[])=>{
  assert.ok(Math.abs(weights.reduce((a,b)=>a+b,0)-1)<1e-8);
  weights.forEach((w,i)=>{assert.ok(w>=0);assert.ok(w<=base.caps[i]+1e-8);});
 };
 validate(x.weights);validate(y.weights);
 const regions=Array.from({length:20},(_,i)=>({carbon:180+i*21,price:.06+i*.01,latency:15+i*3}));
 const metrics=(w:number[])=>({carbon:w.reduce((a,v,i)=>a+v*regions[i]!.carbon,0),cost:w.reduce((a,v,i)=>a+v*regions[i]!.price,0),latency:w.reduce((a,v,i)=>a+v*regions[i]!.latency,0)});
 assert.notDeepEqual(x.weights,y.weights);
 assert.notDeepEqual(metrics(x.weights),metrics(y.weights));
 assert.equal(x.classicalCandidateUsed,false);
});
