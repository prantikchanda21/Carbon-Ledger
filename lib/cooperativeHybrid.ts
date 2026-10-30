import type { DispatchProblem, ClassicalOutput } from './optimizer.ts';
import {capacityAt} from './fractionalAllocation.ts';

export interface HybridTrace {step:number;stage:'quantum'|'classical'|'validation';description:string;}
export interface HybridOutcome {weights:number[];classicalWeights:number[];quantumRegionIndex:number;committedFraction:number;hybridCost:number;classicalCost:number;quantumCandidateCost:number;quantumDifference:number;feasible:boolean;reusedBaseline:boolean;qualityGuardRejected?:boolean;trace:HybridTrace[];}

/** Quantum commits a discrete placement and GLPK optimizes the remaining continuous LP.
 * Unlike convex score-blending, each solver determines a nontrivial decision.
 * This method is a hybrid heuristic; the GLPK baseline may still be globally superior.
 */
export async function cooperativeDispatch(problem:DispatchProblem, quantumRegionIndex:number, classical:(p:DispatchProblem)=>Promise<ClassicalOutput>, commitment=0.2, qualityGuard=false):Promise<HybridOutcome>{
 const {costs,eligible,ids}=problem;
 if(!Number.isInteger(quantumRegionIndex)||quantumRegionIndex<0||quantumRegionIndex>=ids.length||!eligible[quantumRegionIndex])throw new Error('Quantum-selected region is not eligible');
 if(!(commitment>0&&commitment<1)||commitment>capacityAt(problem,quantumRegionIndex)+1e-9)throw new Error('Quantum commitment exceeds allowable cap');
 const classicalResult=await classical(problem);
 const fraction=commitment;
 // GLPK solves normalized remainder subject to actual residual capacities.
 // Bounds are heterogeneous after a quantum commitment; transform their individual
 // capacity restrictions through an eligible subset LP with a custom GLPK adapter.
 // An optimal baseline that already satisfies the new lower bound remains optimal
 // on the restricted feasible set. Reuse it only after validating all constraints.
 const baseline=classicalResult.weights;
 const baselineValid=baseline.length===ids.length&&baseline.every((w,i)=>Number.isFinite(w)&&w>=-1e-8&&w<=capacityAt(problem,i)+1e-8&&(eligible[i]||Math.abs(w)<1e-8))&&Math.abs(baseline.reduce((a,b)=>a+b,0)-1)<1e-8;
 const reusedBaseline=baselineValid&&baseline[quantumRegionIndex]>=fraction;
 // An unrestricted optimum cannot be improved by adding a lower bound.
 // In guarded mode retain it immediately when it does not support the proposal,
 // avoiding a residual solve whose answer would be discarded by the API.
 const qualityGuardRejected=qualityGuard&&baselineValid&&!reusedBaseline;
 const weights=(reusedBaseline||qualityGuardRejected)?baseline.slice():(await solveResidualLP(problem,quantumRegionIndex,fraction)).map((w,i)=>w+(i===quantumRegionIndex?fraction:0));
 const feasible=weights.every((v,i)=>Number.isFinite(v)&&v>=-1e-8&&v<=capacityAt(problem,i)+1e-7&&(eligible[i]||Math.abs(v)<1e-8))&&Math.abs(weights.reduce((a,b)=>a+b,0)-1)<1e-7;
 if(!feasible)throw new Error('The joint allocation failed capacity or eligibility validation');
 const cost=(w:number[])=>w.reduce((s,v,i)=>s+v*costs[i]!+(problem.preferred?(problem.regularization??0)*Math.abs(v-problem.preferred[i]!):0),0);
 return {weights,classicalWeights:classicalResult.weights,quantumRegionIndex,committedFraction:qualityGuardRejected?0:fraction,hybridCost:cost(weights),classicalCost:cost(classicalResult.weights),quantumCandidateCost:costs[quantumRegionIndex]!,quantumDifference:weights[quantumRegionIndex]!-classicalResult.weights[quantumRegionIndex]!,feasible,reusedBaseline:reusedBaseline||qualityGuardRejected,qualityGuardRejected,trace:[
 {step:1,stage:'quantum',description:qualityGuardRejected?'QAOA proposal declined: the unrestricted GLPK optimum does not support the requested commitment.':`QAOA sampled eligible ${ids[quantumRegionIndex]} and committed ${(100*fraction).toFixed(0)}% of the fleet (discrete placement decision).`},
 {step:2,stage:'classical',description:qualityGuardRejected?'Quality guard retained the unrestricted optimum without an unnecessary residual solve.':reusedBaseline?'The optimal GLPK baseline already satisfies the quantum commitment; reused it without a redundant residual solve.':'GLPK solved the remaining allocation with the QAOA placement fixed and all 20 regional capacity/eligibility constraints enforced.'},
 {step:3,stage:'validation',description:'Verified the complete allocation sums to 100% and respects per-region caps and eligibility.'}
 ]};
}

async function solveResidualLP(p:DispatchProblem,chosen:number,commitment:number):Promise<number[]>{
 const {solveResidualDispatch}=await import('./hybridResidualGlpk.ts');
 return solveResidualDispatch(p,chosen,commitment);
}
