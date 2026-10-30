import fs from 'node:fs';
import os from 'node:os';
import {placementQaoa} from '../lib/quantum-v8/placementCore.ts';
import {flowGasCandidate} from '../lib/quantumEngineModes.ts';
import {solveClassicalDispatch} from '../lib/classicalWasmSolver.ts';
import {cooperativeDispatch} from '../lib/cooperativeHybrid.ts';
import {fractionalAllocationPolicy} from '../lib/fractionalAllocation.ts';
const original=process.env.COMPARE_V91==='1';
const oldFlow=original?(await import('./reference-v91/quantumEngineModes.ts')).flowGasCandidate:null;
const oldStandard=original?(await import('./reference-v91/placementCore.ts')).placementQaoa:null;
const scenarios=fs.readdirSync('tests/fixtures/latency').sort().map(f=>JSON.parse(fs.readFileSync('tests/fixtures/latency/'+f)));
const methods=['glpk','standard','fluid','gaseous'];
const rows=[];let equivalenceChecks=0;
const objective=(p,w)=>w.reduce((s,v,i)=>s+v*p.costs[i]+p.regularization*Math.abs(v-p.preferred[i]),0);
function prepare(s){
 const costs=s.regions.map(r=>r.energy_price/1000+s.carbon_tax*.25*r.carbon_ci/1000+Math.max(0,r.latency_ms-s.sla_ms)*.005+r.egress_cost_gb*.05);
 const policy=fractionalAllocationPolicy(s.regions,{sla_ms:s.sla_ms,carbon_tax:s.carbon_tax,budget_cr:s.treasury_budget_cr,dpdp_locked:false},costs);
 return {p:{ids:s.regions.map(r=>r.id),costs,eligible:s.regions.map(r=>r.eligible),cap:1,...policy},request:{regions:s.regions,sla_ms:s.sla_ms,carbon_tax:s.carbon_tax,budget_cr:s.treasury_budget_cr,treasury_yield:6.8,dpdp_locked:false,mode:'simulator',shots:512,fast_mode:true}};
}
function choose(method,p,request,old=false){
 if(method==='standard'){
  const q=(old?oldStandard:placementQaoa)(request);
  return {index:p.ids.indexOf(q.best_feasible_sample.region_id),probability:q.feasible_probability};
 }
 return (old?oldFlow:flowGasCandidate)(p.costs,p.eligible,method);
}
async function run(s,method,old=false){
 const {p,request}=prepare(s);const start=performance.now();let out,qms=0;
 if(method==='glpk')out=await solveClassicalDispatch(p);
 else{const q=choose(method,p,request,old);qms=performance.now()-start;out=await cooperativeDispatch(p,q.index,solveClassicalDispatch,Math.min(.1,p.caps[q.index]*.45),!old);
 // v91 API already rejected inferior allocations, after paying for residual solve.
 if(old&&out.hybridCost>out.classicalCost+1e-8)out.weights=out.classicalWeights;
 }
 const ms=performance.now()-start,w=out.weights;
 const feasible=Math.abs(w.reduce((a,b)=>a+b,0)-1)<1e-7&&w.every((v,i)=>Number.isFinite(v)&&v>=-1e-8&&v<=p.caps[i]+1e-7&&(p.eligible[i]||Math.abs(v)<1e-8));
 if(!feasible)throw Error('Infeasible output');
 return {scenario:s.scenario_id,method,version:old?'v91':'v92',ms,qaoaMs:qms,objective:objective(p,w),feasible,guardRejected:out.qualityGuardRejected??false};
}
if(original)for(const s of scenarios){const {p,request}=prepare(s);for(const m of methods.slice(1)){
 const a=choose(m,p,request),b=choose(m,p,request,true);
 if(a.index!==b.index||Math.abs(a.probability-b.probability)>1e-10)throw Error('Circuit mismatch '+s.scenario_id+' '+m);
 equivalenceChecks++;
}}
const startup=[];for(const m of methods)startup.push(await run(scenarios[0],m));
for(let i=0;i<16;i++)for(const m of methods){await run(scenarios[i],m);if(original&&m!=='glpk')await run(scenarios[i],m,true);}
for(let round=0;round<8;round++)for(const s of scenarios){
 const rotated=methods.slice(round%4).concat(methods.slice(0,round%4));
 for(const m of rotated){
  if(original&&m!=='glpk'&&round%2)rows.push({...await run(s,m,true),round});
  rows.push({...await run(s,m),round});
  if(original&&m!=='glpk'&&!(round%2))rows.push({...await run(s,m,true),round});
 }
}
const summary=[];
for(const version of original?['v91','v92']:['v92'])for(const method of methods){
 const selected=rows.filter(r=>r.version===version&&r.method===method);if(!selected.length)continue;
 const times=selected.map(r=>r.ms).sort((a,b)=>a-b),quantile=q=>times[Math.ceil(q*times.length)-1];
 let maxGap=0,wins=0;
 for(const r of selected){const baseline=rows.find(b=>b.method==='glpk'&&b.scenario===r.scenario&&b.round===r.round);maxGap=Math.max(maxGap,100*(r.objective-baseline.objective)/Math.max(1e-12,Math.abs(baseline.objective)));if(r.ms<baseline.ms)wins++;}
 summary.push({version,method,runs:selected.length,medianMs:quantile(.5),p95Ms:quantile(.95),maxMs:times.at(-1),feasible:selected.filter(r=>r.feasible).length,maxObjectiveGapPct:maxGap,fasterThanGlpk:wins,guardRejected:selected.filter(r=>r.guardRejected).length});
}
fs.mkdirSync('artifacts/v92',{recursive:true});
fs.writeFileSync('artifacts/v92/benchmark.json',JSON.stringify({hardware:{node:process.version,cpu:os.cpus()[0].model},methodology:'50 bundled scenarios, 8 repeats, rotated engine order; identical objective and caps. Includes quantum, GLPK and guard; excludes common preparation, HTTP and imports. No result caching. CPU simulation. v91 comparisons use bundled original source snapshots; default benchmark needs no external files. No universal speed or secondary-metric guarantee.',equivalenceChecks,startup,summary,rows},null,2));
console.log(JSON.stringify({equivalenceChecks,summary},null,2));
