/** Research-only experiment (not deployed): measured quantum phase-oracle walk on a CPU.
 * NO GLPK output, SciPy solution, or analytic LP optimum enters the candidate generator.
 * Classical candidate preparation and evaluation are honestly part of the method.
 */
const STATES=128, BATCHES=4, DEPTH=3;
function hash(x){x^=x>>>16;x=Math.imul(x,0x7feb352d);x^=x>>>15;x=Math.imul(x,0x846ca68b);return (x^(x>>>16))>>>0;}
function draw(seed){const value=hash(seed);return {value,u:value/4294967296};}
function sum(a){let s=0;for(const x of a)s+=x;return s;}
const PRICES_NOISE=0.004;
export function generate(mask,batch,{costs,caps,preferred,regularization}){
 const n=costs.length,w=new Array(n).fill(0);
 const level=mask%16,drift=level/15;
 const noise=PRICES_NOISE*(1-drift);
 const prices=costs.map((c,i)=>({i,score:c+noise*(hash((mask+1)*61+i*181+batch*41)/4294967296-.5)}));
 prices.sort((a,b)=>a.score-b.score||a.i-b.i);
 const retain=[0,.4,.75,1][batch]*((mask>>4)/7);
 let left=1;
 for(let i=0;i<n;i++){w[i]=Math.min(caps[i],Math.max(0,preferred[i])*retain);left-=w[i];}
 if(left < -1e-8)throw Error('Preferred prefill exceeds capacity');
 for(const {i} of prices){if(left<=1e-12)break;const d=Math.min(left,caps[i]-w[i]);w[i]+=d;left-=d;}
 if(left>1e-8)throw Error('Insufficient capacities');
 return w;
}
export function objective(w,{costs,preferred,regularization}){
 return w.reduce((s,x,i)=>s+x*costs[i]+regularization*Math.abs(x-preferred[i]),0);
}
const sqr=x=>x*x;
/** Grover-style selective phase followed by reflection, plus objective-phase and 1-qubit-X mixing.
 * For a true oracle/circuit, objective evaluation must be reversible; this is CPU phase-oracle emulation.
 */
function evolve(energies,variant,markedCount){
 const re=new Float64Array(STATES).fill(1/Math.sqrt(STATES)),im=new Float64Array(STATES);
 const sorted=Float64Array.from(energies).sort(), threshold=sorted[markedCount-1]+1e-13;
 const span=Math.max(1e-10,sorted.at(-1)-sorted[0]);
 function phase(t){for(let k=0;k<STATES;k++){
  const a=-t*(energies[k]-sorted[0])/span,c=Math.cos(a),s=Math.sin(a),ar=re[k],ai=im[k];
  re[k]=ar*c-ai*s;im[k]=ar*s+ai*c;
 }}
 function mix(theta){const c=Math.cos(theta),s=Math.sin(theta);
  for(let q=0;q<7;q++){const st=1<<q;
   for(let base=0;base<STATES;base+=2*st)for(let off=0;off<st;off++){
    const a=base+off,b=a+st,ar=re[a],ai=im[a],br=re[b],bi=im[b];
    re[a]=ar*c+bi*s;im[a]=ai*c-br*s;
    re[b]=br*c+ai*s;im[b]=bi*c-ar*s;
   }
  }
 }
 function reflect(){let mr=0,mi=0;for(let k=0;k<STATES;k++){mr+=re[k];mi+=im[k];}mr*=2/STATES;mi*=2/STATES;
  for(let k=0;k<STATES;k++){re[k]=mr-re[k];im[k]=mi-im[k];}
 }
 for(let d=0;d<DEPTH;d++){
  if(variant==='phase-walk'){phase(.20*(d+1));mix(.10/(d+1));}
  for(let k=0;k<STATES;k++)if(energies[k]<=threshold){re[k]*=-1;im[k]*=-1;}
  reflect();
 }
 const cdf=new Float64Array(STATES);let norm=0;
 for(let k=0;k<STATES;k++){norm+=sqr(re[k])+sqr(im[k]);cdf[k]=norm;}
 return {cdf,norm,markedCount,threshold};
}
function select(cdf, norm, seed){const u=draw(seed).u*norm;let lo=0,hi=STATES-1;
 while(lo<hi){const mid=(lo+hi)>>1;if(cdf[mid]<u)lo=mid+1;else hi=mid;}return lo;
}
export function optimize(input,{variant='phase-walk',shots=32,seed=11}={}){
 if(!input.costs?.length||input.caps?.length!==input.costs.length||input.preferred?.length!==input.costs.length||input.caps.some(c=>c<0)||sum(input.caps)<1-1e-9||![...input.costs,...input.caps,...input.preferred,input.regularization].every(Number.isFinite))throw Error('Invalid data');
 let best=null;const batches=[];
 for(let b=0;b<BATCHES;b++){
  const candidates=Array.from({length:STATES},(_,k)=>generate(k,b,input));
  const energies=candidates.map(w=>objective(w,input));
  // Note: threshold is computed classically; not a free hardware quantum oracle.
  const {cdf,norm,threshold}=evolve(energies,variant,[3,4,5,6][b]);
  let sampledBest=null;
  for(let j=0;j<shots;j++){
   const k=select(cdf,norm,hash(seed^hash((b+1)*1231+j*7213)));
   if(!sampledBest||energies[k]<sampledBest.objective)sampledBest={weights:candidates[k],objective:energies[k],batch:b,basis:k};
  }
  if(!best||sampledBest.objective<best.objective)best=sampledBest;
  batches.push({norm,oracleThreshold:threshold,selectedBasis:sampledBest.basis,objective:sampledBest.objective});
 }
 const w=best.weights,feasible=Math.abs(sum(w)-1)<1e-8&&w.every((v,i)=>v>=0&&v<=input.caps[i]+1e-8);
 if(!feasible)throw Error('Quantum-measured candidate infeasible');
 return {...best,feasible,batches,method:`${variant} 4x7q p3; classical preparation and CPU quantum emulation`};
}
export function classicalUniform(input,{shots=128,seed=11}={}){
 let best=null;for(let j=0;j<shots;j++){
  const b=Math.floor(draw(seed+j*711).u*4),k=Math.floor(draw(seed+j*1097+99).u*128);
  const w=generate(k,b,input),o=objective(w,input);
  if(!best||o<best.objective)best={weights:w,objective:o,batch:b,basis:k};
 }
 return best;
}
