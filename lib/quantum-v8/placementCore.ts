import type { QuantumOptimizationRequest, QuantumOptimizationResult } from '../quantumClient.ts';

/** Browser fallback: depth-4 statevector QAOA over four 10-qubit batches for 20 regions.
 * Each batch uses 10 qubits for five regions (primary + reserve binary choices). The 20-region combinatorial
 * problem is NOT encoded in one circuit. Cloud Python offers COBYLA optimization.
 */
export function placementQaoa(payload: QuantumOptimizationRequest, onlyBatch?:number): QuantumOptimizationResult & Record<string, unknown> {
 const started=performance.now();
 if(!payload || !Array.isArray(payload.regions) || payload.regions.length!==20)throw new Error('Exactly 20 regions required');
 const seen=new Set<string>();
 if(![payload.carbon_tax,payload.sla_ms,payload.treasury_yield].every(Number.isFinite))throw new Error('Invalid quantum controls');
 for(const r of payload.regions){if(!r || typeof r.id!=='string'||seen.has(r.id)||typeof r.eligible!=='boolean'||![r.carbon_ci,r.energy_price,r.latency_ms,r.egress_cost_gb].every(v=>Number.isFinite(v)&&v>=0))throw new Error('Invalid region');seen.add(r.id);}
 const cost=(r:typeof payload.regions[number])=>r.energy_price/1000+payload.carbon_tax*.25*r.carbon_ci/1000+Math.max(0,r.latency_ms-payload.sla_ms)*.005+r.egress_cost_gb*.05;
 const candidates=payload.regions; // Preserve the 20-region catalog order in exactly four 10-qubit batches.
 if(!candidates.some(r=>r.eligible&&r.latency_ms<=payload.sla_ms&&(!payload.dpdp_locked||['ap-south-1','ap-south-2','asia-south2'].includes(r.code))))throw new Error('No eligible candidates after constraints');
 const p=4, objectives: Array<'expected_energy'|'feasible_cost'|'cvar_20'>=payload.benchmark?['expected_energy','feasible_cost','cvar_20']:['feasible_cost'];
 type Row={objective:string;batch_index:number;batch_region_ids:string[];feasible_probability:number;optimum_probability:number;optimizer_evals:number;best_feasible_sample_cost:number|null;best_feasible_sample_region_id:string|null;best_feasible_sample_hedge:boolean|null;expected_penalized_energy:number};
 const rows:Row[]=[];
 let totalEvals=0;
 for(let start=0;start<candidates.length;start+=5){
  if(onlyBatch!==undefined&&start/5!==onlyBatch)continue;
  const chunk=candidates.slice(start,start+5),k=chunk.length,n=10,size=2**n,costs=chunk.map(cost);
  const energy=new Float64Array(size),raw=new Float64Array(size),valid=new Uint8Array(size);
  // Five primary-selection bits (0..4) and five reserve-selection bits (5..9).
  // The reserve encoding is an alternative candidate, NOT an additional deployed allocation.
  const allowedFlags=chunk.map(r=>r.eligible&&r.latency_ms<=payload.sla_ms&&(!payload.dpdp_locked||['ap-south-1','ap-south-2','asia-south2'].includes(r.code)));
  if(!allowedFlags.some(Boolean))continue;
  const allowed=(j:number)=>j>=0&&allowedFlags[j];
  for(let i=0;i<size;i++){
   let primary=0,reserve=0,first=-1,second=-1;
   for(let j=0;j<k;j++) {if((i>>j)&1){primary++;first=j;}if((i>>(j+5))&1){reserve++;second=j;}}
   const isValid=primary===1&&reserve<=1&&(reserve===0||first!==second)&&allowed(first)&&(reserve===0||allowed(second));
   const value=first>=0?costs[first]!+(reserve===1&&second>=0?0.02*costs[second]!:0):100;
   raw[i]=value;
   energy[i]=value+8*(primary-1)**2+8*Math.max(0,reserve-1)**2+(reserve>0&&first===second?8:0)+(isValid?0:100);
   valid[i]=isValid?1:0;
  }
  let minValid=Infinity;for(let i=0;i<size;i++)if(valid[i]&&raw[i]<minValid)minValid=raw[i]!;
  if(!Number.isFinite(minValid))continue;
  const distinctEnergies:number[]=[],energyIndex=new Uint16Array(size),energyMap=new Map<number,number>();
  for(let i=0;i<size;i++){
   let index=energyMap.get(energy[i]);
   if(index===undefined){index=distinctEnergies.length;energyMap.set(energy[i],index);distinctEnergies.push(energy[i]);}
   energyIndex[i]=index;
  }
  const phaseRe=new Float64Array(distinctEnergies.length),phaseIm=new Float64Array(distinctEnergies.length);
  const probabilities=(v:number[])=>{
   const re=new Float64Array(size),im=new Float64Array(size),scale=1/Math.sqrt(size);
   re.fill(scale);
   const mixCos=new Float64Array(p),mixSin=new Float64Array(p);
   for(let j=0;j<p;j++){mixCos[j]=Math.cos(v[j]!);mixSin[j]=Math.sin(v[j]!);}
   for(let layer=0;layer<p;layer++){
    const gamma=v[p+layer]!,c=mixCos[layer]!,s=mixSin[layer]!;
    for(let i=0;i<distinctEnergies.length;i++){const a=gamma*distinctEnergies[i];phaseRe[i]=Math.cos(a);phaseIm[i]=Math.sin(a);}
    for(let i=0;i<size;i++){const j=energyIndex[i],cr=phaseRe[j],si=phaseIm[j],r=re[i]!,m=im[i]!;re[i]=r*cr+m*si;im[i]=m*cr-r*si;}
    for(let q=0;q<n;q++)for(let base=0,stride=1<<q;base<size;base+=stride*2)for(let offset=0;offset<stride;offset++){
     const i=base+offset,j=i+stride,ar=re[i]!,ai=im[i]!,br=re[j]!,bi=im[j]!;
     re[i]=c*ar+s*bi;im[i]=c*ai-s*br;re[j]=c*br+s*ai;im[j]=c*bi-s*ar;
    }
   }
   const out=new Float64Array(size);for(let i=0;i<size;i++)out[i]=re[i]!*re[i]!+im[i]!*im[i]!;return out;
  };
  for(const target of objectives){
   let evaluations=0;
   const score=(v:number[])=>{
    evaluations++;const probs=probabilities(v);
    if(target==='expected_energy')return probs.reduce((a,b,i)=>a+b*energy[i]!,0);
    if(target==='feasible_cost'){
     let mass=0,val=0;for(let i=0;i<size;i++)if(valid[i]){mass+=probs[i]!;val+=probs[i]!*raw[i]!;}
     return mass>1e-10?val/mass+8*(1-mass):1e6;
    }
    let remaining=.2,sum=0;const sorted=Array.from({length:size},(_,i)=>i).sort((a,b)=>energy[a]!-energy[b]!);
    for(const i of sorted){const part=Math.min(remaining,probs[i]!);sum+=part*energy[i]!;remaining-=part;if(remaining<=1e-12)break;}
    return sum/.2;
   };
   let winner:number[]=[];let best=Infinity;
   const fastMode=Boolean((payload as QuantumOptimizationRequest & {fast_mode?:boolean}).fast_mode);
   // Fast mode keeps depth p=4 but uses fixed angles (one evaluation) instead of iterative parameter search.
   // This is a latency/quality tradeoff, not an equivalent fully optimized QAOA run.
   for(let restart=0;restart<1;restart++){
    const v=Array.from({length:p*2},(_,i)=>i<p?.18+.27*((i+restart)%3):.3+.47*((i+restart)%4));
    let local=fastMode?0:score(v);
    for(const step of (fastMode ? [] : [.35,.12]))for(let iter=0;iter<1;iter++){
     let improved=false;
     for(let axis=0;axis<v.length;axis++)for(const direction of (fastMode ? [1] : [-1,1])){
      const trial=v.slice();trial[axis]!+=direction*step;const candidate=score(trial);
      if(candidate<local-1e-12){v.splice(0,v.length,...trial);local=candidate;improved=true;}
     }
     if(!improved)break;
    }
    if(fastMode || local<best){best=local;winner=v.slice();}
   }
   const probabilitiesBest=probabilities(winner);
   // The fast path still evaluates the circuit once to obtain the measurement distribution.
   if(fastMode)evaluations++;
   let mass=0,optimum=0,expected=0;
   for(let i=0;i<size;i++){const prob=probabilitiesBest[i]!;expected+=prob*energy[i]!;if(valid[i]){mass+=prob;if(Math.abs(raw[i]!-minValid)<1e-10)optimum+=prob;}}
   // Deterministically sample using a fixed seed per batch and objective.
   let seed=(0x9e3779b9 + start*13 + objectives.indexOf(target)*101)>>>0;
   const rand=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/4294967296;};
   const prefix=new Float64Array(size);let accum=0;for(let i=0;i<size;i++){accum+=probabilitiesBest[i]!;prefix[i]=accum;}
   let bestBasis=-1;for(let shot=0;shot<(payload.shots??512);shot++){
    const v=rand()*accum;let lo=0,hi=size-1;while(lo<hi){const mid=(lo+hi)>>1;if(prefix[mid]!>=v)hi=mid;else lo=mid+1;}
    if(valid[lo] && (bestBasis<0||raw[lo]!<raw[bestBasis]!))bestBasis=lo;
   }
   // If finite sampling missed valid states, record the best nonzero-probability valid state.
   // This is probability-distribution candidate extraction, NOT a measured sample.
   if(bestBasis<0){let probability=0;for(let i=0;i<size;i++)if(valid[i]&&probabilitiesBest[i]!>probability){probability=probabilitiesBest[i]!;bestBasis=i;}}
   let bestRegion:string|null=null;
   if(bestBasis>=0)for(let j=0;j<k;j++)if((bestBasis>>j)&1)bestRegion=chunk[j]!.id;
   rows.push({objective:target,batch_index:start/5,batch_region_ids:chunk.map(r=>r.id),feasible_probability:mass,optimum_probability:optimum,optimizer_evals:evaluations,best_feasible_sample_cost:bestBasis<0?null:raw[bestBasis]!,best_feasible_sample_region_id:bestRegion,best_feasible_sample_hedge:false,expected_penalized_energy:expected});
   totalEvals+=evaluations;
  }
 }
 const feasible=rows.filter(r=>r.best_feasible_sample_region_id!==null).sort((a,b)=>a.best_feasible_sample_cost!-b.best_feasible_sample_cost!||b.feasible_probability-a.feasible_probability);
 if(!feasible.length)throw new Error('No feasible QAOA samples under the current eligibility and SLA constraints');
 const best=feasible[0]!,weights=Object.fromEntries(candidates.map(r=>[r.id,r.id===best.best_feasible_sample_region_id?1:0]));
 return {status:'completed',job_id:null,mode:'statevector-simulator',backend:'TypeScript CPU QAOA (batched statevectors)',candidate_region_ids:candidates.map(r=>r.id),weights,hedge_pct:0,qaoa_cost_usd_per_kwh:cost(candidates.find(r=>r.id===best.best_feasible_sample_region_id)!),execution_ms:performance.now()-started,penalized_circuit_energy:best.expected_penalized_energy,quantum_verified:false,feasible_probability:best.feasible_probability,optimizer_evals:totalEvals,reps:p,n_qubits:10,candidate_coverage:'all eligible regions in separate batches',simultaneous_20_region_circuit:false,batch_count:onlyBatch===undefined?4:1,compared_objectives:objectives,objective_comparison:rows,best_feasible_sample:{region_id:best.best_feasible_sample_region_id,cost_usd_per_kwh:best.best_feasible_sample_cost,hedge:best.best_feasible_sample_hedge,objective:best.objective,batch_index:best.batch_index}};
}

