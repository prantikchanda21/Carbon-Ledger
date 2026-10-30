import {performance} from 'node:perf_hooks';
import {quantumOracleAllocation} from '../lib/quantumOracleEngine.ts';
const SIZE=128;
function hash(a){a^=a>>>16;a=Math.imul(a,0x7feb352d);a^=a>>>15;a=Math.imul(a,0x846ca68b);return (a^(a>>>16))>>>0;}
function rng(seed){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
// Exact v142 candidate-generation logic, reproduced without importing internals.
function candidate(mask,batch,costs,caps,preferred,lambda){
 const n=costs.length,weights=Array(n).fill(0),level=mask%16,strength=[0,.35,.7,1][batch],drift=level/15;
 const prices=costs.map((c,i)=>({i,price:c-lambda*(.25+.75*strength)+.004*(hash((mask+1)*61+i*181+batch*41)/4294967296-.5)*(1-drift)}));
 prices.sort((a,b)=>a.price-b.price);let remaining=1;
 const retain=[0,.4,.75,1][batch]*((mask>>4)/7);
 for(let i=0;i<n;i++){const take=Math.min(caps[i],Math.max(0,preferred[i])*retain);weights[i]=take;remaining-=take;}
 if(remaining<0){const total=weights.reduce((s,w)=>s+w,0);for(let i=0;i<n;i++)weights[i]/=total;return weights;}
 for(const {i} of prices){if(remaining<=1e-12)break;const add=Math.min(remaining,caps[i]-weights[i]);weights[i]+=add;remaining-=add;}
 if(remaining>1e-8)throw Error('Invalid capacity');return weights;
}
function stats(values){const sorted=[...values].sort((a,b)=>a-b),mean=values.reduce((a,b)=>a+b,0)/values.length;return {mean,median:sorted[Math.floor(sorted.length/2)],p95:sorted[Math.min(sorted.length-1,Math.ceil(.95*sorted.length)-1)],min:sorted[0],max:sorted.at(-1)};}
const records=[];
for(let caseId=0;caseId<32;caseId++){
 const r=rng(caseId+12789),carbon=Array.from({length:20},()=>.10+r()*.65),operating=Array.from({length:20},()=>.06+r()*.45),latency=Array.from({length:20},()=>.03+r()*.2),risk=Array.from({length:20},()=>r()*.20),apy=Array.from({length:20},()=>.015+r()*.11);
 const caps=Array.from({length:20},()=>.055+r()*.085),preferred=Array(20).fill(.05),regularization=.025+r()*.07;
 const costs=carbon.map((c,i)=>.42*c+.32*operating[i]+.18*latency[i]+.08*risk[i]-.08*apy[i]);const input={costs,caps,preferred,regularization};
 const objective=w=>w.reduce((s,x,i)=>s+x*costs[i]+regularization*Math.abs(x-preferred[i]),0);
 const tprep=performance.now(); const energies=[],weights=[];
 for(let b=0;b<4;b++){energies[b]=[];weights[b]=[];for(let k=0;k<SIZE;k++){const w=candidate(k,b,costs,caps,preferred,regularization);weights[b].push(w);energies[b].push(objective(w));}}
 const prepMs=performance.now()-tprep;
 const all=energies.flat();const oracleBest=Math.min(...all);
 // Identical *measurement count* (128) with identical candidate pool.
 const randomTrials=Array.from({length:100},(_,rep)=>{
   const t=performance.now();const rand=rng(hash(0x1982 + caseId*7919 + rep*101));let best=Infinity;
   for(let i=0;i<128;i++){const b=Math.floor(rand()*4),k=Math.floor(rand()*SIZE);best=Math.min(best,energies[b][k]);}
   return {objective:best,ms:performance.now()-t};
 });
 for(let i=0;i<2;i++)quantumOracleAllocation(input);
 const tq=performance.now(), quantum=quantumOracleAllocation(input),quantumMs=performance.now()-tq;
 const classicalMean=randomTrials.reduce((s,v)=>s+v.objective,0)/randomTrials.length;
 const classicalWins=randomTrials.filter(x=>x.objective<quantum.objective-1e-12).length;
 records.push({caseId,quantumObjective:quantum.objective,quantumMs,oracleBest,randomObjectiveMean:classicalMean,randomWinRate:classicalWins/100,randomMsMean:randomTrials.reduce((s,x)=>s+x.ms,0)/100,prepMs,quantumFeasible:quantum.feasible,quantumBasis:quantum.basis,quantumBatch:quantum.batch,advantageOverRandomPct:100*(classicalMean-quantum.objective)/classicalMean,quantumGapToPoolBestPct:100*(quantum.objective-oracleBest)/oracleBest,randomGapToPoolBestPct:100*(classicalMean-oracleBest)/oracleBest});
}
const fields=['quantumMs','randomMsMean','prepMs','advantageOverRandomPct','quantumGapToPoolBestPct','randomGapToPoolBestPct','randomWinRate'];const summary=Object.fromEntries(fields.map(field=>[field,stats(records.map(r=>r[field]))]));
summary.quantumBetterThanMeanRandom=records.filter(r=>r.advantageOverRandomPct>1e-9).length;summary.quantumWorseThanMeanRandom=records.filter(r=>r.advantageOverRandomPct< -1e-9).length;summary.quantumTie=32-summary.quantumBetterThanMeanRandom-summary.quantumWorseThanMeanRandom;
console.log(JSON.stringify({method:'v142 Grover versus 128 uniform samples from identical 4*128 pool; 100 seeded random replications per case; same candidate preparation shared; classical timing excludes preparation',summary,records},null,2));
