import {geometryQuantumAllocation} from '@/lib/geometryQuantum';
import {quantumOracleAllocation} from '@/lib/quantumOracleEngine';
import {NextResponse} from 'next/server';
import {validEngineMode,ENGINE_LABELS} from '@/lib/quantumEngineModes';
import {solveClassicalDispatch} from '@/lib/classicalWasmSolver';
import {dynamicAllocationScores} from '@/lib/dynamicAllocation';
import {fractionalAllocationPolicy} from '@/lib/fractionalAllocation';
import type {ControlState,NodeReport,GridNodeTelemetry} from '@/lib/types';
export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=60;
/** Five selectable engines only. Independent modes never silently replace their result with GLPK. */
export async function POST(req:Request){
 const started=performance.now();
 try{
  const body=await req.json() as {telemetry:GridNodeTelemetry[];controls:ControlState;nodes:NodeReport[];engine?:string;researchDiagnostics?:boolean};
  if(!Array.isArray(body.telemetry)||body.telemetry.length!==20||!Array.isArray(body.nodes)||body.nodes.length!==20||!body.controls||!Number.isFinite(body.controls.sla_ms)||!Number.isFinite(body.controls.carbon_tax)||!Number.isFinite(body.controls.budget_cr))return NextResponse.json({error:'Valid 20-region telemetry, nodes and controls are required'},{status:400});
  const mode=body.engine??'glpk';
  if(!validEngineMode(mode))return NextResponse.json({error:'Unknown or retired engine mode'},{status:400});
  const ids=body.nodes.map(n=>n.id),eligible=body.nodes.map(n=>n.eligible),scores=dynamicAllocationScores(body.nodes,body.controls);
  const policy=fractionalAllocationPolicy(body.nodes,body.controls,scores);
  if(policy.caps.reduce((a,b)=>a+b,0)<1-1e-8)return NextResponse.json({error:'Insufficient eligible capacity'},{status:422});
  const problem={ids,eligible,costs:scores,cap:1,caps:policy.caps,preferred:policy.preferred,regularization:policy.regularization};
  const objective=(weights:number[])=>weights.reduce((s,w,i)=>s+w*scores[i]+policy.regularization*Math.abs(w-policy.preferred[i]),0);
  if(mode==='glpk'){
   const baseline=await solveClassicalDispatch(problem);const value=objective(baseline.weights);
   return NextResponse.json({engineRequested:mode,engineUsed:'glpk',engineLabel:ENGINE_LABELS.glpk,fallbackReason:null,outcome:{weights:baseline.weights,classicalWeights:baseline.weights,quantumRegionIndex:-1,committedFraction:0,hybridCost:value,classicalCost:value,quantumCandidateCost:0,quantumDifference:0,feasible:true,reusedBaseline:true,trace:[{step:1,stage:'classical',description:'Independent GLPK reference optimization; no quantum circuits.'}]},timing:{serverComputeMs:performance.now()-started,includesNetwork:false},allocationPolicy:{capacitySource:policy.capacitySource}},{headers:{'Cache-Control':'no-store'}});
  }
  const input={costs:scores,caps:policy.caps,preferred:policy.preferred,regularization:policy.regularization};
  if(mode==='oracle'){
   const run=quantumOracleAllocation(input);
   const trace=[{step:1,stage:'encoding',description:'Classical cost-aware feasible candidate encoding (4 × 128 basis states)'},{step:2,stage:'quantum',description:'Four 7-qubit CPU statevector Grover simulations at depth 3, 32 measurements per register'},{step:3,stage:'validation',description:'Select the best measured feasible candidate; no GLPK allocation fallback'}];
   return NextResponse.json({engineRequested:mode,engineUsed:mode,engineLabel:ENGINE_LABELS.oracle,fallbackReason:null,outcome:{weights:run.weights,classicalWeights:[],quantumRegionIndex:-1,committedFraction:0,hybridCost:run.objective,classicalCost:null,quantumCandidateCost:run.objective,quantumDifference:0,feasible:run.feasible,reusedBaseline:false,trace},selectionDiagnostics:{qubitsPerBatch:7,parallelBatches:4,p:3,backend:'CPU statevector simulation',shotsPerRegister:32,classicalOptimizerUsed:false,selectedBasis:run.basis,batches:run.batches},timing:{serverComputeMs:performance.now()-started,includesNetwork:false},method:run.method,allocationPolicy:{capacitySource:policy.capacitySource}},{headers:{'Cache-Control':'no-store'}});
  }
  const variant=mode==='geometry-curved'?'fusion':mode==='geometry-grover'?'grover':'geometry';
  const run=await geometryQuantumAllocation(input,variant);
  const trace=[{step:1,stage:'encoding',description:'Classical cost-aware feasible allocation encoding; each 10-qubit register uses 252 five-excitation basis states'},{step:2,stage:'quantum',description:mode==='geometry-curved'?'Four workers, each running a depth-3 curved XY phase circuit and an adaptive Grover circuit':mode==='geometry-grover'?'Four 10-qubit depth-3 adaptive Grover simulations':'Four 10-qubit depth-3 cost-phase/XY-exchange/Grover simulations'},{step:3,stage:'validation',description:'Measured candidate selection and capacity validation, without GLPK solution fallback'}];
  return NextResponse.json({engineRequested:mode,engineUsed:mode,engineLabel:ENGINE_LABELS[mode],fallbackReason:null,outcome:{weights:run.weights,classicalWeights:[],quantumRegionIndex:-1,committedFraction:0,hybridCost:run.objective,classicalCost:null,quantumCandidateCost:run.objective,quantumDifference:0,feasible:run.feasible,reusedBaseline:false,trace},selectionDiagnostics:{qubitsPerBatch:10,parallelBatches:4,p:3,backend:'CPU statevector simulation',variant,shotsPerRegister:run.allBatches.map(b=>b.shots),simulationCount:run.allBatches.length,validBasisStates:252,classicalOptimizerUsed:false,selectedBasis:run.selectedBasis,batches:run.allBatches},timing:{serverComputeMs:performance.now()-started,includesNetwork:false},method:run.method,allocationPolicy:{capacitySource:policy.capacitySource}},{headers:{'Cache-Control':'no-store'}});
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Engine calculation failed; no silent GLPK fallback'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
