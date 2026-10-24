/** Self-contained Node worker: exact 128-amplitude statevector simulation. */
export const quadWorkerSource = String.raw`
const {parentPort}=require('node:worker_threads');
function execute({costs,caps,preferred,regularization,batch}) {
const started=performance.now();
let seed=(2166136261^(batch*2654435761))>>>0;
for(const v of [...costs,...caps])seed=Math.imul(seed^Math.round(v*1e6),16777619)>>>0;
function random(){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/4294967296;}
const N=128,n=costs.length;
// Decode each 7-bit basis state to a full feasible allocation. No LP solver and no exact analytical candidate.
function decode(k){
 const minCost=Math.min(...costs),maxCost=Math.max(...costs),spread=Math.max(1e-8,maxCost-minCost);
 const temperature=[2,3.5,5,7][batch];
 const raw=costs.map((c,i)=>caps[i]>0?Math.exp(-temperature*(c-minCost)/spread)*(.4+.6*random())*(.55+.9*((k>>(i%7))&1)):0);
 const w=Array(n).fill(0);let left=1;
 for(let round=0;round<=n&&left>1e-12;round++){
  const active=w.map((v,i)=>caps[i]-v>1e-12?i:-1).filter(i=>i>=0);
  const total=active.reduce((s,i)=>s+raw[i],0);
  if(!active.length)break;
  let used=0;for(const i of active){const d=Math.min(caps[i]-w[i],left*(total?raw[i]/total:1/active.length));w[i]+=d;used+=d;}left-=used;
 }
 if(left>1e-8)throw Error('Insufficient capacity');return w;
}
const candidates=Array.from({length:N},(_,k)=>decode(k));
const energy=candidates.map(w=>w.reduce((s,v,i)=>s+v*costs[i]+regularization*Math.abs(v-preferred[i]),0));
const lo=Math.min(...energy),span=Math.max(1e-9,Math.max(...energy)-lo),e=energy.map(v=>(v-lo)/span);
const re=new Float64Array(N).fill(1/Math.sqrt(N)),im=new Float64Array(N);
function phase(t){for(let k=0;k<N;k++){const a=-t*e[k],c=Math.cos(a),s=Math.sin(a),r=re[k];re[k]=r*c-im[k]*s;im[k]=r*s+im[k]*c;}}
// exp(-i theta X) across seven bits: exact hypercube quantum walk.
function walk(theta){const c=Math.cos(theta),s=Math.sin(theta);for(let q=0;q<7;q++)for(let a=0;a<N;a++){const b=a^(1<<q);if(a>b)continue;const ar=re[a],ai=im[a],br=re[b],bi=im[b];re[a]=c*ar+s*bi;im[a]=c*ai-s*br;re[b]=c*br+s*ai;im[b]=c*bi-s*ar;}}
function grover(threshold){for(let k=0;k<N;k++)if(energy[k]<threshold){re[k]*=-1;im[k]*=-1;}const mr=re.reduce((a,b)=>a+b,0)/N,mi=im.reduce((a,b)=>a+b,0)/N;for(let k=0;k<N;k++){re[k]=2*mr-re[k];im[k]=2*mi-im[k];}}
function measure(){let t=random();for(let k=0;k<N;k++){t-=re[k]*re[k]+im[k]*im[k];if(t<=0)return k;}return N-1;}
let best=Math.floor(random()*N);const trace=[];
for(let round=0;round<3;round++){
 const s=(round+1)/3;
 // Three-step digitized transverse-field anneal (not physical annealer access).
 walk(-(1-s)*.65);phase(s*1.4);walk(-(1-s)*.65);
 // Additional cost-aware quantum walk, followed by a threshold-search update.
 phase(.35);walk(.18+.04*batch);
 grover(energy[best]);
 for(let shot=0;shot<32;shot++){const k=measure();if(energy[k]<energy[best])best=k;}
 trace.push({round:round+1,bestObjective:energy[best]});
}
// Quantum-guided best-first graph exploration: 7-bit basis states are nodes,
// single-bit changes are edges. A priority frontier combines measured probability
// with objective. This is A*-INSPIRED candidate ordering, not an admissible A*
// proof of allocation optimality. Crucially no GLPK is called here.
const quantumWinner=best;
const searched=new Set(),frontier=new Set([best]);
let graphExpansions=0, graphBest=best;
const probabilities=Array.from(re,(v,i)=>v*v+im[i]*im[i]);
while(frontier.size && graphExpansions<18){
 let next=-1,lowest=Infinity;
 for(const k of frontier){
  const score=(energy[k]-lo)/span - 0.04*probabilities[k];
  if(score<lowest){lowest=score;next=k;}
 }
 frontier.delete(next);if(searched.has(next))continue;
 searched.add(next);graphExpansions++;
 if(energy[next]<energy[graphBest])graphBest=next;
 for(let bit=0;bit<7;bit++){const neighbor=next^(1<<bit);if(!searched.has(neighbor))frontier.add(neighbor);}
}
if(energy[graphBest]<energy[best])best=graphBest;
const graphSelected=best;
// No classical optimization candidate or analytical fallback: selection is sampled / graph explored only.
return {quantumWon:best===quantumWinner,classicalCandidateUsed:false,
 graphSearch:{expanded:graphExpansions,graphSelected,quantumSelected:quantumWinner,usedAnalyticalFallback:false},
 batch,weights:candidates[best],objective:energy[best],selectedBasis:best,trace,norm:re.reduce((s,v,i)=>s+v*v+im[i]*im[i],0),durationMs:performance.now()-started};
}
parentPort.on('message',({id,input})=>{
 try{parentPort.postMessage({id,result:execute(input)});}
 catch(e){parentPort.postMessage({id,error:e instanceof Error?e.message:String(e)});}
});
`;
