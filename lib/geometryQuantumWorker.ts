/** CPU exact statevector for a Hamming-weight-five 10-qubit Dicke subspace.
 * This is a quantum circuit SIMULATION, not physical quantum hardware.
 * All candidate decoding and oracle evaluation are classical and included in runtime.
 * No LP/GLPK allocation is fed into this method.
 */
export const geometryWorkerSource=String.raw`
const {parentPort}=require('node:worker_threads');
const N=1024, QUBITS=10, DEPTH=3;
const masks=[];for(let k=0;k<N;k++){let v=k,c=0;while(v){c+=v&1;v>>>=1;}if(c===5)masks.push(k);}
const VALID=masks.length;
function solve({costs,caps,preferred,regularization,batch,variant='geometry'}){
 const started=performance.now();
 const n=costs.length, weights=Array(N),energy=new Float64Array(N).fill(Infinity);
 let seed=(2166136261^Math.imul(batch+1,2654435761))>>>0;
 for(const v of [...costs,...caps,...preferred,regularization])seed=Math.imul(seed^Math.round(v*1e6),16777619)>>>0;
 const random=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/4294967296;};
 const min=Math.min(...costs),max=Math.max(...costs),spread=Math.max(1e-9,max-min);
 const curved=variant==='curved';
 const map=new Int8Array(n);
 if(curved){
  for(let i=0;i<n;i++)map[i]=i;
  if(batch>0){
   let prng=(0x9e3779b9^Math.imul(741103,batch))>>>0;
   for(let i=n-1;i>0;i--){prng^=prng<<13;prng^=prng>>>17;prng^=prng<<5;const j=(prng>>>0)%(i+1);const tmp=map[i];map[i]=map[j];map[j]=tmp;}
  }
 }
 const temperature=curved?[5.1,7.31,10.2,13.6][batch]*Math.max(.25,1+8*(.05-regularization)):[3.0,4.3,6.0,8.0][batch];
 const base=Float64Array.from(costs,(v,i)=>caps[i]>0?Math.exp(-temperature*(v-min)/spread):0);
 // 10 basis bits encode 10 paired regional biases; pair (i, i+10) is swapped.
 // Enforce sum(w)=1 and w_i<=caps_i by capacitated water filling, without an optimizer.
 function decode(mask){
  const raw=new Float64Array(n),w=new Float64Array(n);
  for(let i=0;i<n;i++){
   const pos=curved?map[i]:i;const bit=(mask>>(pos%10))&1;const favor=(pos<10)?bit:1-bit;
   const magnet=curved?(favor?1.4:1/1.4):(favor?1.32:.79);
   const hashed=((Math.imul(mask+11,1103515245)^Math.imul(i+59,12345)^Math.imul(batch+7,9767))>>>0)%1000/1000;
   raw[i]=base[i]*magnet*(.84+.32*hashed);
  }
  let left=1;
  for(let round=0;round<n+1&&left>1e-12;round++){
   let active=0,total=0;
   for(let i=0;i<n;i++)if(caps[i]-w[i]>1e-12){active++;total+=raw[i];}
   if(!active)break;
   let used=0;
   for(let i=0;i<n;i++)if(caps[i]-w[i]>1e-12){const d=Math.min(caps[i]-w[i],left*(total>1e-14?raw[i]/total:1/active));w[i]+=d;used+=d;}
   left-=used;
  }
  if(left>1e-8)throw Error('Insufficient eligible capacity');
  return Array.from(w);
 }
 let low=Infinity,high=-Infinity;
 for(const mask of masks){const w=decode(mask);weights[mask]=w;let value=0;for(let i=0;i<n;i++)value+=w[i]*costs[i]+regularization*Math.abs(w[i]-preferred[i]);energy[mask]=value;if(value<low)low=value;if(value>high)high=value;}
 const span=Math.max(1e-12,high-low),re=new Float64Array(N),im=new Float64Array(N);
 const amp=1/Math.sqrt(VALID);for(const k of masks)re[k]=amp;
 function phase(gamma){for(const k of masks){const t=-gamma*(energy[k]-low)/span,c=Math.cos(t),s=Math.sin(t),r=re[k],a=im[k];re[k]=r*c-a*s;im[k]=r*s+a*c;}}
 // RXX+YY rotations on |01>,|10> only. Total Hamming weight remains five.
 function xy(theta){const c=Math.cos(theta),s=Math.sin(theta);for(let q=0;q<QUBITS;q++){
  const r=(q+1)%QUBITS,aa=1<<q,bb=1<<r;
  for(const k of masks){if(!(k&aa)||(k&bb))continue;const j=k^aa^bb;
   const ar=re[k],ai=im[k],br=re[j],bi=im[j];
   re[k]=c*ar+s*bi;im[k]=c*ai-s*br;
   re[j]=c*br+s*ai;im[j]=c*bi-s*ar;
  }
 }}
 // Grover oracle over best-ranked marked states + inversion about the Dicke state.
 function grover(threshold){for(const k of masks)if(energy[k]<=threshold){re[k]*=-1;im[k]*=-1;}
 let mr=0,mi=0;for(const k of masks){mr+=re[k];mi+=im[k];}mr/=VALID;mi/=VALID;
 for(const k of masks){re[k]=2*mr-re[k];im[k]=2*mi-im[k];}}
 function measure(){let t=random();for(const k of masks){t-=re[k]*re[k]+im[k]*im[k];if(t<=0)return k;}return masks.at(-1);}
 const sorted=masks.slice().sort((a,b)=>energy[a]-energy[b]);
 let best=-1,shots=0;const trace=[];
 const ranks=[20,13,8];
 for(let p=0;p<DEPTH;p++){
  const t=(p+1)/DEPTH,s=curved?t*t*t*(10+t*(-15+6*t)):t*t*(3-2*t); // quintic vs cubic curvilinear evolution
  const gamma=curved?.28+1.7*s:.4+1.55*s,beta=curved?.29*(1-s)+.055:.5*(1-s)+.13;
  phase(gamma);
  if(variant!=='grover')xy(beta*(variant==='xy'?1.20:1));
  if(curved)phase(.16+.14*s);
  if(variant!=='xy')grover(energy[sorted[(curved?[24,12,6][p]:ranks[p])-1]]);
  for(let shot=0;shot<(curved?28:20);shot++){const k=measure();shots++;if(best<0||energy[k]<energy[best])best=k;}
  trace.push({round:p+1,schedule:s,marked:curved?[24,12,6][p]:ranks[p],bestObjective:energy[best]});
 }
 if(best<0)throw Error('Quantum measurement did not yield a state');
 const norm=masks.reduce((acc,k)=>acc+re[k]*re[k]+im[k]*im[k],0);
 const candidateBest=energy[sorted[0]],samplingGapPct=100*(energy[best]-candidateBest)/Math.max(1e-12,Math.abs(candidateBest));
 // Equal-output-shot classical sampling ablation. This DOES NOT equalize total
 // oracle/candidate evaluation cost: constructing the phase oracle already
 // evaluated every one of the 252 feasible bitstrings.
 let uniformObjective=Infinity;for(let shot=0;shot<shots;shot++){const k=masks[Math.floor(random()*VALID)];if(energy[k]<uniformObjective)uniformObjective=energy[k];}
 return {weights:weights[best],objective:energy[best],selectedBasis:best,qubits:10,p:3,batch,
  norm,shots,validBasisStates:VALID,trace,durationMs:performance.now()-started,candidateBest,samplingGapPct,uniformObjective,
  classicalOptimizerUsed:false,method:curved?'10q p3 quintic curvilinear XY + cost phases + adaptive Grover (CPU statevector)':'10q Dicke XY + nonlinear cost phase + adaptive Grover (CPU statevector)'};
}
parentPort.on('message',({id,input})=>{try{parentPort.postMessage({id,result:solve(input)});}catch(err){parentPort.postMessage({id,error:err instanceof Error?err.message:String(err)});}});
`;
