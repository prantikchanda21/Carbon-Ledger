/** Run AFTER npm install on Node 22. Actual GLPK.js needed; never silently use another solver.
 * Run: node research/quantum_challenger/benchmark_glpk_gate.mjs
 */
import {readFileSync,writeFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {optimize} from './challenger.mjs';
const raw=JSON.parse(readFileSync(new URL('./raw.json',import.meta.url)));
const reportPath=new URL('./actual_glpk_gate.json',import.meta.url);
let module;
try{module=await import('glpk.js');}
catch(e){const report={passed:false,glpkTested:false,error:'glpk.js package unavailable. Install project dependencies and rerun on Node 22; do NOT substitute HiGHS.'};writeFileSync(reportPath,JSON.stringify(report,null,2));console.error(report.error);process.exit(2);}
const factory=module.default?.default??module.default??module;
const glpk=await factory();
const median=a=>{const sorted=[...a].sort((a,b)=>a-b);return sorted[Math.floor(sorted.length/2)];};
const p95=a=>{const sorted=[...a].sort((a,b)=>a-b);return sorted[Math.ceil(.95*sorted.length)-1];};
const mean=a=>a.reduce((a,b)=>a+b,0)/a.length;
const metrics=(w,features)=>Object.fromEntries(Object.entries(features).map(([name,values])=>[name,w.reduce((a,v,i)=>a+v*values[i],0)]));
const rows=[];
for(const c of raw.cases){
 const input=c.input, n=input.costs.length, names=input.costs.map((_,i)=>`w_${i}`);
 const model={name:'same-20-region-allocation',objective:{direction:glpk.GLP_MIN,name:'total_objective',vars:[...names.map((name,i)=>({name,coef:input.costs[i]})),...names.map((_,i)=>({name:`d_${i}`,coef:input.regularization}))]},
 subjectTo:[{name:'allocation_sum',vars:names.map(name=>({name,coef:1})),bnds:{type:glpk.GLP_FX,lb:1,ub:1}},
 ...names.map((name,i)=>({name:`deviation_plus_${i}`,vars:[{name,coef:1},{name:`d_${i}`,coef:-1}],bnds:{type:glpk.GLP_UP,lb:0,ub:input.preferred[i]}})),
 ...names.map((name,i)=>({name:`deviation_minus_${i}`,vars:[{name,coef:-1},{name:`d_${i}`,coef:-1}],bnds:{type:glpk.GLP_UP,lb:0,ub:-input.preferred[i]}}))],
 bounds:[...names.map((name,i)=>({name,type:glpk.GLP_DB,lb:0,ub:input.caps[i]})),...names.map((_,i)=>({name:`d_${i}`,type:glpk.GLP_LO,lb:0,ub:0}))]};
 const gt=[],qt=[];let solved,q;
 for(let k=0;k<8;k++){
  let start=performance.now();solved=glpk.solve(model,{msglev:glpk.GLP_MSG_OFF});gt.push(performance.now()-start);
  start=performance.now();q=optimize(input,{variant:'phase-walk',seed:c.id+1});qt.push(performance.now()-start);
 }
 if(solved.result.status!==glpk.GLP_OPT)throw Error(`GLPK failed optimality check on case ${c.id}: ${solved.result.status}`);
 const w=names.map(name=>solved.result.vars[name]);
 const glpkCost=w.reduce((s,x,i)=>s+x*input.costs[i]+input.regularization*Math.abs(x-input.preferred[i]),0);
 const qm=metrics(q.weights,c.features),gm=metrics(w,c.features);
 rows.push({id:c.id,quantumObjective:q.objective,glpkObjective:glpkCost,objectiveGapPct:100*(q.objective-glpkCost)/Math.max(Math.abs(glpkCost),1e-10),quantumMs:median(qt),glpkMs:median(gt),quantumMetrics:qm,glpkMetrics:gm,feasible:q.feasible});
}
const allNoWorse=(f,cmp)=>rows.every(row=>cmp(row[f]));
const keyNames={carbon:'carbon',operating:'operating',latency:'latency',risk:'risk',apy:'apy'};
const meanMetrics=Object.fromEntries(Object.keys(keyNames).map(k=>[k,{quantum:mean(rows.map(r=>r.quantumMetrics[k])),glpk:mean(rows.map(r=>r.glpkMetrics[k]))}]));
const summary={glpkTested:true,glpkVersion:glpk.version,meanObjectiveGapPct:mean(rows.map(r=>r.objectiveGapPct)),maxObjectiveGapPct:Math.max(...rows.map(r=>r.objectiveGapPct)),quantumMedianMs:median(rows.map(r=>r.quantumMs)),glpkMedianMs:median(rows.map(r=>r.glpkMs)),quantumP95Ms:p95(rows.map(r=>r.quantumMs)),glpkP95Ms:p95(rows.map(r=>r.glpkMs)),meanMetrics};
const gates={allFeasible:rows.every(r=>r.feasible),objectiveNoWorseEveryCase:rows.every(r=>r.objectiveGapPct<=1e-6),medianFaster:summary.quantumMedianMs<summary.glpkMedianMs,p95Faster:summary.quantumP95Ms<summary.glpkP95Ms,
 carbonLower:meanMetrics.carbon.quantum<meanMetrics.carbon.glpk,
 operatingLower:meanMetrics.operating.quantum<meanMetrics.operating.glpk,
 latencyLower:meanMetrics.latency.quantum<meanMetrics.latency.glpk,
 riskLower:meanMetrics.risk.quantum<meanMetrics.risk.glpk,
 apyHigher:meanMetrics.apy.quantum>meanMetrics.apy.glpk};
const passed=Object.values(gates).every(Boolean);
writeFileSync(reportPath,JSON.stringify({passed,glpkTested:true,summary,gates,rows},null,2));
console.log(JSON.stringify({passed,summary,gates},null,2));
if(!passed)process.exitCode=1;
