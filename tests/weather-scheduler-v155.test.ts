import test from 'node:test';
import assert from 'node:assert/strict';
import {HOURLY_SCHEDULER_SLOTS,schedulingHour,mapHourlyWithConcurrency} from '../lib/schedulerHours.ts';
import {DASHBOARD_CONTROLS_STORAGE_KEY,parseDashboardBudget,readDashboardBudget,writeDashboardBudget} from '../lib/dashboardBudgetSync.ts';
import {millionToCr} from '../lib/budgetUsd.ts';

test('hourly scheduler covers all 24 hours in order, not four snapshots',()=>{
 assert.deepEqual([...HOURLY_SCHEDULER_SLOTS],Array.from({length:24},(_,i)=>i));
 for(const h of HOURLY_SCHEDULER_SLOTS)assert.equal(schedulingHour(h),h);
 assert.throws(()=>schedulingHour(24));assert.throws(()=>schedulingHour(-1));
});
test('bounded concurrency visits 24 hours exactly once and preserves results',async()=>{
 let inFlight=0,max=0;const seen:number[]=[];
 const result=await mapHourlyWithConcurrency(HOURLY_SCHEDULER_SLOTS,3,async h=>{
  inFlight++;max=Math.max(max,inFlight);seen.push(h);
  await new Promise(resolve=>setTimeout(resolve,1));inFlight--;return h*2;
 });
 assert.equal(max,3);assert.equal(inFlight,0);
 assert.deepEqual([...seen].sort((a,b)=>a-b),[...HOURLY_SCHEDULER_SLOTS]);
 assert.equal(Object.keys(result).length,24);assert.equal(result[23],46);
});
test('hourly failures reject rather than silently presenting an incomplete schedule',async()=>{
 await assert.rejects(mapHourlyWithConcurrency([0,1,2],2,async h=>{if(h===1)throw Error('solver failed');return h;}),/solver failed/);
});
test('shared treasury budget reads dashboard control state in USD millions',()=>{
 const record=JSON.stringify({sla_ms:57,carbon_tax:0.88,budget_cr:millionToCr(50),dpdp_locked:false});
 assert.equal(parseDashboardBudget(record),50);
 assert.equal(parseDashboardBudget('{}'),null);
 assert.equal(parseDashboardBudget('not json'),null);
 assert.equal(readDashboardBudget({getItem:()=>record,setItem:()=>{}}),50);
 assert.equal(readDashboardBudget({getItem:()=>null,setItem:()=>{}}),30);
});
test('scheduler budget edits persist without resetting other dashboard controls',()=>{
 const data=new Map([[DASHBOARD_CONTROLS_STORAGE_KEY,JSON.stringify({sla_ms:60,carbon_tax:.7,dpdp_locked:true,budget_cr:millionToCr(30)})]]);
 const store={getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{data.set(k,v);}};
 assert.equal(writeDashboardBudget(75,store),75);
 const saved=JSON.parse(data.get(DASHBOARD_CONTROLS_STORAGE_KEY)!);
 assert.equal(saved.sla_ms,60);assert.equal(saved.carbon_tax,.7);assert.equal(saved.dpdp_locked,true);
 assert.equal(readDashboardBudget(store),75);
 assert.equal(writeDashboardBudget(400,store),100);
});
test('weather UI shows all regions, scheduler uses every hour and shares budget',async()=>{
 const fs=await import('node:fs');
 const weather=fs.readFileSync(new URL('../components/WeatherOptimizer.tsx',import.meta.url),'utf8');
 const scheduler=fs.readFileSync(new URL('../components/QuantumScheduler.tsx',import.meta.url),'utf8');
 assert.ok(weather.includes('deltas.map(r=>'));
 assert.ok(!weather.includes('deltas.slice(0,8)'));
 assert.ok(scheduler.includes('mapHourlyWithConcurrency(HOURLY_SCHEDULER_SLOTS,3'));
 assert.ok(scheduler.includes('budget:budgetMillion'));
 assert.ok(!scheduler.includes('budget:50'));
 const planner=fs.readFileSync(new URL('../lib/schedulePlanner.ts',import.meta.url),'utf8');
 assert.ok(planner.includes('solves[schedulingHour(h+k)]'));
 assert.ok(!scheduler.includes('return regional.price*clamp('));
});
