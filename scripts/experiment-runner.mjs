/** Offline, measured 20-region QAOA + GLPK experiments. Node 22.16+ with type stripping. */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {performance} from 'node:perf_hooks';
import {createHash} from 'node:crypto';
import {REGION_ORDER, REGIONS} from '../lib/regions.ts';
import {placementQaoa} from '../lib/quantum-v8/placement.ts';
import {flowGasCandidate} from '../lib/quantumEngineModes.ts';
import {solveClassicalDispatch} from '../lib/classicalWasmSolver.ts';
import {cooperativeDispatch} from '../lib/cooperativeHybrid.ts';
import {fractionalAllocationPolicy} from '../lib/fractionalAllocation.ts';

const root=path.dirname(fileURLToPath(import.meta.url));
const arg=(flag,defaultValue)=>{const i=process.argv.indexOf(flag);return i===-1?defaultValue:process.argv[i+1];};
const scenarios=Number(arg('--scenarios','10'));
const seed=Number(arg('--seed','42'));
const shots=Number(arg('--shots','512'));
const fastMode=arg('--mode','fast')==='fast';
const enginesArg=arg('--engines','all');
const aliases={all:['glpk_only','qaoa_glpk','fluid_qaoa_glpk','gaseous_qaoa_glpk'],glpk:'glpk_only',standard:'qaoa_glpk',fluid:'fluid_qaoa_glpk',gaseous:'gaseous_qaoa_glpk'};
const methods=enginesArg==='all'?aliases.all:enginesArg.split(',').map(name=>aliases[name.trim()]??name.trim());
if(!methods.length||methods.some(m=>!aliases.all.includes(m))||new Set(methods).size!==methods.length)throw Error('Invalid --engines. Use all or comma-separated glpk,standard,fluid,gaseous');
const out=path.resolve(arg('--out',path.join(root,'..','artifacts','experimental-evidence')));
if(!Number.isInteger(scenarios)||scenarios<1||scenarios>500||!Number.isInteger(seed)||!Number.isInteger(shots)||shots<32||shots>100000)throw Error('Invalid --scenarios, --seed or --shots');
fs.mkdirSync(out,{recursive:true});
const rng=(s)=>{let state=s>>>0;return ()=>{state=(Math.imul(1664525,state)+1013904223)>>>0;return state/4294967296;};};
const sha=(x)=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const csv=(rows,cols)=>[cols.join(','),...rows.map(r=>cols.map(k=>JSON.stringify(r[k]??'')).join(','))].join('\n')+'\n';
const cases=['normal','strict_sla','high_carbon','budget_pressure','disruption'];
const hardware={node:process.version,platform:process.platform,arch:process.arch,logical_cpus:os.cpus().length,model:os.cpus()[0]?.model??'unknown'};
const rows=[],records=[],failures=[];
for(let index=0;index<scenarios;index++){
 const family=cases[index%cases.length],random=rng(seed+index*7919),scenarioId=`${family}-${String(index+1).padStart(3,'0')}`;
 const sla=family==='strict_sla'?55:family==='normal'?100:85;
 const tax=family==='high_carbon'?.95:family==='budget_pressure'?.2:.55;
 const budget=family==='budget_pressure'?25:60;
 const regions=REGION_ORDER.map((id,i)=>{
  const item=REGIONS[id];const c=160+random()*350, price=60+random()*130, latency=12+random()*90;
  const outage=family==='disruption'&&i%7===0;
  return {id,code:item.code,carbon_ci:+c.toFixed(3),energy_price:+price.toFixed(3),latency_ms:+latency.toFixed(3),egress_cost_gb:.03+random()*.09,renewable_pct:item.renewable_baseline_pct,eligible:!outage&&latency<=sla};
 });
 // Make sure enough eligible regions for a meaningful capacity-constrained problem; record infeasibility otherwise.
 const input={scenario_id:scenarioId,scenario_family:family,scenario_seed:seed+index*7919,regions,sla_ms:sla,carbon_tax:tax,treasury_budget_cr:budget,shots,qubo_depth:4,qubits_per_batch:10,batches:4,data_source:'seeded_model',objective:'dynamic_cost_plus_carbon_and_latency',capacity_source:'modeled'};
 input.snapshot_sha256=sha(input);
 const elig=regions.filter(r=>r.eligible), costs=regions.map(r=>r.energy_price/1000+tax*.25*r.carbon_ci/1000+Math.max(0,r.latency_ms-sla)*.005+r.egress_cost_gb*.05);
 const nodes=regions.map((r,i)=>({id:r.id,eligible:r.eligible,renewable_pct:r.renewable_pct,latency_ms:r.latency_ms}));
 const policy=fractionalAllocationPolicy(nodes,{sla_ms:sla,carbon_tax:tax,budget_cr:budget,dpdp_locked:false},costs);
 const problem={ids:regions.map(r=>r.id),eligible:regions.map(r=>r.eligible),costs,cap:1,caps:policy.caps,preferred:policy.preferred,regularization:policy.regularization};
 const validate=(weights)=>{
  if(!Array.isArray(weights)||weights.length!==20)return {feasible:false,reason:'weight length mismatch'};
  const sum=weights.reduce((a,b)=>a+b,0);
  const violations=weights.flatMap((w,i)=>(!Number.isFinite(w)||w< -1e-8||w>policy.caps[i]+1e-7||(!regions[i].eligible&&Math.abs(w)>1e-8))?[regions[i].id]:[]);
  return {feasible:Math.abs(sum-1)<1e-6&&violations.length===0,sum,violations,capacity_model:'modeled',budget_hard_enforced:false};
 };
 const metric=(w)=>({objective:w.reduce((v,x,i)=>v+x*costs[i],0),carbon_g_per_kwh:w.reduce((v,x,i)=>v+x*regions[i].carbon_ci,0),weighted_latency_ms:w.reduce((v,x,i)=>v+x*regions[i].latency_ms,0),active_regions:w.filter(x=>x>1e-6).length});
 const base={scenario_id:scenarioId,scenario_family:family,sla_ms:sla,carbon_tax:tax,treasury_budget_cr:budget,eligible_regions:elig.length,carbon_variability:Math.max(...regions.map(x=>x.carbon_ci))-Math.min(...regions.map(x=>x.carbon_ci)),cost_variability:Math.max(...costs)-Math.min(...costs),snapshot_sha256:input.snapshot_sha256};
 let classical=null,quantum=null;
 for(const method of methods){
  const started=performance.now();let result;
  try{
   if(method==='glpk_only'){
    const solved=await solveClassicalDispatch(problem);classical=solved.weights;
    result={weights:solved.weights,solver_detail:'glpk.js actual solve'};
   }else{
    const request={regions:regions.map(({id,code,carbon_ci,energy_price,latency_ms,egress_cost_gb,eligible})=>({id,code,carbon_ci,energy_price,latency_ms,egress_cost_gb,eligible})),sla_ms:sla,carbon_tax:tax,budget_cr:budget,treasury_yield:6.8,dpdp_locked:false,mode:'simulator',shots,fast_mode:fastMode};
    const q=method==='qaoa_glpk'?placementQaoa(request):null;
    const candidate=method==='fluid_qaoa_glpk'||method==='gaseous_qaoa_glpk' ? flowGasCandidate(costs,problem.eligible,method==='fluid_qaoa_glpk'?'fluid':'gaseous') : null;
    const chosen=candidate?problem.ids[candidate.index]:(q?.best_feasible_sample?.region_id??Object.entries(q?.weights??{}).find(([,w])=>w>0)?.[0]);
    const chosenIndex=problem.ids.indexOf(chosen);
    if(chosenIndex<0)throw Error('QAOA candidate not found');
    const commitment=method==='qaoa_glpk'?Math.min(.1,policy.caps[chosenIndex]*.5):Math.min(.1,policy.caps[chosenIndex]*.45);
    const solution=await cooperativeDispatch(problem,chosenIndex,solveClassicalDispatch,commitment);
    const guardedFallback=solution.hybridCost>solution.classicalCost+1e-8;
    const finalWeights=guardedFallback?solution.classicalWeights:solution.weights;
    quantum=finalWeights;
    result={weights:finalWeights,guarded_fallback:guardedFallback,raw_hybrid_objective:solution.hybridCost,classical_objective:solution.classicalCost,quantum_candidate:chosen,quantum_commitment:commitment,qaoa_feasible_probability:q?.feasible_probability??null,qaoa_execution_ms:q?.execution_ms??null,optimizer_evals:candidate?.optimizerEvals??q?.optimizer_evals??null,quantum_changed_selection:candidate?.quantumChangedSelection??null,classical_best_candidate:candidate?problem.ids[candidate.classicalBestIndex]:null,quantum_candidate_score:candidate?.candidateScore??null,quantum_candidate_probability:candidate?.probability??null,solver_detail:candidate?`${candidate.method} + residual GLPK`:`10-qubit p=4 QAOA statevector + residual GLPK (${fastMode?'fast reduced-search':'full search'})`};
   }
   const elapsed=performance.now()-started,v=validate(result.weights),m=metric(result.weights);
   rows.push({...base,algorithm:method,feasible:Number(v.feasible),normalized_cost:m.objective,carbon_g_per_kwh:m.carbon_g_per_kwh,weighted_latency_ms:m.weighted_latency_ms,quantum_candidate:result.quantum_candidate??'',quantum_candidate_probability:result.quantum_candidate_probability??'',guarded_fallback:result.guarded_fallback??false,quantum_changed_selection:result.quantum_changed_selection??'',optimizer_evals:result.optimizer_evals??'',runtime_ms:elapsed,solver_status:v.feasible?'success':'invalid',scenario_seed:input.scenario_seed});
   records.push({...base,algorithm:method,status:v.feasible?'success':'invalid',runtime_ms:elapsed,validation:v,measurements:m,...result});
  }catch(error){
   const message=error instanceof Error?error.stack??error.message:String(error),elapsed=performance.now()-started;
   rows.push({...base,algorithm:method,feasible:0,normalized_cost:'',runtime_ms:elapsed,solver_status:'error',scenario_seed:input.scenario_seed});
   records.push({...base,algorithm:method,status:'error',runtime_ms:elapsed,error:message});
   failures.push({scenario_id:scenarioId,algorithm:method,error:message});
  }
 }
 fs.writeFileSync(path.join(out,`scenario-${scenarioId}.json`),JSON.stringify(input,null,2));
 console.log(`${index+1}/${scenarios}: ${scenarioId} (${elig.length} eligible): `+methods.map(m=>`${m}=${records.find(r=>r.scenario_id===scenarioId&&r.algorithm===m)?.status??'missing'}`).join(', '));
 for(const failure of failures.filter(f=>f.scenario_id===scenarioId))console.error(`  ${failure.algorithm} failure:`,failure.error.split('\n')[0]);
}
const cols=['guarded_fallback','carbon_g_per_kwh','weighted_latency_ms','quantum_candidate','quantum_candidate_probability','quantum_changed_selection','optimizer_evals','scenario_id','sla_ms','carbon_tax','treasury_budget_cr','eligible_regions','carbon_variability','cost_variability','algorithm','feasible','normalized_cost','runtime_ms','scenario_seed','scenario_family','snapshot_sha256','solver_status'];
fs.writeFileSync(path.join(out,'solver_benchmarks.csv'),csv(rows.filter(r=>r.solver_status==='success'),cols));
fs.writeFileSync(path.join(out,'all_attempts.csv'),csv(rows,cols));
fs.writeFileSync(path.join(out,'raw_results.json'),JSON.stringify(records,null,2));
fs.writeFileSync(path.join(out,'run_manifest.json'),JSON.stringify({created_utc:new Date().toISOString(),hardware,scenarios,seed,shots,qaoa_search_mode:fastMode?'reduced-angle-search':'full-angle-search',algorithms:methods,quantum_simulator:'Standard: 4 x 10-qubit p=4 statevector batches; Fluid/Gaseous: 5-qubit p=3 statevector batches, adaptive coordinate-descent angle search; gaseous applies classical Boltzmann reweighting',solver:'glpk.js',data_source:'seeded modeled scenarios',scientific_limits:['No physical quantum hardware','Standard and fluid/gaseous modes use different qubit counts and angle schedules; comparisons are not resource matched','Fluid/gaseous selection combines normalized cost and quantum probability, and must be evaluated against cost-only selection','Model capacities not measured','Treasury hard budget not enforced','QAOA internal sampler uses deterministic fixed seeds; scenario seeds differ but are not independent quantum optimizer seeds','Reduced-search mode changes QAOA parameter tuning and may reduce candidate quality','End-to-end timings depend on local machine','Results should not be interpreted as quantum advantage'],failures},null,2));
console.log(`Results saved in ${out}. Failed solver runs: ${failures.length}/${rows.length}.`);
if(failures.length)process.exitCode=2;

