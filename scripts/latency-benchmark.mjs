/** Reproducible CPU benchmark; excludes HTTP, not solver work. Run on Node 22+. */
import fs from 'node:fs';
import os from 'node:os';
import {placementQaoa} from '../lib/quantum-v8/placement.ts';
import {solveClassicalDispatch} from '../lib/classicalWasmSolver.ts';
import {cooperativeDispatch} from '../lib/cooperativeHybrid.ts';
import {fractionalAllocationPolicy} from '../lib/fractionalAllocation.ts';
const repeats=10;
const snapshots=fs.readdirSync('tests/fixtures/latency').sort().map(f=>JSON.parse(fs.readFileSync(`tests/fixtures/latency/${f}`,'utf8')));
const samples=[],startup=[];
function setup(s){
 const costs=s.regions.map(r=>r.energy_price/1000+s.carbon_tax*.25*r.carbon_ci/1000+Math.max(0,r.latency_ms-s.sla_ms)*.005+r.egress_cost_gb*.05);
 const policy=fractionalAllocationPolicy(s.regions,{sla_ms:s.sla_ms,carbon_tax:s.carbon_tax,budget_cr:s.treasury_budget_cr,dpdp_locked:false},costs);
 return {request:{regions:s.regions,sla_ms:s.sla_ms,carbon_tax:s.carbon_tax,budget_cr:s.treasury_budget_cr,treasury_yield:6.8,dpdp_locked:false,mode:'simulator',shots:512,fast_mode:true},problem:{ids:s.regions.map(r=>r.id),costs,eligible:s.regions.map(r=>r.eligible),cap:1,...policy}};
}
function objective(p,w){return w.reduce((v,x,i)=>v+x*p.costs[i]+p.regularization*Math.abs(x-p.preferred[i]),0);}
async function run(s,method){
 const {request,problem}=setup(s); // identical shared preparation excluded for both methods
 const start=performance.now();let result,qaoaMs=0,reused=false;
 if(method==='glpk') result=await solveClassicalDispatch(problem);
 else {const q=placementQaoa(request);qaoaMs=q.execution_ms;const i=problem.ids.indexOf(q.best_feasible_sample.region_id);result=await cooperativeDispatch(problem,i,solveClassicalDispatch,Math.min(.1,problem.caps[i]*.5));reused=result.reusedBaseline;}
 const ms=performance.now()-start,w=result.weights;
 const feasible=w.length===20&&Math.abs(w.reduce((a,b)=>a+b,0)-1)<1e-7&&w.every((v,i)=>Number.isFinite(v)&&v>=-1e-8&&v<=problem.caps[i]+1e-7&&(problem.eligible[i]||v===0));
 if(!feasible)throw Error(`Infeasible ${s.scenario_id} ${method}`);
 return {id:s.scenario_id,family:s.scenario_family,method,ms,qaoaMs,reused,feasible,objective:objective(problem,w),weights:w};
}
// First-use measurements are explicitly sequential, sharing a process/GLPK runtime.
for(const method of ['glpk','hybrid'])startup.push(await run(snapshots[0],method));
for(let i=0;i<20;i++)for(const method of ['glpk','hybrid'])await run(snapshots[i%snapshots.length],method);
for(let round=0;round<repeats;round++)for(const s of snapshots)for(const method of (round%2?['hybrid','glpk']:['glpk','hybrid']))samples.push({...await run(s,method),round});
function stats(rows){const t=rows.map(x=>x.ms).sort((a,b)=>a-b);const p=n=>t[Math.ceil(t.length*n)-1];return {n:t.length,mean:t.reduce((a,b)=>a+b,0)/t.length,median:p(.5),p95:p(.95),p99:p(.99),max:t.at(-1),under5:t.filter(x=>x<=5).length,feasible:rows.filter(x=>x.feasible).length,reused:rows.filter(x=>x.reused).length};}
const glpk=stats(samples.filter(x=>x.method==='glpk')),hybrid=stats(samples.filter(x=>x.method==='hybrid'));
const scenarios=snapshots.map(s=>{const rows=samples.filter(x=>x.id===s.scenario_id),g=rows.filter(x=>x.method==='glpk'),h=rows.filter(x=>x.method==='hybrid');return {id:s.scenario_id,family:s.scenario_family,glpk:stats(g),hybrid:stats(h),objectiveGapPct:100*(h[0].objective-g[0].objective)/Math.max(1e-12,Math.abs(g[0].objective))};});
const report={version:'v83',created:new Date().toISOString(),hardware:{node:process.version,platform:os.platform(),cpu:os.cpus()[0].model},config:{scenarios:50,repeats,warmupPairs:20,depth:4,qubits:10,batches:4,shots:512,mode:'fixed-angle QAOA, unchanged from v82',timing:'Wall-clock solver time; includes QAOA and GLPK; excludes shared input preparation, HTTP, UI and module import; no result cache.'},startup,glpk,hybrid,scenarios,samples};
fs.writeFileSync('public/data/latency-v83.json',JSON.stringify(report,null,2));
const {samples:rawSamples,...summary}=report;
fs.writeFileSync('lib/latencyBenchmarkData.json',JSON.stringify(summary,null,2));
console.log(JSON.stringify({glpk,hybrid,startup:startup.map(({method,ms})=>({method,ms}))},null,2));
