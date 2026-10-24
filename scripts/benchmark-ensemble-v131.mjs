import {quadQuantumAllocation} from '../lib/quadQuantum.ts';
import {writeFileSync,mkdirSync} from 'node:fs';
import os from 'node:os';
const samples=[];let seed=9173;
const rand=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/4294967296;};
for(let scenario=0;scenario<50;scenario++){
 const n=20,costs=Array.from({length:n},()=>.1+rand()*2),caps=Array.from({length:n},()=>.06+rand()*.13),preferred=Array.from({length:n},()=>rand()*.1),regularization=.01+rand()*.3;
 for(let repeat=0;repeat<3;repeat++){
  const start=performance.now();const r=await quadQuantumAllocation({costs,caps,preferred,regularization});
  samples.push({scenario,repeat,ms:performance.now()-start,objective:r.objective,feasible:r.feasible,analytic:r.classicalCandidateUsed===true,batchAnalytic:r.batches.map(b=>b.classicalCandidateUsed),quantumSelected:r.quantumWon});
 }
}
const timed=samples.slice(4).map(s=>s.ms).sort((a,b)=>a-b);const percentile=p=>timed[Math.min(timed.length-1,Math.floor((timed.length-1)*p))];
const report={generated:new Date().toISOString(),node:process.version,cpu:os.cpus()[0]?.model,scenarios:50,repeats:3,coldFirstMs:samples[0].ms,warm:{n:timed.length,medianMs:percentile(.5),p95Ms:percentile(.95),p99Ms:percentile(.99),below15Ms:timed.filter(v=>v<15).length},feasible:samples.filter(s=>s.feasible).length,analyticSelected:samples.filter(s=>s.analytic).length,quantumSelected:samples.filter(s=>s.quantumSelected).length,limits:'CPU local code path, excludes request handling, network, React updates and deployment cold start. Quality from classical convex candidate, not demonstrated quantum advantage.',samples};
mkdirSync('artifacts/v131-benchmark',{recursive:true});writeFileSync('artifacts/v131-benchmark/results.json',JSON.stringify(report,null,2));console.log(JSON.stringify({...report,samples:undefined},null,2));
