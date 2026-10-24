import fs from 'node:fs';
import assert from 'node:assert/strict';
const fixture=JSON.parse(fs.readFileSync('tests/fixtures/latency/scenario-budget_pressure-004.json'));
const nodes=fixture.regions.map(r=>({...r,region:r.id,city:r.id,weight:0,exclusion_reason:null,unit_cost_usd_per_kwh:r.energy_price/1000}));
const payload={engine:'quad',nodes,telemetry:nodes.map(r=>({...r,region:r.id,available:true,dpdp_locked:false})),controls:{sla_ms:180,carbon_tax:.2,budget_cr:50,dpdp_locked:false}};
async function run(body){const response=await fetch('http://localhost:3000/api/cooperative-allocation',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});assert.equal(response.status,200);const data=await response.json();assert.equal(data.engineUsed,'quad');assert.equal(data.fallbackReason,null);assert.equal(data.outcome.classicalCost,null);assert.equal(data.outcome.feasible,true);assert.equal(data.selectionDiagnostics.batches.length,4);return data;}
const a=await run(payload);
const b=await run({...payload,controls:{...payload.controls,carbon_tax:1,budget_cr:5}});
assert.notDeepEqual(a.outcome.weights,b.outcome.weights);
const weighted=(data,key)=>data.outcome.weights.reduce((sum,w,i)=>sum+w*nodes[i][key],0);
assert.notEqual(weighted(a,'carbon_ci'),weighted(b,'carbon_ci'));
assert.notEqual(weighted(a,'energy_price'),weighted(b,'energy_price'));
console.log('Production API passed: independent engine, four batches, dynamic allocation, carbon and operating cost, no GLPK fallback.');
