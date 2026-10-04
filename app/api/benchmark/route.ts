import { NextResponse } from 'next/server';
import { parseControllerRequest } from '@/lib/validation';
import { assess, buildPolicyFeatures, expandOnnxWeights, unitCost } from '@/lib/controllerMath';
import { runOnnxPolicy } from '@/lib/onnxInference';
import { solveClassicalDispatch } from '@/lib/classicalWasmSolver';
export const runtime='nodejs';
export const maxDuration=30;
export async function POST(request:Request) {
  const body=await request.json().catch(()=>null),parsed=parseControllerRequest(body);
  if(!parsed.ok)return NextResponse.json({error:parsed.error},{status:400});
  const req=parsed.value;
  // Strict feasibility: never relax SLA for this comparison.
  const eligible=req.telemetry.filter(n=>n.available!==false&&n.latency_ms<=req.sla_ms&&(!req.dpdp_locked||['ap-south-1','ap-south-2','asia-south2'].includes(n.region)));
  if(!eligible.length)return NextResponse.json({error:'No strictly feasible regions for this benchmark'},{status:422});
  const all=assess(req).nodes;
  const candidates=all.filter(n=>eligible.some(t=>t.region===n.telemetry.region)).sort((a,b)=>a.unit_cost.total-b.unit_cost.total||a.id.localeCompare(b.id)).slice(0,6);
  const costs=candidates.map(n=>unitCost(n.telemetry,req.carbon_tax).total),ids=candidates.map(n=>n.id);
  const exact=Math.min(...costs),rows=[];
  const row=(engine:string,weights:number[],computeMs:number,initMs:number)=>({engine,weights,computeMs,initMs,cost:weights.reduce((s,w,i)=>s+w*costs[i],0),gapPct:exact>0?(weights.reduce((s,w,i)=>s+w*costs[i],0)-exact)/exact*100:0,feasible:weights.every(w=>Number.isFinite(w)&&w>=0&&w<=1+1e-6)&&Math.abs(weights.reduce((s,w)=>s+w,0)-1)<1e-6});
  try{const r=await solveClassicalDispatch({ids,costs,eligible:ids.map(()=>true),cap:1});rows.push(row('GLPK (cap 1)',r.weights,r.execution_ms,r.init_ms));}catch{rows.push({engine:'GLPK',error:'GLPK could not load; exact enumeration remains available'});}
  const start=performance.now();const exactWeights=costs.map((_,i)=>i===costs.indexOf(exact)?1:0);rows.push(row('Exact enumeration',exactWeights,performance.now()-start,0));
  try{
    const r=await runOnnxPolicy(buildPolicyFeatures(req,all));
    const weights=expandOnnxWeights(r.raw_weights,ids,ids.map(()=>true),candidates);
    if(!weights)throw new Error('No feasible projected weights');
    rows.push(row('ONNX projected to candidates',weights,r.execution_ms,r.init_ms));
  }catch{rows.push({engine:'ONNX',error:'Native runtime/model unavailable; no surrogate measurement fabricated'});}
  return NextResponse.json({ids,costs,exact,rows,request:req,objective:'Expected placement USD/kWh: energy + carbon charge + egress. Sum weights=1, cap=1; no treasury hedge. QAOA penalized circuit energy is excluded.',modelVersion:'bundled-qaoa-reference-v3',createdAt:new Date().toISOString()},{headers:{'cache-control':'no-store'}});
}