// Aggregate only validated, successful samples. Never substitute failed runs.
const summary=methods.map(algorithm=>{
 const subset=rows.filter(r=>r.algorithm===algorithm),valid=subset.filter(r=>r.solver_status==='success'&&r.feasible===1);
 const sorted=valid.map(r=>r.runtime_ms).sort((a,b)=>a-b);
 const avg=k=>valid.length?valid.reduce((a,r)=>a+Number(r[k]??0),0)/valid.length:null;
 const measuredQuantum=valid.filter(r=>typeof r.quantum_changed_selection==='boolean');
 const ref=new Map(rows.filter(r=>r.algorithm==='glpk_only'&&r.solver_status==='success').map(r=>[r.scenario_id,r]));
 const gaps=valid.flatMap(r=>{const baseline=ref.get(r.scenario_id);return baseline&&typeof baseline.normalized_cost==='number'?[100*(r.normalized_cost-baseline.normalized_cost)/Math.max(Math.abs(baseline.normalized_cost),1e-9)]:[];});
 return {algorithm,attempts:subset.length,feasible_runs:valid.length,failed_runs:subset.length-valid.length,mean_runtime_ms:avg('runtime_ms'),p95_runtime_ms:sorted.length?sorted[Math.ceil(.95*sorted.length)-1]:null,mean_objective:avg('normalized_cost'),mean_carbon_g_per_kwh:avg('carbon_g_per_kwh'),mean_objective_gap_vs_glpk_pct:gaps.length?gaps.reduce((a,b)=>a+b,0)/gaps.length:null,matched_glpk_instances:gaps.length,quantum_selection_change_rate:measuredQuantum.length?measuredQuantum.filter(r=>r.quantum_changed_selection).length/measuredQuantum.length:null,mean_optimizer_evals:measuredQuantum.length?measuredQuantum.reduce((a,r)=>a+Number(r.optimizer_evals),0)/measuredQuantum.length:null,guarded_fallback_rate:valid.length?valid.filter(r=>r.guarded_fallback===true).length/valid.length:null};
});
fs.writeFileSync(path.join(out,'engine_summary.json'),JSON.stringify(summary,null,2));
fs.writeFileSync(path.join(out,'engine_summary.csv'),csv(summary,['algorithm','attempts','feasible_runs','failed_runs','mean_runtime_ms','p95_runtime_ms','mean_objective','mean_carbon_g_per_kwh','mean_objective_gap_vs_glpk_pct','matched_glpk_instances','quantum_selection_change_rate','mean_optimizer_evals','guarded_fallback_rate']));
console.table(summary.map(({algorithm,attempts,feasible_runs,mean_runtime_ms,p95_runtime_ms,mean_objective_gap_vs_glpk_pct})=>({algorithm,attempts,feasible_runs,mean_ms:mean_runtime_ms?.toFixed(3)??'NA',p95_ms:p95_runtime_ms?.toFixed(3)??'NA',gap_pct:mean_objective_gap_vs_glpk_pct?.toFixed(3)??'NA'})));
