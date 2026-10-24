'use client';
import {useState} from 'react';
import {buildQuantumRequest,submitQuantum} from '@/lib/quantumClient';
import {solveClassicalDispatch} from '@/lib/classicalWasmSolver';
import {cooperativeDispatch,type HybridOutcome} from '@/lib/cooperativeHybrid';
import type {ControlState,GridNodeTelemetry,OptimizationResult} from '@/lib/types';
import {REGIONS} from '@/lib/regions';
import {weightCap} from '@/lib/controllerMath';

export default function CooperativeHybridPanel({telemetry,controls,result}:{telemetry:GridNodeTelemetry[];controls:ControlState;result:OptimizationResult|null}){
 const [running,setRunning]=useState(false);const [out,setOut]=useState<HybridOutcome|null>(null);const [error,setError]=useState('');const [backend,setBackend]=useState('');
 async function run(){setRunning(true);setError('');setOut(null);try{
  if(!result)throw Error('Run the controller before cooperative optimization');
  // Reuse the exact main-controller unit costs and eligibility, not the QAOA's
  // independent score, when evaluating and enforcing the final hybrid allocation.
  const nodes=result.nodes;
  const ids=nodes.map(n=>n.id),eligible=nodes.map(n=>n.eligible),costs=nodes.map(n=>n.unit_cost_usd_per_kwh);
  const cap=weightCap(eligible.filter(Boolean).length);
  const problem={ids,eligible,costs,cap};
  const request=buildQuantumRequest(telemetry,controls,'simulator');
  // Align admissibility to the controller so no quantum proposal bypasses its constraints.
  for(const region of request.regions){const index=ids.indexOf(region.id);region.eligible=index>=0&&eligible[index]!;}
  const quantum=await submitQuantum(request);
  if(quantum.status!=='completed'&&quantum.status!=='done')throw Error(quantum.error||'Quantum solver did not finish');
  const selected=Object.entries(quantum.weights??{}).sort((a,b)=>b[1]!-a[1]!)[0]?.[0];
  const index=ids.findIndex(id=>id===selected);
  if(index<0||!eligible[index])throw Error('Quantum output does not select an eligible controller region');
  const commitment=Math.min(.2,cap*.5);
  const hybrid=await cooperativeDispatch(problem,index,solveClassicalDispatch,commitment);
  setBackend(quantum.backend);setOut(hybrid);
  try {localStorage.setItem('carbon-ledger-hybrid-report',JSON.stringify({quantumRegion:REGIONS[ids[index]!].city,backend:quantum.backend,committedFraction:hybrid.committedFraction,hybridCost:hybrid.hybridCost,classicalCost:hybrid.classicalCost,allocation:hybrid.weights.map((weight,i)=>({region:REGIONS[ids[i]!].city,weight})),trace:hybrid.trace.map(t=>`${t.stage}: ${t.description}`)}));} catch {}
 }catch(e){setError(e instanceof Error?e.message:String(e));}finally{setRunning(false);}}
 function exportResult(){if(!out)return;const file=new Blob([JSON.stringify({kind:'cooperative-hybrid-experiment',backend,regionIds:result?.nodes.map(n=>n.id),...out},null,2)],{type:'application/json'});const url=URL.createObjectURL(file);const a=document.createElement('a');a.href=url;a.download='carbon-ledger-hybrid-run.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 return <section className="space-y-3 text-sm text-slate-200"><p className="text-xs text-slate-400">Joint construction: a quantum placement proposal (preferably the fluid XY microbatch path) reserves a portion of the fleet; GLPK solves the remaining allocations subject to the full controller&apos;s 20-region eligibility and capacity constraints. IBM hardware evidence now validates the fluid microcircuit, while the site still applies the guarded hybrid recommendation rather than claiming a pure-quantum final allocation.</p><button type="button" disabled={running||!result} onClick={run} className="lab-button lab-primary">{running?'Running joint solvers…':'Run cooperative QAOA + GLPK'}</button>{error&&<p role="alert" className="text-rose-300">{error}</p>}{out&&<div className="space-y-3"><div className="grid grid-cols-2 gap-2 md:grid-cols-4">{[['Quantum chosen region',REGIONS[result!.nodes[out.quantumRegionIndex]!.id].city],['Quantum committed share',(out.committedFraction*100).toFixed(1)+'%'],['Joint modeled unit cost',out.hybridCost.toFixed(5)],['Classical baseline',out.classicalCost.toFixed(5)]].map(([label,value])=><div key={label} className="rounded-lg border border-white/10 p-3"><p className="text-xs text-slate-400">{label}</p><p className="mt-1 font-semibold">{value}</p></div>)}</div><p className="text-xs text-slate-400">Backend: {backend}. Hybrid cost gap vs GLPK: {out.classicalCost>0?((out.hybridCost/out.classicalCost-1)*100).toFixed(2):'n/a'}%. This does not demonstrate quantum advantage.</p><div className="grid gap-2 md:grid-cols-2">{out.weights.map((w,i)=>w>1e-5?<div key={i} className="flex justify-between rounded-lg bg-white/5 px-3 py-2"><span>{REGIONS[result!.nodes[i]!.id].city}</span><span>{(w*100).toFixed(1)}%</span></div>:null)}</div><h4 className="font-semibold">Joint execution trace</h4>{out.trace.map(t=><p key={t.step} className="rounded-lg bg-white/5 px-3 py-2 text-xs"><strong>{t.step}. {t.stage}</strong> — {t.description}</p>)}<button type="button" className="lab-button" onClick={exportResult}>Export hybrid results JSON</button></div>}</section>;
}
