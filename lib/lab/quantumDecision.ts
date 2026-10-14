import type {LabInput, Choice, Comparison, Schedule} from './types';
import type {WorkloadBenchmark} from './workloadQuantum';
import {compare} from './engine';

/** Quantum candidates are proposals; every combined schedule must pass global checks. */
export function quantumDecision(input:LabInput, result:WorkloadBenchmark, algorithm:'qaoa'|'quantumAnnealing'):{comparison:Comparison;accepted:boolean;reason:string}{
  const fallback=compare(input);
  const candidate=algorithm==='qaoa'?result.qaoa:result.quantumAnnealing;
  if(candidate.mask===null || candidate.cost===null) return {comparison:fallback,accepted:false,reason:'No feasible quantum sample; classical safeguard used'};
  const replacement=new Map<string, Choice>();
  for(let i=0;i<result.candidates.length;i++){
    const pair=result.candidates[i];
    replacement.set(pair.job,(candidate.mask&(1<<i))?pair.optimized:pair.baseline);
  }
  const choices=fallback.optimized.choices.map(c=>replacement.get(c.job)??c);
  const scheduled=new Map(choices.map(c=>[c.job,c]));
  const occupancy=new Map<string,{cpu:number;gpu:number}>();
  for(const c of choices){
    const job=input.jobs.find(j=>j.id===c.job);
    if(!job || c.start<job.earliest || c.finish>job.deadline || c.finish>input.horizon ||
       ((job.indiaOnly||input.controls.dpdp_locked)&&!['mumbai','hyderabad','delhi'].includes(c.region)))
       return {comparison:fallback,accepted:false,reason:'Quantum candidate failed job constraints; classical safeguard used'};
    for(const dep of job.dependencies){const d=scheduled.get(dep);if(!d||d.finish>c.start)return {comparison:fallback,accepted:false,reason:'Quantum candidate conflicts with dependencies; classical safeguard used'};}
    for(let h=c.start;h<c.finish;h++){
      const key=`${c.region}:${h}`;const old=occupancy.get(key)??{cpu:0,gpu:0};
      const next={cpu:old.cpu+job.cpu,gpu:old.gpu+job.gpu};
      const cap=input.capacity[c.region];
      if(next.cpu>cap.cpu||next.gpu>cap.gpu)return {comparison:fallback,accepted:false,reason:'Quantum candidate exceeds shared capacity; classical safeguard used'};
      occupancy.set(key,next);
    }
  }
  // Keep the classical schedule whenever the quantum candidate is more expensive or schedules fewer jobs.
  const totalUsd=choices.reduce((v,c)=>v+c.totalUsd,0);
  if(totalUsd>fallback.optimized.totalUsd+1e-8)return {comparison:fallback,accepted:false,reason:'Quantum result was costlier; classical safeguard used'};
  const optimized:Schedule={...fallback.optimized,choices,totalUsd,
    carbonKg:choices.reduce((v,c)=>v+c.carbonKg+c.transferKg,0),
    migrationUsd:choices.reduce((v,c)=>v+c.transferUsd+c.downtimeUsd,0),
    energyKwh:choices.reduce((v,c)=>v+(input.jobs.find(j=>j.id===c.job)?.kwh??0)+c.migrationKwh,0)};
  return {accepted:true,reason:`Verified ${algorithm==='qaoa'?'QAOA':'digitized quantum annealing'} proposal for ${replacement.size} decision(s); other jobs retained their classical placement`,comparison:{...fallback,optimized,savingsUsd:fallback.baseline.totalUsd-totalUsd,avoidedKg:fallback.baseline.carbonKg-optimized.carbonKg}};
}
