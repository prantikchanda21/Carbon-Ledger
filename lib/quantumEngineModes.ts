/** Small, exact statevector implementations for the 20-region cooperative engine.
 * Each five-region batch is a separate 5-qubit circuit; neither method claims
 * a 20-qubit statevector or physical fluid/gas qubits.
 */
/** Only production-selectable engines. Historical solvers are not routable. */
export const ACTIVE_ENGINES = ['glpk','oracle','geometry-curved','geometry-grover','geometry'] as const;
export type EngineMode = typeof ACTIVE_ENGINES[number];
export const ENGINE_LABELS:Record<EngineMode,string> = {
 oracle:'Quantum Oracle · Grover 7q p=3',
 geometry:'Geometry-Aware XY Walk · 10q p=3',
 'geometry-grover':'Adaptive Grover · 10 qubits · p=3',
 'geometry-curved':'Curvilinear Quantum Fusion · 10 qubits · p=3',
 glpk:'GLPK · classical reference'
};
export function validEngineMode(value:unknown):value is EngineMode {
 return typeof value==='string' && (ACTIVE_ENGINES as readonly string[]).includes(value);
}
/** Compile the diagonal once per optimization, then reuse typed buffers.
 * XY stays exactly in the single-excitation subspace (at most five amplitudes).
 * X mixing still evolves all 2^n amplitudes; no truncation or result cache.
 */
function compileCircuit(costs:number[],eligible:boolean[],mode:'fluid'|'gaseous'){
 const n=costs.length,fluid=mode==='fluid',size=fluid?n:1<<n;
 const valid=eligible.flatMap((yes,i)=>yes?[i]:[]);
 const lo=Math.min(...valid.map(i=>costs[i])),hi=Math.max(...valid.map(i=>costs[i]));
 const normalized=costs.map(c=>(c-lo)/Math.max(hi-lo,1e-9));
 const energy=new Float64Array(size),re=new Float64Array(size),im=new Float64Array(size);
 if(fluid){energy.set(normalized);}else{
  for(let mask=0;mask<size;mask++){
   let count=0,sum=0,invalid=0;
   for(let i=0;i<n;i++)if(mask&(1<<i)){count++;sum+=normalized[i];if(!eligible[i])invalid++;}
   energy[mask]=sum+3*Math.abs(count-1)+6*invalid;
  }
 }
 const rotate=(a:number,b:number,c:number,s:number)=>{
  const ar=re[a],ai=im[a],br=re[b],bi=im[b];
  re[a]=c*ar+s*bi;im[a]=c*ai-s*br;re[b]=c*br+s*ai;im[b]=c*bi-s*ar;
 };
 return (gamma:number,beta:number)=>{
  re.fill(fluid?0:1/Math.sqrt(size));im.fill(0);
  if(fluid)for(const i of valid)re[i]=1/Math.sqrt(valid.length);
  for(let layer=0;layer<3;layer++){
   const g=gamma*(1+.12*layer),b=beta*(1-.08*layer);
   for(let i=0;i<size;i++){
    const angle=-g*energy[i],c=Math.cos(angle),s=Math.sin(angle),r=re[i],m=im[i];
    re[i]=r*c-m*s;im[i]=r*s+m*c;
   }
   const theta=fluid?b/Math.max(1,n-1):b,c=Math.cos(theta),s=Math.sin(theta);
   if(fluid){
    for(let a=0;a<valid.length;a++)for(let b=a+1;b<valid.length;b++)rotate(valid[a],valid[b],c,s);
   }else{
    for(let q=0;q<n;q++){
     const stride=1<<q;
     for(let base=0;base<size;base+=2*stride)for(let offset=0;offset<stride;offset++)rotate(base+offset,base+offset+stride,c,s);
    }
   }
  }
  return eligible.map((yes,i)=>{const j=fluid?i:1<<i;return yes?re[j]**2+im[j]**2:0;});
 };
}
export type QuantumCandidate = {index:number;probability:number;method:string;optimizerEvals:number;expectedCost:number;classicalBestIndex:number;quantumChangedSelection:boolean;candidateScore:number;batchCount:number};
/** Bounded deterministic coordinate optimization, minimizing conditional expected
 * normalized cost on valid one-hot samples. The gas mode uses Boltzmann weights
 * as a sampling policy, not a physical gaseous-qubit claim. */
/** Resource-capped, deterministic angle tuning. Never report cached/early-stopped
 * evaluations as full independent optimizer runs. The caps apply per 5-qubit batch.
 */
