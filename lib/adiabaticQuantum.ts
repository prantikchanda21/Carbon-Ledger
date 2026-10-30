/** Independent 7-qubit digitized adiabatic search simulator (NOT hardware annealing).
 * 4 independent 128-state registers; no classical optimization/fallback in selection.
 * The capacity-feasible decoder is classical and basis-states are a restricted ansatz.
 */
export interface AdiabaticInput {costs:number[];caps:number[];preferred:number[];regularization:number;}
const SIZE=128, Q=7;
function decode(mask:number,batch:number,caps:number[]):number[]{
 const n=caps.length, w=Array(n).fill(0);let remaining=1;
 // Basis index controls region ordering; no objective information enters the decoder.
 const order=Array.from({length:n},(_,i)=>i);
 const rank=(i:number)=>{const k=(i*17+batch*31)%n;return (((mask ^ (mask<<3) ^ (mask>>2)) + (k*37) + (((mask>>(i%7))&1)*13))%257);};
 order.sort((a,b)=>rank(a)-rank(b)||a-b);
 for(const i of order){const v=Math.min(remaining,caps[i]);w[i]=v;remaining-=v;if(remaining<1e-11)break;}
 if(remaining>1e-8)throw Error('Insufficient capacity');return w;
}
export function adiabaticQuantumAllocation(input:AdiabaticInput){
 const {costs,caps,preferred,regularization}=input,n=costs.length;
 if(!n||caps.length!==n||preferred.length!==n||![...costs,...caps,...preferred,regularization].every(Number.isFinite)||regularization<0||caps.some(v=>v<0)||caps.reduce((a,b)=>a+b,0)<1-1e-9)throw Error('Invalid adiabatic input');
 const objective=(w:number[])=>w.reduce((s,x,i)=>s+x*costs[i]+regularization*Math.abs(x-preferred[i]),0);
 let best:null|{weights:number[];objective:number;batch:number;basis:number;probability:number}=null;
 const summaries=[];
 for(let batch=0;batch<4;batch++){
  const t=performance.now(),candidates=Array.from({length:SIZE},(_,k)=>decode(k,batch,caps)),energy=Float64Array.from(candidates.map(objective));
  const low=Math.min(...energy),high=Math.max(...energy),scale=Math.max(1e-9,high-low);
  const re=new Float64Array(SIZE).fill(1/Math.sqrt(SIZE)),im=new Float64Array(SIZE);
  // Trotterized interpolation H(s)=(1-s)*(-sum X)/7 + s*diag(normalized cost).
  // Three steps (p=3), unitary X rotations and diagonal problem phases.
  for(let step=0;step<3;step++){
   const s=(step+0.5)/3,dt=2.2;
   for(let k=0;k<SIZE;k++){
    const angle=-dt*s*(energy[k]-low)/scale,c=Math.cos(angle),v=Math.sin(angle),a=re[k];
    re[k]=a*c-im[k]*v;im[k]=a*v+im[k]*c;
   }
   const theta=dt*(1-s)/Q,c=Math.cos(theta),sn=Math.sin(theta);
   for(let q=0;q<Q;q++){const bit=1<<q;for(let k=0;k<SIZE;k++)if(!(k&bit)){
    const j=k|bit,ar=re[k],ai=im[k],br=re[j],bi=im[j];
    re[k]=c*ar+sn*bi;im[k]=c*ai-sn*br;
    re[j]=c*br+sn*ai;im[j]=c*bi-sn*ar;
   }}
  }
  // Ideal infinite-shot readout distribution (the maximum-probability bitstring).
  // Not a hardware sample, and NOT energy-based classical reranking of all candidates.
  let chosen=0,p=-1,norm=0;
  for(let k=0;k<SIZE;k++){const probability=re[k]*re[k]+im[k]*im[k];norm+=probability;if(probability>p){p=probability;chosen=k;}}
  const result={weights:candidates[chosen],objective:energy[chosen],batch,basis:chosen,probability:p};
  if(!best||result.objective<best.objective)best=result; // 4 measured register outcomes compared classically.
  summaries.push({batch,basis:chosen,probability:p,objective:energy[chosen],norm,ms:performance.now()-t});
 }
 if(!best)throw Error('No measured adiabatic allocation');
 const feasible=best.weights.every((x,i)=>x>=0&&x<=caps[i]+1e-9)&&Math.abs(best.weights.reduce((a,b)=>a+b,0)-1)<1e-8;
 if(!feasible)throw Error('Adiabatic output infeasible');
 return {...best,feasible,batches:summaries,method:'7-qubit p=3 digitized adiabatic CPU statevector; 4 independent registers; maximum-probability measurement, no GLPK or analytical optimizer'};
}
