import {workloadBenchmark,type QaoaOptions} from '../lib/lab/workloadQuantum';
import {compare,fingerprint} from '../lib/lab/engine';
import {inspectWorkloadQubo} from '../lib/lab/qubo';
import type {LabInput} from '../lib/lab/types';
self.onmessage=(event:MessageEvent<{input:LabInput;options:Partial<QaoaOptions>;repeats:number;adaptive:boolean}>)=>{
 try{const {input,options,repeats,adaptive}=event.data;const started=performance.now();const runs=[];const baseline=[];
 for(let i=0;i<repeats;i++){
  const opts={...options,seed:input.seed+i,restarts:1};
  baseline.push(workloadBenchmark(input,{...opts,warmStart:false,cvarAlpha:1,feasibleMixer:false,transfer:undefined}));
  let best=workloadBenchmark(input,{...opts,depth:adaptive?1:options.depth});
  if(adaptive)for(let depth=2;depth<=(options.depth??3);depth++){const candidate=workloadBenchmark(input,{...opts,depth});if(candidate.research.bestEnergy<best.research.bestEnergy-1e-6)best=candidate;else break;}
  runs.push(best);self.postMessage({progress:(i+1)/repeats});
 }
 self.postMessage({result:{id:`run-${Date.now()}-${fingerprint(input)}`,at:new Date().toISOString(),input,options,repeats,adaptive,runs,baseline,comparison:compare(input),qubo:inspectWorkloadQubo(input,Math.min(options.maxQubits??8,input.jobs.length)),wallMs:performance.now()-started,datasetVersion:'seeded-168h-v5',inputHash:fingerprint(input)}});
 }catch(e){self.postMessage({error:e instanceof Error?e.message:'Experiment failed'});}
};