function tunedBatch(costs:number[],allowed:boolean[],mode:'fluid'|'gaseous'){
 const valid=costs.flatMap((c,i)=>allowed[i]?[i]:[]);
 if(valid.length===1){
  const probabilities=costs.map((_,i)=>i===valid[0]?1:0);
  return {probabilities,optimizerEvals:0,expectedCost:0};
 }
 const min=Math.min(...valid.map(i=>costs[i])), max=Math.max(...valid.map(i=>costs[i]));
 const energy=costs.map(c=>(c-min)/Math.max(1e-9,max-min));
 const circuit=compileCircuit(costs,allowed,mode);
 const cache=new Map<string,{g:number;b:number;probs:number[];objective:number;mass:number}>();
 let evaluations=0;
 const calculate=(g:number,b:number)=>{
  g=Math.max(0,Math.min(Math.PI,g));b=Math.max(0,Math.min(Math.PI/2,b));
  const key=`${g.toFixed(8)}:${b.toFixed(8)}`;
  const hit=cache.get(key);if(hit)return hit;
  const probs=circuit(g,b);
  evaluations++;
  const mass=valid.reduce((a,i)=>a+probs[i],0);
  const conditional=valid.reduce((a,i)=>a+probs[i]*energy[i],0)/Math.max(mass,1e-12);
  const objective=conditional+(mode==='gaseous'?0.35*(1-mass):0);
  const result={g,b,probs,objective,mass};cache.set(key,result);return result;
 };
 // Initial seeds plus bounded local coordinate search. For a five-qubit
 // circuit a larger search budget usually costs more than the GLPK solve.
 const starts:[[number,number],[number,number]]=[[.35,.45],[1.25,.9]];
 let best:ReturnType<typeof calculate>|undefined;
 const maximum=mode==='fluid'?24:32;
 for(const [g0,b0] of starts){
  if(evaluations>=maximum)break;
  let candidate=calculate(g0,b0);
  for(const step of [.4,.15]){
   if(evaluations>=maximum)break;
   const previous=candidate;
   for(const [dg,db] of [[step,0],[-step,0],[0,step],[0,-step]] as const){
    if(evaluations>=maximum)break;
    const trial=calculate(candidate.g+dg,candidate.b+db);
    if(trial.objective<candidate.objective-1e-10)candidate=trial;
   }
   if(candidate===previous)break;
  }
  if(!best||candidate.objective<best.objective)best=candidate;
  if(best.objective<1e-4)break;
 }
 if(!best)throw Error('QAOA parameter optimization failed');
 return {probabilities:best.probs,optimizerEvals:evaluations,expectedCost:best.objective};
}

export function flowGasCandidate(costs:number[],eligible:boolean[],mode:'fluid'|'gaseous'):QuantumCandidate{
 if(costs.length!==eligible.length||!costs.length||!costs.every(Number.isFinite)||!eligible.some(Boolean))throw Error('Invalid QAOA candidate problem');
 const globalMin=Math.min(...costs.filter((_,i)=>eligible[i]));
 const globalMax=Math.max(...costs.filter((_,i)=>eligible[i]));
 const spread=Math.max(globalMax-globalMin,1e-9);
 const rows:{index:number;probability:number;score:number;expectedCost:number}[]=[];
 let optimizerEvals=0,batchCount=0;
 for(let start=0;start<costs.length;start+=5){
  const localCosts=costs.slice(start,start+5),allowed=eligible.slice(start,start+5);
  if(!allowed.some(Boolean))continue;
  const tuned=tunedBatch(localCosts,allowed,mode);
  optimizerEvals+=tuned.optimizerEvals;batchCount++;
  // Candidate choice is a tradeoff between original global objective and
  // the conditional quantum sampling probability. Never sort by cost alone.
  const validMass=allowed.reduce((total,on,i)=>total+(on?tuned.probabilities[i]:0),0);
  for(let i=0;i<localCosts.length;i++)if(allowed[i]){
   let prob=tuned.probabilities[i]/Math.max(validMass,1e-12);
   if(mode==='gaseous'){
    // Gas-inspired temperature weighting is explicitly classical post-processing.
    const localMin=Math.min(...localCosts.filter((_,j)=>allowed[j]));
    prob*=Math.exp(-0.65*(localCosts[i]-localMin)/spread);
   }
   const relativeCost=(localCosts[i]-globalMin)/spread;
   const score=relativeCost+0.22*(-Math.log(Math.max(prob,1e-12)));
   rows.push({index:start+i,probability:tuned.probabilities[i],score,expectedCost:tuned.expectedCost});
  }
 }
 rows.sort((a,b)=>a.score-b.score||a.index-b.index);
 const chosen=rows[0];if(!chosen)throw Error('No eligible quantum candidate');
 const classicalBestIndex=eligible.map((ok,i)=>ok?i:-1).filter(i=>i>=0).sort((a,b)=>costs[a]-costs[b]||a-b)[0];
 return {index:chosen.index,probability:chosen.probability,method:mode==='fluid'?'5-qubit XY-exchange p=3 with adaptive angle search and probability-aware selection':'5-qubit X-mixer p=3 with adaptive angle search and gas-inspired classical reweighting',optimizerEvals,expectedCost:chosen.expectedCost,classicalBestIndex,quantumChangedSelection:chosen.index!==classicalBestIndex,candidateScore:chosen.score,batchCount};
}
