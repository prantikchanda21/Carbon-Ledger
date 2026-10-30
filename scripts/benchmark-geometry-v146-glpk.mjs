/** Real GLPK.js measurement runner. Requires npm install and the actual glpk.js package.
 * Does not substitute HiGHS or any home-grown solver. From the project root:
 *   npm ci && node scripts/benchmark-geometry-v146-glpk.mjs
 */
import {performance} from 'node:perf_hooks';
import {readFileSync,writeFileSync} from 'node:fs';
import {geometryQuantumAllocation} from '../lib/geometryQuantum.ts';
import {quadQuantumAllocation} from '../lib/quadQuantum.ts';
const resultPath='V146-DIRECT-GLPK-RESULTS.json';
let pkg;
try{pkg=await import('glpk.js');}
catch(error){writeFileSync(resultPath,JSON.stringify({glpkExecuted:false,reason:'glpk.js not installed. Run npm ci and rerun this script.',error:String(error)},null,2));console.error('GLPK unavailable: do not present SciPy HiGHS as GLPK.');process.exit(2);}
const factory=pkg.default?.default??pkg.default??pkg,glpk=await factory();
const cases=JSON.parse(readFileSync('research/benchmarks/archived/V146-HOLDOUT-QUANTUM-RAW.json'));
const mean=a=>a.reduce((s,v)=>s+v,0)/a.length;
const percentile=(a,p)=>{const sorted=[...a].sort((x,y)=>x-y);return sorted[Math.ceil(p*sorted.length)-1];};
const metric=(w,features)=>({carbon:meanProduct(w,features.carbon),operatingCost:meanProduct(w,features.operating),latency:meanProduct(w,features.latency),risk:meanProduct(w,features.risk),treasuryApy:meanProduct(w,features.apy)});
const meanProduct=(w,v)=>w.reduce((a,x,i)=>a+x*v[i],0);
const rows=[];
for(const row of cases){
 const inp=row.input,n=inp.costs.length,names=Array.from({length:n},(_,i)=>`w${i}`),devs=Array.from({length:n},(_,i)=>`d${i}`);
 const model={name:'v146-identical-constraints',objective:{direction:glpk.GLP_MIN,name:'combined-objective',vars:[...names.map((name,i)=>({name,coef:inp.costs[i]})),...devs.map(name=>({name,coef:inp.regularization}))]},subjectTo:[
  {name:'allocation-sum',vars:names.map(name=>({name,coef:1})),bnds:{type:glpk.GLP_FX,lb:1,ub:1}},
  ...names.flatMap((name,i)=>[
   {name:`dev-plus-${i}`,vars:[{name,coef:1},{name:devs[i],coef:-1}],bnds:{type:glpk.GLP_UP,ub:inp.preferred[i],lb:0}},
   {name:`dev-minus-${i}`,vars:[{name,coef:-1},{name:devs[i],coef:-1}],bnds:{type:glpk.GLP_UP,ub:-inp.preferred[i],lb:0}}])],
  bounds:[...names.map((name,i)=>({name,type:inp.caps[i]?glpk.GLP_DB:glpk.GLP_FX,lb:0,ub:inp.caps[i]})),...devs.map(name=>({name,type:glpk.GLP_LO,lb:0,ub:0}))]};
 const gTimes=[],eTimes=[];let glpkSolution,ensemble;
 for(let attempt=0;attempt<5;attempt++){
  let t=performance.now();glpkSolution=glpk.solve(model,{msglev:glpk.GLP_MSG_OFF});gTimes.push(performance.now()-t);
  t=performance.now();ensemble=await geometryQuantumAllocation(inp,'geometry');eTimes.push(performance.now()-t);
 }
 if(glpkSolution.result.status!==glpk.GLP_OPT)throw Error(`GLPK solution not proven optimal: case ${row.caseId}`);
 const gw=names.map(n=>glpkSolution.result.vars[n]);
 const gCost=meanProduct(gw,inp.costs)+inp.regularization*gw.reduce((s,w,i)=>s+Math.abs(w-inp.preferred[i]),0);
 if(Math.abs(gCost-glpkSolution.result.z)>1e-6)throw Error('GLPK formulation mismatch');
 const gapPct=100*(ensemble.objective-gCost)/Math.max(Math.abs(gCost),1e-12);
 rows.push({caseId:row.caseId,objectiveGapPct:gapPct,glpkObjective:gCost,ensembleObjective:ensemble.objective,glpkWeights:gw,ensembleWeights:ensemble.weights,glpkMetrics:metric(gw,row.features),ensembleMetrics:metric(ensemble.weights,row.features),glpkMedianMs:percentile(gTimes,.5),ensembleMedianMs:percentile(eTimes,.5),glpkP95Ms:percentile(gTimes,.95),ensembleP95Ms:percentile(eTimes,.95),feasible:ensemble.feasible});
}
const summary={glpkExecuted:true,scenarios:rows.length,meanGapPct:mean(rows.map(r=>r.objectiveGapPct)),worstGapPct:Math.max(...rows.map(r=>r.objectiveGapPct)),allFeasible:rows.every(r=>r.feasible),medianEngineMs:percentile(rows.map(r=>r.ensembleMedianMs),.5),medianGlpkMs:percentile(rows.map(r=>r.glpkMedianMs),.5),p95EngineMs:percentile(rows.map(r=>r.ensembleMedianMs),.95),p95GlpkMs:percentile(rows.map(r=>r.glpkMedianMs),.95),metrics:Object.fromEntries(['carbon','operatingCost','latency','risk','treasuryApy'].map(k=>[k,{ensemble:mean(rows.map(r=>r.ensembleMetrics[k])),glpk:mean(rows.map(r=>r.glpkMetrics[k]))}]))};
writeFileSync(resultPath,JSON.stringify({summary,rows},null,2));
console.log(JSON.stringify(summary,null,2));
