import type { LabInput, Choice } from './types';
import { compare } from './engine.ts';
import type { RegionId } from '../types';
import { fitBinaryQubo } from './quboMath.ts';

/** Small, browser-safe QAOA statevector benchmark over binary workload placement choices.
 * No quantum hardware is used. The exact solver enumerates the identical search space. */
export interface QaoaOptions { depth:number; iterations:number; gamma:number; beta:number; optimize:boolean; sweep:boolean; optimizer?:'coordinate'|'spsa'; restarts?:number; seed?:number; maxQubits?:number; memoryGb?:number; annealSteps?:number; annealTime?:number; warmStart?:boolean; cvarAlpha?:number; feasibleMixer?:boolean; transfer?:{gamma:number[];beta:number[]} }
export interface QaoaPoint { iteration:number; energy:number; feasibleProbability:number; optimalProbability:number }
export interface QaoaDepthPoint { depth:number; gap:number; feasibleProbability:number; optimalProbability:number; runtimeMs:number }
export interface WorkloadBenchmark {
  jobs: string[]; candidates: {job:string; baseline:Choice; optimized:Choice}[];
  configurations:number; feasibleConfigurations:number; exact:{cost:number;mask:number};
  greedy:{cost:number;mask:number;feasible:boolean};
  localSearch:{cost:number;mask:number;feasible:boolean};
  simulatedAnnealing:{cost:number;mask:number;feasible:boolean;runtimeMs:number};
  quantumAnnealing:{cost:number|null;mask:number|null;feasibleProbability:number;optimalProbability:number;expectedCost:number;runtimeMs:number;steps:number;totalTime:number};
  qaoa:{cost:number|null;mask:number|null;feasibleProbability:number;optimalProbability:number;expectedCost:number;depth:number;gamma:number[];beta:number[]};
  excluded:string[]; objective:'total modeled USD including carbon and migration';
  distribution:{mask:number;bits:string;cost:number;probability:number;feasible:boolean}[];
  convergence:QaoaPoint[]; depthSweep:QaoaDepthPoint[]; runtimeMs:{exact:number;greedy:number;localSearch:number;qaoa:number};
  research:{optimizer:string;seed:number;restarts:number;restartEnergies:number[];bestEnergy:number;meanEnergy:number;stdEnergy:number;approximationRatio:number|null; objectiveStates:number};
}

