import {performance} from 'node:perf_hooks';
import {quantumOracleAllocation} from '../lib/quantumOracleEngine.ts';
function rng(seed){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}}
const out=[];
for(let caseId=0;caseId<32;caseId++){
 const r=rng(caseId+12789),carbon=Array.from({length:20},()=>.10+r()*.65),operating=Array.from({length:20},()=>.06+r()*.45),latency=Array.from({length:20},()=>.03+r()*.2),risk=Array.from({length:20},()=>r()*.20),apy=Array.from({length:20},()=>.015+r()*.11);
 const caps=Array.from({length:20},()=>.055+r()*.085),preferred=Array(20).fill(.05),regularization=.025+r()*.07;
 const costs=carbon.map((c,i)=>.42*c+.32*operating[i]+.18*latency[i]+.08*risk[i]-.08*apy[i]);
 const input={costs,caps,preferred,regularization};
 for(let warm=0;warm<2;warm++)quantumOracleAllocation(input);
 const t=performance.now(),a=quantumOracleAllocation(input),ms=performance.now()-t;
 const metrics=w=>({carbon:w.reduce((s,x,i)=>s+x*carbon[i],0),operatingCost:w.reduce((s,x,i)=>s+x*operating[i],0),latency:w.reduce((s,x,i)=>s+x*latency[i],0),risk:w.reduce((s,x,i)=>s+x*risk[i],0),treasuryApy:w.reduce((s,x,i)=>s+x*apy[i],0)});
 out.push({caseId,input,features:{carbon,operating,latency,risk,apy},oracle:{objective:a.objective,weights:a.weights,metrics:metrics(a.weights),ms,feasible:a.feasible,basis:a.basis,probability:a.probability,norms:a.batches.map(b=>b.norm)}});
}
console.log(JSON.stringify(out));
