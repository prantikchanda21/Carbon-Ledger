import {performance} from 'node:perf_hooks';
import {readFileSync,writeFileSync} from 'node:fs';
import {geometryQuantumAllocation} from '../lib/geometryQuantum.ts';
const cases=JSON.parse(readFileSync('research/benchmarks/archived/V146-HOLDOUT-QUANTUM-RAW.json'));
const results={};
for(const variant of ['geometry','xy','grover']){
 await geometryQuantumAllocation(cases[0].input,variant); // warm-up; excluded
 const times=[];
 for(const c of cases){const t=performance.now();await geometryQuantumAllocation(c.input,variant);times.push(performance.now()-t);}
 const sorted=[...times].sort((a,b)=>a-b);
 results[variant]={count:times.length,medianMs:(sorted[15]+sorted[16])/2,p95Ms:sorted[30],minimumMs:sorted[0],maximumMs:sorted.at(-1),times};
}
writeFileSync('V146-ISOLATED-WARM-LATENCY.json',JSON.stringify(results,null,2));
console.log(JSON.stringify(Object.fromEntries(Object.entries(results).map(([k,v])=>[k,{medianMs:v.medianMs,p95Ms:v.p95Ms,maxMs:v.maximumMs}])),null,2));
