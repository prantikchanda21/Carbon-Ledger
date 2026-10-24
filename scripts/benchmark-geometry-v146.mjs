/** Same synthetic 20-region scenario generator as v145. Rerun on Node 22. */
import {performance} from 'node:perf_hooks';
import {writeFileSync} from 'node:fs';
import {geometryQuantumAllocation} from '../lib/geometryQuantum.ts';
import {quadQuantumAllocation} from '../lib/quadQuantum.ts';
function rng(seed){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}}
const metrics=(w,f)=>({carbon:sum(w,f.carbon),operatingCost:sum(w,f.operating),latency:sum(w,f.latency),risk:sum(w,f.risk),treasuryApy:sum(w,f.apy)});
function sum(a,b){return a.reduce((s,x,i)=>s+x*b[i],0);}
const count=Number(process.argv[2]??32),seedOffset=Number(process.argv[3]??12789),label=process.argv[4]??'V146';
const rows=[];
for(let caseId=0;caseId<count;caseId++){
 const r=rng(caseId+seedOffset),carbon=Array.from({length:20},()=>.10+r()*.65),operating=Array.from({length:20},()=>.06+r()*.45),latency=Array.from({length:20},()=>.03+r()*.2),risk=Array.from({length:20},()=>r()*.20),apy=Array.from({length:20},()=>.015+r()*.11);
 const caps=Array.from({length:20},()=>.055+r()*.085),preferred=Array(20).fill(.05),regularization=.025+r()*.07;
 const costs=carbon.map((c,i)=>.42*c+.32*operating[i]+.18*latency[i]+.08*risk[i]-.08*apy[i]);
 const input={costs,caps,preferred,regularization},features={carbon,operating,latency,risk,apy};
 const engines={};
 for(const mode of ['geometry','xy','grover','quad']){
  const t=performance.now(),res=mode==='quad'?await quadQuantumAllocation(input):await geometryQuantumAllocation(input,mode);
  engines[mode]={weights:res.weights,objective:res.objective,metrics:metrics(res.weights,features),ms:performance.now()-t,feasible:res.feasible,
   batchMs:res.batches.map(b=>b.durationMs),norms:res.batches.map(b=>b.norm),batches:mode==='quad'?undefined:res.batches.map(b=>({selectedBasis:b.selectedBasis,shots:b.shots,trace:b.trace}))};
 }
 rows.push({caseId,input,features,engines});
}
writeFileSync(`${label}-QUANTUM-RAW.json`,JSON.stringify(rows,null,2));
const mean=a=>a.reduce((s,v)=>s+v,0)/a.length;
const sorted=a=>[...a].sort((x,y)=>x-y);
const summary=Object.fromEntries(['geometry','xy','grover','quad'].map(mode=>{
 const values=rows.map(x=>x.engines[mode]),times=sorted(values.map(x=>x.ms));
 return [mode,{meanObjective:mean(values.map(x=>x.objective)),medianMs:times[15],p95Ms:times[30],meanMs:mean(times),feasible:values.filter(x=>x.feasible).length,
 meanMetrics:Object.fromEntries(['carbon','operatingCost','latency','risk','treasuryApy'].map(k=>[k,mean(values.map(x=>x.metrics[k]))]))}];
}));
writeFileSync(`${label}-ENGINE-SUMMARY.json`,JSON.stringify(summary,null,2));
console.log(JSON.stringify(summary,null,2));