/** Identical binary placement objective used by the local solver and remote CPU/GPU service. */
export function prepareWorkloadObjective(input:LabInput, requestedQubits=8){
  const nLimit=Math.max(1,Math.min(12,Math.floor(requestedQubits)||8));
  const cmp=compare(input);
  const original=new Map(cmp.baseline.choices.map(c=>[c.job,c]));
  const improved=new Map(cmp.optimized.choices.map(c=>[c.job,c]));
  const pairs=input.jobs.filter(j=>original.has(j.id)&&improved.has(j.id)).slice(0,nLimit)
    .map(j=>({job:j.id,baseline:original.get(j.id)!,optimized:improved.get(j.id)!}));
  if(!pairs.length)throw new Error('No jointly schedulable jobs. Adjust capacity or deadlines first.');
  const jobs=pairs.map(p=>p.job), n=jobs.length, count=1<<n;
  const picked=(mask:number,i:number)=>mask&(1<<i)?pairs[i].optimized:pairs[i].baseline;
  const feasible=(mask:number)=>{
    const occupied=new Map<string,{cpu:number;gpu:number}>();
    for(const fixed of cmp.optimized.choices.filter(c=>!jobs.includes(c.job))){
      const job=input.jobs.find(j=>j.id===fixed.job)!;
      for(let t=fixed.start;t<fixed.finish;t++){
        const key=`${fixed.region}:${t}`,used=occupied.get(key)??{cpu:0,gpu:0};
        used.cpu+=job.cpu;used.gpu+=job.gpu;occupied.set(key,used);
      }
    }
    for(let i=0;i<n;i++){
      const c=picked(mask,i),j=input.jobs.find(x=>x.id===c.job)!;
      if(c.start<j.earliest||c.finish>j.deadline||c.finish>input.horizon)return false;
      if((j.indiaOnly||input.controls.dpdp_locked)&&!['mumbai','hyderabad','delhi'].includes(c.region))return false;
      for(let t=c.start;t<c.finish;t++){
        const key=`${c.region}:${t}`,o=occupied.get(key)||{cpu:0,gpu:0};
        o.cpu+=j.cpu;o.gpu+=j.gpu;
        const cap=input.capacity[c.region as RegionId];
        if(o.cpu>cap.cpu||o.gpu>cap.gpu)return false;
        occupied.set(key,o);
      }
    }
    for(let i=0;i<n;i++){
      const j=input.jobs.find(x=>x.id===jobs[i])!,c=picked(mask,i);
      for(const dep of j.dependencies){const index=jobs.indexOf(dep);
        if(index>=0 && picked(mask,index).finish>c.start)return false;
        // Jobs outside the selected subset are held at their existing optimized schedule.
        if(index<0){const fixed=improved.get(dep);if(fixed&&fixed.finish>c.start)return false;}
      }
    }
    for(const fixed of cmp.optimized.choices.filter(c=>!jobs.includes(c.job))){
      const j=input.jobs.find(x=>x.id===fixed.job)!;
      for(const dep of j.dependencies){const index=jobs.indexOf(dep);if(index>=0&&picked(mask,index).finish>fixed.start)return false;}
    }
    return true;
  };
  const costs=Array.from({length:count},(_,m)=>pairs.reduce((s,p,i)=>s+((m&(1<<i))?p.optimized.totalUsd:p.baseline.totalUsd),0));
  const valid=costs.map((_,m)=>feasible(m));
  const lower=Math.min(...costs),span=Math.max(1,Math.max(...costs)-lower);
  const originalEnergy=costs.map((cost,i)=>(cost-lower)/span+(valid[i]?0:4));
  const qubo=fitBinaryQubo(originalEnergy,n);
  // Use the explicit QUBO evaluation only when quadratic equivalence is proven.
  const energies=qubo.exact?qubo.values:originalEnergy;

  return {jobs, pairs, costs, valid, energies, quboExact:qubo.exact, excluded:input.jobs.filter(j=>!jobs.includes(j.id)).map(j=>j.id)};
}
export function workloadBenchmark(input:LabInput, options:Partial<QaoaOptions>={}):WorkloadBenchmark {
  const depth=Math.max(1,Math.min(8,Math.floor(options.depth??2)));
  const iterations=Math.max(0,Math.min(120,Math.floor(options.iterations??20)));
  const restarts=Math.max(1,Math.min(8,Math.floor(options.restarts??3)));
  const seed=(Number.isFinite(options.seed)?Math.floor(options.seed!):20261013)>>>0;
  const optimizer=options.optimizer==='spsa'?'spsa':'coordinate';
  let rngState=seed||1;
  const random=()=>{rngState^=rngState<<13;rngState^=rngState>>>17;rngState^=rngState<<5;return (rngState>>>0)/4294967296;};
  const initialGamma=Number.isFinite(options.gamma)?options.gamma!:0.8;
  const initialBeta=Number.isFinite(options.beta)?options.beta!:0.45;
  const requested=Math.max(1,Math.min(12,Math.floor(options.maxQubits??8)));
  const memoryGb=Math.max(1,Math.min(32,Number(options.memoryGb??8)));
  const estimatedBytes=2**requested*128; // multiple statevector and objective buffers
  if(estimatedBytes>memoryGb*1024**3*0.25)throw new Error("Configured statevector would exceed the execution memory budget.");
  const {jobs,pairs,costs,valid,energies:sharedEnergies}=prepareWorkloadObjective(input,requested);
  const startClock=performance.now();
  const n=jobs.length,count=costs.length;
  const feasible=(mask:number)=>Boolean(valid[mask]);
  const feasibleMasks=costs.map((_,m)=>m).filter(m=>valid[m]);
  if(!feasibleMasks.length)throw new Error('No feasible baseline/optimized combinations for these jobs.');
  feasibleMasks.sort((a,b)=>costs[a]-costs[b]||a-b);
  const best=feasibleMasks[0];
  const exactMs=performance.now()-startClock;
  const greedyStart=performance.now();
  let greedy=0;
  for(let i=0;i<n;i++)if(pairs[i].optimized.totalUsd<pairs[i].baseline.totalUsd && feasible(greedy|(1<<i)))greedy|=1<<i;
  if(!valid[greedy])greedy=best;
  const greedyMs=performance.now()-greedyStart;
  const localStart=performance.now();
  // First-improvement 1-bit neighborhood search from the feasible classical heuristic.
  let localMask=greedy;
  let progressed=true;
  while(progressed){
    progressed=false;
    for(let bit=0;bit<n;bit++){
      const candidate=localMask^(1<<bit);
      if(valid[candidate]&&costs[candidate]<costs[localMask]-1e-10){localMask=candidate;progressed=true;break;}
    }
  }
  const localMs=performance.now()-localStart;
  // Classical simulated annealing baseline, independently seeded and constraint-aware.
  // Uses precisely the same penalized binary energy table as the quantum simulations.
  const annealSteps=Math.max(8,Math.min(256,Math.floor(options.annealSteps??48)));
  const annealTime=Math.max(0.1,Math.min(30,Number(options.annealTime??6)));
  const saStart=performance.now();
  const penalized=sharedEnergies;
  let saMask=greedy;
  let saEnergy=penalized[saMask];
  let bestSaMask=saMask;
  let bestSaEnergy=saEnergy;
  const annealRandom=()=>random();
  for(let step=0;step<annealSteps*12;step++){
    const temperature=1.5*Math.pow(0.005,step/Math.max(1,annealSteps*12-1));
    const candidate=saMask^(1<<Math.floor(annealRandom()*n));
    const diff=penalized[candidate]-saEnergy;
    if(diff<=0||annealRandom()<Math.exp(-diff/temperature)){
      saMask=candidate;saEnergy=penalized[candidate];
      if(valid[saMask]&&saEnergy<bestSaEnergy){bestSaMask=saMask;bestSaEnergy=saEnergy;}
    }
  }
  if(!valid[bestSaMask])bestSaMask=best;
  const saMs=performance.now()-saStart;

  // Digitized, closed-system quantum annealing (not D-Wave hardware).
  // First-order Trotter steps for H(s)=(1-s)*(-sum X_i)+s*Hcost.
  // Cost eigenvalues are the same penalized objective as QAOA.
  const qaStart=performance.now();
  const qr=new Float64Array(count).fill(1/Math.sqrt(count));
  const qi=new Float64Array(count);
  const dt=annealTime/annealSteps;
  for(let step=0;step<annealSteps;step++){
    const progress=(step+0.5)/annealSteps;
    for(let state=0;state<count;state++){
      const angle=dt*progress*penalized[state];
      const cs=Math.cos(angle),sn=Math.sin(angle);
      const r=qr[state], im=qi[state];
      qr[state]=cs*r+sn*im;qi[state]=cs*im-sn*r;
    }
    const beta=-dt*(1-progress);
    const cs=Math.cos(beta),sn=Math.sin(beta);
    for(let bit=0;bit<n;bit++)for(let state=0;state<count;state++)if(!(state&(1<<bit))){
      const other=state|(1<<bit),a=qr[state],b=qi[state],c=qr[other],d=qi[other];
      qr[state]=cs*a+sn*d; qi[state]=cs*b-sn*c;
      qr[other]=cs*c+sn*b;qi[other]=cs*d-sn*a;
    }
  }
  const qaProbs=costs.map((_,i)=>qr[i]*qr[i]+qi[i]*qi[i]);
  const qaFeasible=costs.reduce((v,_,i)=>v+(valid[i]?qaProbs[i]:0),0);
  const qaBest=feasibleMasks.slice().sort((a,b)=>qaProbs[b]-qaProbs[a]||costs[a]-costs[b])[0];
  const qaOptimal=feasibleMasks.filter(m=>Math.abs(costs[m]-costs[best])<1e-8).reduce((v,i)=>v+qaProbs[i],0);
  const qaExpected=qaProbs.reduce((v,p,i)=>v+p*costs[i],0);
  const qaMs=performance.now()-qaStart;
  const qaoaStart=performance.now();
  const energies=sharedEnergies;
  const norm=1/Math.sqrt(count);
  function evolve(gammas:number[],betas:number[]){
    const real=new Float64Array(count).fill(norm),imag=new Float64Array(count);
    if(options.warmStart || options.feasibleMixer){
      let total=0;
      for(let state=0;state<count;state++){
        let probability=1;
        for(let bit=0;bit<n;bit++)probability*=((state>>bit)&1)===((greedy>>bit)&1)?0.8:0.2;
        if(options.feasibleMixer&&!valid[state])probability=0;
        real[state]=Math.sqrt(probability);total+=probability;
      }
      for(let state=0;state<count;state++)real[state]/=Math.sqrt(total);
    }
    for(let layer=0;layer<gammas.length;layer++){
      const gamma=gammas[layer],beta=betas[layer];
      for(let state=0;state<count;state++){
        const angle=gamma*energies[state],cs=Math.cos(angle),sn=Math.sin(angle);
        const a=real[state],b=imag[state];real[state]=a*cs+b*sn;imag[state]=b*cs-a*sn;
      }
      const cs=Math.cos(beta),sn=Math.sin(beta);
      for(let bit=0;bit<n;bit++)for(let state=0;state<count;state++)if(!(state&(1<<bit))){
        const other=state|(1<<bit);
        if(options.feasibleMixer&&(!valid[state]||!valid[other]))continue;
        const a=real[state],b=imag[state],c=real[other],d=imag[other];
        real[state]=cs*a+sn*d;imag[state]=cs*b-sn*c;
        real[other]=cs*c+sn*b;imag[other]=cs*d-sn*a;
      }
    }
    return costs.map((_,i)=>real[i]*real[i]+imag[i]*imag[i]);
  }
  const alpha=Math.max(0.05,Math.min(1,options.cvarAlpha??1));
  const energyOrder=energies.map((_,i)=>i).sort((a,b)=>energies[a]-energies[b]);
  const score=(prob:number[])=>{let mass=0,total=0;for(const i of energyOrder){const take=Math.min(prob[i],alpha-mass);total+=take*energies[i];mass+=take;if(mass>=alpha-1e-12)break;}return total/alpha;};
  const feasibleMass=(prob:number[])=>feasibleMasks.reduce((sum,m)=>sum+prob[m],0);
  const optimalMasks=feasibleMasks.filter(m=>Math.abs(costs[m]-costs[best])<1e-8);
  const optimumMass=(prob:number[])=>optimalMasks.reduce((sum,m)=>sum+prob[m],0);
  const convergence:QaoaPoint[]=[];
  const run=(layers:number, steps:number, trace:boolean, randomStart=false)=>{
    let gs=Array.from({length:layers},(_,i)=>randomStart?random()*Math.PI*2:(options.transfer?.gamma[i]??initialGamma));
    let bs=Array.from({length:layers},(_,i)=>randomStart?random()*Math.PI:(options.transfer?.beta[i]??initialBeta));
    let probs=evolve(gs,bs), energy=score(probs);
    const tracePoints:QaoaPoint[]=[];
    const record=(step:number)=>{if(trace)tracePoints.push({iteration:step,energy,feasibleProbability:feasibleMass(probs),optimalProbability:optimumMass(probs)});};
    record(0);
    if(options.optimize!==false){
      for(let step=1;step<=steps;step++){
        if(optimizer==='spsa'){
          const params=[...gs,...bs];
          const a=0.15/Math.pow(step+5,0.602),c=0.12/Math.pow(step,0.101);
          const signs=params.map(()=>random()<0.5?-1:1);
          const plus=params.map((v,i)=>v+c*signs[i]);
          const minus=params.map((v,i)=>v-c*signs[i]);
          const delta=(score(evolve(plus.slice(0,layers),plus.slice(layers)))-score(evolve(minus.slice(0,layers),minus.slice(layers))))/(2*c);
          const proposed=params.map((v,i)=>v-a*delta*signs[i]);
          const candidate=evolve(proposed.slice(0,layers),proposed.slice(layers));
          const value=score(candidate);
          if(value<energy){gs=proposed.slice(0,layers);bs=proposed.slice(layers);probs=candidate;energy=value;}
        }else{
          const index=(step-1)%(2*layers),isGamma=index<layers, slot=index%layers;
          const old=isGamma?gs[slot]:bs[slot];
          const delta=Math.pow(0.84,Math.floor((step-1)/(2*layers)));
          let chosen=old;
          for(const sign of [-1,1]){
            const trial=old+sign*delta;
            const trialGs=[...gs],trialBs=[...bs];
            if(isGamma)trialGs[slot]=trial;else trialBs[slot]=trial;
            const candidate=evolve(trialGs,trialBs),value=score(candidate);
            if(value<energy-1e-12){energy=value;chosen=trial;probs=candidate;}
          }
          if(isGamma)gs[slot]=chosen;else bs[slot]=chosen;
        }
        record(step);
      }
    }
    return {gs,bs,probs,energy,tracePoints};
  };
  // Independent seeded restarts; only the winning restart contributes the convergence curve.
  const outcomes=Array.from({length:restarts},(_,i)=>run(depth,iterations,true,i>0));
  const restartEnergies=outcomes.map(x=>x.energy);
  const winning=outcomes.reduce((index,item,i)=>item.energy<outcomes[index].energy?i:index,0);
  const outcome=outcomes[winning];
  convergence.push(...outcome.tracePoints);
  const selectedG=outcome.gs,selectedB=outcome.bs;
  const depthSweep:QaoaDepthPoint[]=[];
  if(options.sweep){
    for(let d=1;d<=depth;d++){
      const now=performance.now();
      const r=d===depth?outcome:run(d,iterations,false);
      const feas=feasibleMasks.slice().sort((a,b)=>r.probs[b]-r.probs[a]||costs[a]-costs[b])[0];
      depthSweep.push({depth:d,gap:100*(costs[feas]-costs[best])/Math.max(Math.abs(costs[best]),1e-9),feasibleProbability:feasibleMass(r.probs),optimalProbability:optimumMass(r.probs),runtimeMs:performance.now()-now});
    }
  }
  const probability=outcome.probs;
  const feasibleProbability=feasibleMasks.reduce((s,m)=>s+probability[m],0);
  const lowest=costs[best],optimum=feasibleMasks.filter(m=>Math.abs(costs[m]-lowest)<1e-8);
  const optimalProbability=optimum.reduce((s,m)=>s+probability[m],0);
  const qBest=[...feasibleMasks].sort((a,b)=>probability[b]-probability[a]||costs[a]-costs[b])[0];
  const distribution=probability.map((p,mask)=>({mask,bits:mask.toString(2).padStart(n,'0'),cost:costs[mask],probability:p,feasible:valid[mask]})).sort((a,b)=>b.probability-a.probability).slice(0,Math.min(16,count));
  const qaoaMs=performance.now()-qaoaStart;
  const meanEnergy=restartEnergies.reduce((a,b)=>a+b,0)/restartEnergies.length;
  const stdEnergy=Math.sqrt(restartEnergies.reduce((a,b)=>a+(b-meanEnergy)**2,0)/restartEnergies.length);
  const approximationRatio=costs[best]>0&&costs[qBest]>0?costs[best]/costs[qBest]:null;
  return {jobs,candidates:pairs,configurations:count,feasibleConfigurations:feasibleMasks.length,
    research:{optimizer,seed,restarts,restartEnergies,bestEnergy:Math.min(...restartEnergies),meanEnergy,stdEnergy,approximationRatio,objectiveStates:count},
    distribution,convergence,depthSweep,runtimeMs:{exact:exactMs,greedy:greedyMs,localSearch:localMs,qaoa:qaoaMs},
    exact:{cost:costs[best],mask:best},greedy:{cost:costs[greedy],mask:greedy,feasible:valid[greedy]},
    localSearch:{cost:costs[localMask],mask:localMask,feasible:valid[localMask]},
    simulatedAnnealing:{cost:costs[bestSaMask],mask:bestSaMask,feasible:valid[bestSaMask],runtimeMs:saMs},
    quantumAnnealing:{cost:qaFeasible>1e-12?costs[qaBest]:null,mask:qaFeasible>1e-12?qaBest:null,feasibleProbability:qaFeasible,optimalProbability:qaOptimal,expectedCost:qaExpected,runtimeMs:qaMs,steps:annealSteps,totalTime:annealTime},
    qaoa:{cost:feasibleProbability>1e-12?costs[qBest]:null,mask:feasibleProbability>1e-12?qBest:null,
      feasibleProbability,optimalProbability,expectedCost:probability.reduce((s,p,i)=>s+p*costs[i],0),
      depth:selectedG.length,gamma:selectedG,beta:selectedB},
    excluded:input.jobs.filter(j=>!jobs.includes(j.id)).map(j=>j.id),
    objective:'total modeled USD including carbon and migration'};
}
