import type {QuantumOptimizationRequest,QuantumOptimizationResult} from '../quantumClient.ts';
/** Bounded p=1 QAOA simulator for the existing six-candidate placement demo.
 * CPU only, 2^(k+1)<=128 amplitudes, no Python or external services on Vercel.
 */
export function placementQaoa(payload:QuantumOptimizationRequest):QuantumOptimizationResult & {feasible_probability:number;optimizer_evals:number} {
 const start=performance.now();
 if(!payload||!Array.isArray(payload.regions)||payload.regions.length!==20)throw new Error('Exactly 20 regions required');
 if(!Number.isFinite(payload.carbon_tax)||payload.carbon_tax<0||payload.carbon_tax>1||!Number.isFinite(payload.sla_ms)||payload.sla_ms<1||(!Number.isFinite(payload.treasury_yield)||payload.treasury_yield<0||payload.treasury_yield>100))throw new Error('Invalid quantum controls');
 const seen=new Set<string>();for(const r of payload.regions){if(!r||typeof r.id!=='string'||seen.has(r.id)||typeof r.eligible!=='boolean'||r.carbon_ci>10000||r.energy_price>1e6||r.latency_ms>1e6||r.egress_cost_gb>1e4||![r.carbon_ci,r.energy_price,r.latency_ms,r.egress_cost_gb].every(v=>Number.isFinite(v)&&v>=0))throw new Error('Invalid or duplicate region');seen.add(r.id);}
 const cost=(r:typeof payload.regions[number])=>r.energy_price/1000+payload.carbon_tax*.25*r.carbon_ci/1000+r.egress_cost_gb*.05;
 const candidates=payload.regions.filter(r=>r.eligible&&r.latency_ms<=payload.sla_ms&&(!payload.dpdp_locked||['mumbai','hyderabad','delhi'].includes(r.id))).sort((a,b)=>cost(a)-cost(b)||a.id.localeCompare(b.id)).slice(0,6);
 if(!candidates.length)throw new Error('No feasible regions');
 const k=candidates.length,n=k+1,size=1<<n,costs=candidates.map(cost),hedge=payload.benchmark?0:.12-.03*Math.max(0,payload.treasury_yield-7)+.025*payload.carbon_tax;
 const energy=new Float64Array(size),valid=new Uint8Array(size);
 for(let basis=0;basis<size;basis++){let selected=0,v=hedge*((basis>>k)&1);for(let i=0;i<k;i++)if(basis&(1<<i)){selected++;v+=costs[i]!;}energy[basis]=v+8*(selected-1)**2;valid[basis]=selected===1?1:0;}
 let evals=0;
 const state=(beta:number,gamma:number)=>{evals++;const re=new Float64Array(size),im=new Float64Array(size),scale=1/Math.sqrt(size);
  for(let i=0;i<size;i++){re[i]=Math.cos(gamma*energy[i]!)*scale;im[i]=-Math.sin(gamma*energy[i]!)*scale;}
  const c=Math.cos(beta),s=Math.sin(beta);
  for(let q=0;q<n;q++)for(let i=0;i<size;i++){if(i&(1<<q))continue;const j=i|(1<<q),ar=re[i]!,ai=im[i]!,br=re[j]!,bi=im[j]!;re[i]=c*ar+s*bi;im[i]=c*ai-s*br;re[j]=c*br+s*ai;im[j]=c*bi-s*ar;}
  const probs=Array.from(re,(v,i)=>v*v+im[i]!*im[i]!);return {probs,score:probs.reduce((s,p,i)=>s+p*energy[i]!,0)};};
 let best=state(.3,.3),beta=.3,gamma=.3;
 for(let b=0;b<5;b++)for(let g=0;g<5;g++){const bv=b*Math.PI/10,gv=g*2*Math.PI/5,r=state(bv,gv);if(r.score<best.score){best=r;beta=bv;gamma=gv;}}
 for(const step of [.2,.1,.05,.02,.01])for(let repeat=0;repeat<2;repeat++)for(const [db,dg] of [[step,0],[-step,0],[0,step],[0,-step]]){const r=state(beta+db!,gamma+dg!);if(r.score<best.score){best=r;beta+=db!;gamma+=dg!;}}
 const weights=costs.map(()=>0);let mass=0,h=0;
 for(let basis=0;basis<size;basis++){if(!valid[basis])continue;const p=best.probs[basis]!;mass+=p;h+=p*((basis>>k)&1);for(let i=0;i<k;i++)if(basis&(1<<i))weights[i]!+=p;}
 if(mass<1e-12)throw new Error('No feasible probability');
 const normalized=weights.map(w=>w/mass);
 return {status:'completed',job_id:null,mode:'statevector-simulator',backend:'TypeScript CPU statevector',candidate_region_ids:candidates.map(r=>r.id),weights:Object.fromEntries(candidates.map((r,i)=>[r.id,normalized[i]])),hedge_pct:h/mass,qaoa_cost_usd_per_kwh:normalized.reduce((s,w,i)=>s+w*costs[i]!,0),execution_ms:performance.now()-start,penalized_circuit_energy:best.score,quantum_verified:false,feasible_probability:mass,optimizer_evals:evals};
}
