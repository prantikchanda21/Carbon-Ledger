import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {readFileSync} from 'node:fs';
import {optimize,classicalUniform,objective} from './challenger.mjs';
const raw=JSON.parse(readFileSync(new URL('./raw.json',import.meta.url)));
test('every scenario feasible and every quantum batch normalized',()=>{
 for(const row of raw.cases){const output=optimize(row.input,{variant:'phase-walk',seed:row.id+1});assert.equal(output.feasible,true);assert.ok(Math.abs(output.weights.reduce((a,b)=>a+b,0)-1)<1e-8);for(const batch of output.batches)assert.ok(Math.abs(batch.norm-1)<1e-8);}
});
test('reported objective matches independently re-evaluated input',()=>{
 for(const row of raw.cases){const out=optimize(row.input,{variant:'phase-walk',seed:row.id+1});assert.ok(Math.abs(out.objective-objective(out.weights,row.input))<1e-10);}
});
test('rejects capacity infeasibility',()=>assert.throws(()=>optimize({...raw.cases[0].input,caps:Array(20).fill(.01)})));
test('oracle changes when objective changes',()=>{
 const input=raw.cases[0].input;
 const a=optimize(input,{variant:'phase-walk',seed:1});
 const b=optimize({...input,costs:[...input.costs].reverse()},{variant:'phase-walk',seed:1});
 assert.notDeepEqual(a.weights,b.weights);
});
test('no dashboard promotion while GLPK gates not passed',()=>{
 const content=readFileSync(new URL('../../lib/quantumEngineModes.ts',import.meta.url),'utf8');
 assert.ok(!content.includes('v144')&&!content.includes('phase-walk'));
});
