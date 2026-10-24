import {performance} from 'node:perf_hooks';
import {optimize,classicalUniform} from './challenger.mjs';
function rng(seed){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
function pct(a,p){const q=[...a].sort((x,y)=>x-y);return q[Math.min(q.length-1,Math.floor(p*(q.length-1)))];}
const cases=[];
for(let id=0;id<48;id++){
 const r=rng(id+12789),n=20;
 const carbon=Array.from({length:n},()=>.10+r()*.65),operating=Array.from({length:n},()=>.06+r()*.45),latency=Array.from({length:n},()=>.03+r()*.2),risk=Array.from({length:n},()=>r()*.20),apy=Array.from({length:n},()=>.015+r()*.11);
 const caps=Array.from({length:n},()=>.055+r()*.085),preferred=Array(n).fill(.05),regularization=.025+r()*.07;
 const costs=carbon.map((c,i)=>.42*c+.32*operating[i]+.18*latency[i]+.08*risk[i]-.08*apy[i]);
 const input={costs,caps,preferred,regularization},features={carbon,operating,latency,risk,apy};
 for(let j=0;j<2;j++)optimize(input,{variant:'phase-walk',seed:id+1});
 const times=[],randomTimes=[];let result;
 for(let j=0;j<7;j++){let t=performance.now();result=optimize(input,{variant:'phase-walk',seed:id+1});times.push(performance.now()-t);
  t=performance.now();classicalUniform(input,{seed:id+1});randomTimes.push(performance.now()-t);
 }
 const control=optimize(input,{variant:'grover-only',seed:id+1});
 const random=classicalUniform(input,{seed:id+1});
 const metric=w=>Object.fromEntries(Object.entries(features).map(([key,values])=>[key,w.reduce((s,x,i)=>s+x*values[i],0)]));
 cases.push({id,input,features,quantum:{objective:result.objective,weights:result.weights,metrics:metric(result.weights),medianRuntimeMs:pct(times,.5),p95RuntimeMs:pct(times,.95),norms:result.batches.map(b=>b.norm),feasible:result.feasible},groverOnly:{objective:control.objective},classicalUniform:{objective:random.objective,weights:random.weights,medianRuntimeMs:pct(randomTimes,.5)}});
}
console.log(JSON.stringify({title:'V144 gated quantum challenger (research only)',variant:'phase-walk',cases}));
