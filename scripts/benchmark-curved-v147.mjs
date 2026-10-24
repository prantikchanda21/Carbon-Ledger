import {readFileSync,writeFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {geometryQuantumAllocation} from '../lib/geometryQuantum.ts';
import {quadQuantumAllocation} from '../lib/quadQuantum.ts';
const root=process.cwd();
const training=JSON.parse(readFileSync('research/benchmarks/archived/V146-EXACT-LP-COMPARISON.json','utf8')).cases;
const holdout=JSON.parse(readFileSync('research/benchmarks/archived/V146-HOLDOUT-EXACT-LP-COMPARISON.json','utf8')).cases;
function rng(seed){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}}
function newCase(i){const r=rng(823417+i); const carbon=Array.from({length:20},()=>.10+r()*.65),operating=Array.from({length:20},()=>.06+r()*.45),latency=Array.from({length:20},()=>.03+r()*.2),risk=Array.from({length:20},()=>r()*.20),apy=Array.from({length:20},()=>.015+r()*.11),caps=Array.from({length:20},()=>.055+r()*.085),preferred=Array(20).fill(.05),regularization=.025+r()*.07;
const costs=carbon.map((c,i)=>.42*c+.32*operating[i]+.18*latency[i]+.08*risk[i]-.08*apy[i]);return {caseId:i,input:{costs,caps,preferred,regularization},features:{carbon,operating,latency,risk,apy}};}
const fresh=Array.from({length:48},(_,i)=>newCase(i));
const prospective=Array.from({length:48},(_,i)=>newCase(i+500000));
const modes=['geometry','grover','curved','fusion','quad'];const rows=[];
for(const [set,cases] of [['train',training],['holdout',holdout],['unseen',fresh],['prospective',prospective]]){
 for(const [j,row] of cases.entries()){
  const res={set,id:j,input:row.input,features:row.features,lpObjective:row.lpReference?.objective,engines:{}};
  // Alternate order to avoid persistent warmed-worker ordering bias
  const order=[...modes.slice(j%modes.length),...modes.slice(0,j%modes.length)];
  for(const mode of order){const t=performance.now(),v=mode==='quad'?await quadQuantumAllocation(row.input):await geometryQuantumAllocation(row.input,mode);
   const ms=performance.now()-t;
   const dot=(feature)=>v.weights.reduce((s,w,i)=>s+w*res.features[feature][i],0);
   res.engines[mode]={objective:v.objective,weights:v.weights,ms,feasible:v.feasible,metrics:{carbon:dot('carbon'),operatingCost:dot('operating'),latency:dot('latency'),risk:dot('risk'),treasuryApy:dot('apy')},samplingGapPct:mode==='quad'?null:Math.min(...(v.allBatches??v.batches).map(b=>b.samplingGapPct)),candidatePoolBest:mode==='quad'?null:Math.min(...(v.allBatches??v.batches).map(b=>b.candidateBest)),uniformSampleObjective:mode==='quad'?null:Math.min(...(v.allBatches??v.batches).map(b=>b.uniformObjective))};
  }
  rows.push(res);
 }
 console.log('Completed',set,cases.length,'scenarios');
}
writeFileSync('V147-QUANTUM-BENCHMARK-RAW.json',JSON.stringify(rows,null,2));
