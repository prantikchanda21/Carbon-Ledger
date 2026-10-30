import test from 'node:test';
import assert from 'node:assert/strict';
import {generateTelemetry} from '../lib/mockData.ts';
import {optimize,type Engines} from '../lib/optimizer.ts';
import {greedyAllocation} from '../lib/controllerMath.ts';
import {riskAwareAllocation} from '../lib/riskAwareAllocation.ts';
import {estimateRisk} from '../lib/quantumRiskIqae.ts';
import {applyOverride,capacitiesOf} from '../lib/override.ts';
const engines:Engines={onnx:async()=>{throw Error('offline');},classical:async p=>({weights:greedyAllocation(p.costs,p.eligible,p.cap),execution_ms:.1,init_ms:0})};
test('risk policy changes actual allocations, remains feasible and restores unmodified engine at loose tolerance',async()=>{
 const controls={sla_ms:180,carbon_tax:.5,budget_cr:50,dpdp_locked:false};
 const base=await optimize({...controls,telemetry:generateTelemetry(new Date('2026-10-04T12:00:00Z'),false,true),treasury_yield:6.8,shadow:false,chaos:'none'},engines);
 const strict=riskAwareAllocation(base,controls,5,'fixed');
 const loose=riskAwareAllocation(base,controls,100,'fixed');
 assert.equal(loose.changed,false);assert.equal(loose.result,base);
 assert.equal(strict.changed,true);assert.ok(strict.after.exact<strict.before.exact);
 assert.equal(strict.status,'unresolved'); // synthetic floor cannot meet 5%
 assert.notDeepEqual(strict.result.allocations.node_weights,base.allocations.node_weights);
 assert.ok(Math.abs(Object.values(strict.result.allocations.node_weights).reduce((s,w)=>s+w,0)-1)<1e-10);
 const caps=capacitiesOf(base,controls);
 for(const n of strict.result.nodes){assert.ok(n.weight<=caps[n.id]+1e-9);if(!n.eligible)assert.equal(n.weight,0);}
 assert.ok(strict.result.latency.sla_compliant);
 const schedule=Object.fromEntries(base.nodes.map((n,i)=>[n.id,i===0?1:0]));
 const scheduled=applyOverride(base,schedule,{budget_cr:50,carbon_tax:.5});
 assert.notDeepEqual(scheduled.allocations.node_weights,base.allocations.node_weights);
 assert.ok(Math.abs(Object.values(scheduled.allocations.node_weights).reduce((s,w)=>s+w,0)-1)<1e-10);
});
test('live risk MC has matched query budget and reproducible estimates',()=>{
 const x={weights:{a:.8,b:.2},carbon:400,latency:60,sla:80,seed:911};
 const r=estimateRisk(x);assert.equal(r.mcCalls,r.iqaeCalls);assert.equal(r.mcCalls,8704);
 assert.deepEqual(r,estimateRisk(x));assert.ok(Math.abs(r.probability-r.exact)<.015);
});
import {scheduleJobs,type EngineResult} from '../lib/schedulePlanner.ts';
import {REGION_ORDER,REGIONS} from '../lib/regions.ts';
import type {WeatherResponse} from '../lib/weather/insights.ts';
import {parsePolicy} from '../lib/dashboardPolicy.ts';
test('scheduler reacts to forecast prices, deadlines and residency without overlapping capacity',()=>{
 const weather={retrievedAt:new Date().toISOString(),regions:REGION_ORDER.map(id=>({id,code:REGIONS[id].code,hours:Array.from({length:24},()=>({temperatureC:20}))}))} as unknown as WeatherResponse;
 const solves=Object.fromEntries(Array.from({length:24},(_,h)=>[h,{regions:REGION_ORDER.map(id=>({id,eligible:true,carbon:100,price:h<8?100:1,latency:20})),outcome:{weights:REGION_ORDER.map(()=>.05)}}])) as Record<number,EngineResult>;
 const job={id:'x',name:'Batch',earliest:0,deadline:24,duration:2,demand:70,residency:'india' as const};
 const a=scheduleJobs([job],weather,solves,0,'test');assert.equal(a.jobs[0].start,8);assert.ok(['mumbai','delhi','hyderabad'].includes(a.jobs[0].region));
 const b=scheduleJobs([{...job,deadline:4}],weather,solves,0,'test');assert.equal(b.jobs[0].start,0);
 const c=scheduleJobs([{...job,earliest:5,deadline:4}],weather,solves,0,'test');assert.equal(c.jobs.length,0);assert.equal(c.unscheduled.length,1);
 for(const run of Object.values(solves))for(const n of run.regions)n.price=n.id==='delhi'?.001:100;
 const d=scheduleJobs([job],weather,solves,0,'test');assert.equal(d.jobs[0].region,'delhi');
});
test('persisted dashboard policies reject malformed weights and weather factors',()=>{
 assert.deepEqual(parsePolicy('null'),{});assert.deepEqual(parsePolicy('{"weather":{"hour":0}}'),{});
 assert.deepEqual(parsePolicy('{"scheduler":{"weights":{"mumbai":1}}}'),{});
 assert.ok(parsePolicy(JSON.stringify({weather:{hour:4,factors:{x:1.1},at:'test'}})).weather);
});
