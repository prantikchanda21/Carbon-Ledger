/** v137: quantum-oracle sampling over objective-aware feasible candidates.
 * Quantum dynamics: 4 independent 7-qubit statevectors, Grover selective phase +
 * diffusion, three layers; CPU simulated. Candidate proposal, oracle threshold,
 * final four-sample comparison are classical. No LP/GLPK fallback or supplied
 * optimal allocation. This is a hybrid simulation, not hardware speedup.
 */
export type OracleInput={costs:number[];caps:number[];preferred:number[];regularization:number};
const SIZE=128;
function hash(a:number){a^=a>>>16;a=Math.imul(a,0x7feb352d);a^=a>>>15;a=Math.imul(a,0x846ca68b);return (a^(a>>>16))>>>0;}
function candidate(mask:number,batch:number,costs:number[],caps:number[],preferred:number[],lambda:number){
 const n=costs.length, weights=new Array<number>(n).fill(0);
 const level=(mask%16),strength=[0,.35,.7,1][batch]!, drift=level/15;
 // A range of penalty-sensitive marginal prices. This is a classical heuristic,
 // not a quantum gate. The sorting makes the model fast but contributes quality.
 const prices=costs.map((c,i)=>({i,price:c-lambda*(.25+.75*strength)+.004*(hash((mask+1)*61+i*181+batch*41)/4294967296-.5)*(1-drift)}));
 prices.sort((a,b)=>a.price-b.price);
 let remaining=1;
 // Quantum-basis-encoded prefill controls diversification/regularization.
 const retain=[0,.4,.75,1][batch]! * ((mask>>4)/7);
 for(let i=0;i<n;i++){const take=Math.min(caps[i]!,Math.max(0,preferred[i]!)*retain);weights[i]=take;remaining-=take;}
 if(remaining<0){const total=weights.reduce((s,w)=>s+w,0);for(let i=0;i<n;i++)weights[i]/=total;return weights;}
 for(const {i} of prices){if(remaining<=1e-12)break;const available=caps[i]!-weights[i]!;const add=Math.min(remaining,available);weights[i]+=add;remaining-=add;}
 if(remaining>1e-8)throw Error('Insufficient capacity');return weights;
}
export function quantumOracleAllocation(input:OracleInput){
 const {costs,caps,preferred,regularization}=input,n=costs.length;
 if(!n||caps.length!==n||preferred.length!==n||![...costs,...caps,...preferred,regularization].every(Number.isFinite)||regularization<0||caps.some(c=>c<0)||caps.reduce((a,b)=>a+b,0)<1-1e-9)throw Error('Invalid/infeasible quantum-oracle request');
 const objective=(w:number[])=>w.reduce((s,x,i)=>s+x*costs[i]!+regularization*Math.abs(x-preferred[i]!),0);
 let selected:null|{weights:number[];objective:number;batch:number;basis:number;probability:number}=null;
 const summaries=[];
 for(let batch=0;batch<4;batch++){
  const t=performance.now(),candidates=Array.from({length:SIZE},(_,k)=>candidate(k,batch,costs,caps,preferred,regularization));
  const energy=Float64Array.from(candidates.map(objective));
  const sorted=Array.from(energy).sort((a,b)=>a-b);
  // Three Grover iterations amplify ~8 marked states among 128.
  const threshold=sorted[[3,5,7,11][batch]!]!+1e-12;
  const re=new Float64Array(SIZE).fill(1/Math.sqrt(SIZE)),im=new Float64Array(SIZE);
  for(let depth=0;depth<3;depth++){
   for(let k=0;k<SIZE;k++)if(energy[k]<=threshold){re[k]=-re[k];im[k]=-im[k];}
   let mr=0,mi=0;for(let k=0;k<SIZE;k++){mr+=re[k];mi+=im[k];}mr=mr*2/SIZE;mi=mi*2/SIZE;
   for(let k=0;k<SIZE;k++){re[k]=mr-re[k];im[k]=mi-im[k];}
  }
  let seed=hash((batch+1)*97);for(let i=0;i<n;i++)seed=hash(seed^Math.round(costs[i]!*1e7));
  // v142: reuse the same amplified state for 32 Born-rule shots per register.
  // Only measured bitstrings may be selected; no classical analytic solution is injected.
  const cdf=new Float64Array(SIZE);let norm=0;
  for(let k=0;k<SIZE;k++){norm+=re[k]*re[k]+im[k]*im[k];cdf[k]=norm;}
  let chosen=SIZE-1;let bestEnergy=Infinity;
  for(let shot=0;shot<32;shot++){
   seed=hash(seed+0x9e3779b9+shot*41);
   const u=(seed/4294967296)*norm;
   let left=0,right=SIZE-1;
   while(left<right){const mid=(left+right)>>>1;if(cdf[mid]<u)left=mid+1;else right=mid;}
   if(energy[left]!<bestEnergy){bestEnergy=energy[left]!;chosen=left;}
  }
  const probability=re[chosen]*re[chosen]+im[chosen]*im[chosen];
  const result={weights:candidates[chosen]!,objective:energy[chosen]!,batch,basis:chosen,probability};
  if(!selected||result.objective<selected.objective)selected=result;
  summaries.push({batch,selectedBasis:chosen,objective:result.objective,probability,norm,depth:3,ms:performance.now()-t});
 }
 if(!selected)throw Error('Quantum measurement produced no allocation');
 const sum=selected.weights.reduce((a,b)=>a+b,0);
 if(Math.abs(sum-1)>1e-8||selected.weights.some((w,i)=>w<0||w>caps[i]!+1e-8))throw Error('Quantum candidate is infeasible');
 return {...selected,feasible:true,batches:summaries,method:'v142: 4 × 7-qubit Grover oracle CPU simulation, p=3, 32 measured shots/register; classical cost-aware encoding; no LP/GLPK allocation fallback'};
}
