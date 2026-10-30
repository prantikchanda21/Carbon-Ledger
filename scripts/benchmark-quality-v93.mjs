// Untimed allocation audit; timing evidence remains the recorded v92 experiment.
import fs from 'node:fs';
import {placementQaoa} from '../lib/quantum-v8/placementCore.ts';
import {flowGasCandidate} from '../lib/quantumEngineModes.ts';
import {solveClassicalDispatch} from '../lib/classicalWasmSolver.ts';
import {cooperativeDispatch} from '../lib/cooperativeHybrid.ts';
import {fractionalAllocationPolicy} from '../lib/fractionalAllocation.ts';
const rows=[];
for(const file of fs.readdirSync('tests/fixtures/latency').sort()){
 const s=JSON.parse(fs.readFileSync('tests/fixtures/latency/'+file));
 const costs=s.regions.map(r=>r.energy_price/1000+s.carbon_tax*.25*r.carbon_ci/1000+Math.max(0,r.latency_ms-s.sla_ms)*.005+r.egress_cost_gb*.05);
 const policy=fractionalAllocationPolicy(s.regions,{sla_ms:s.sla_ms,carbon_tax:s.carbon_tax,budget_cr:s.treasury_budget_cr,dpdp_locked:false},costs);
 const p={ids:s.regions.map(r=>r.id),costs,eligible:s.regions.map(r=>r.eligible),cap:1,...policy};
 let baseline;
 for(const method of ['glpk','standard','fluid','gaseous']){
  let out;
  if(method==='glpk')out=await solveClassicalDispatch(p);
  else {
   let i;
   if(method==='standard'){
    const q=placementQaoa({regions:s.regions,sla_ms:s.sla_ms,carbon_tax:s.carbon_tax,budget_cr:s.treasury_budget_cr,treasury_yield:6.8,dpdp_locked:false,mode:'simulator',shots:512,fast_mode:true});
    i=p.ids.indexOf(q.best_feasible_sample.region_id);
   }else i=flowGasCandidate(costs,p.eligible,method).index;
   out=await cooperativeDispatch(p,i,solveClassicalDispatch,Math.min(.1,p.caps[i]*.45),true);
  }
  const w=out.weights;
  if(method==='glpk')baseline=w;
  const weighted=key=>w.reduce((v,x,i)=>v+x*s.regions[i][key],0);
  const valid=Math.abs(w.reduce((a,b)=>a+b,0)-1)<1e-7&&w.every((v,i)=>Number.isFinite(v)&&v>=-1e-8&&v<=p.caps[i]+1e-7&&(p.eligible[i]||Math.abs(v)<1e-8));
  if(!valid)throw Error('Invalid allocation');
  rows.push({scenario:s.scenario_id,family:s.scenario_family,method,weights:w,carbon:weighted('carbon_ci'),energyPrice:weighted('energy_price')/1000,latency:weighted('latency_ms'),renewable:weighted('renewable_pct'),egress:weighted('egress_cost_gb'),activeRegions:w.filter(v=>v>1e-8).length,objective:w.reduce((v,x,i)=>v+x*costs[i]+p.regularization*Math.abs(x-p.preferred[i]),0),maxWeightDifference:Math.max(...w.map((v,i)=>Math.abs(v-baseline[i]))),guardRejected:out.qualityGuardRejected??false,valid});
 }
}
const result={methodology:'Separate untimed rerun on the same 50 modeled fixtures, all four engines; final allocations include the quality guard. Weighted fixture indicators are not measured operational emissions, bills, network performance or data-center capacity. SLA is not separately asserted: eligibility flags and modeled caps define this dispatch LP. No hard energy-budget audit is claimed.',rows};
fs.writeFileSync('public/data/quality-v93.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(['glpk','standard','fluid','gaseous'].map(method=>{const r=rows.filter(x=>x.method===method);return {method,maxWeightDifference:Math.max(...r.map(x=>x.maxWeightDifference)),carbon:r.reduce((v,x)=>v+x.carbon,0)/r.length,guardRejected:r.filter(x=>x.guardRejected).length};}),null,2));
