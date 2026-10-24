'use client';
import {Atom, CheckCircle2, Loader2, AlertTriangle} from 'lucide-react';
import type {OptimizationResult} from '@/lib/types';
import type {HybridOutcome} from '@/lib/cooperativeHybrid';
type CooperativeRun={key:string;outcome:HybridOutcome;candidates:string[];batchCandidates:Array<{batch:number;region:string}>;snapshot:OptimizationResult};
export default function QuantumController({cooperativeResult,cooperative,busy,error,isCurrent}:{
 cooperativeResult:OptimizationResult|null;cooperative:CooperativeRun|null;busy:boolean;error:string;isCurrent:boolean;
}){
 const valid=Boolean(cooperative?.outcome.feasible && cooperativeResult);
 const rows=Object.entries(cooperativeResult?.allocations.node_weights??{}).filter(([,v])=>v>1e-5).sort((a,b)=>b[1]-a[1]);
 return <section className="rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.035] p-3">
 <div className="flex flex-wrap items-center gap-2"><Atom className="h-4 w-4 text-cyan-200"/><h3 className="text-sm font-semibold text-white">Cooperative QAOA + GLPK · Dynamic Allocation</h3><span className="rounded-full border border-violet-300/20 bg-violet-300/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[.18em] text-violet-100">IBM validated microcircuit</span><span className="ml-auto text-xs text-cyan-200">{busy?<><Loader2 className="mr-1 inline h-3 w-3 animate-spin"/>Running</>:valid?<><CheckCircle2 className="mr-1 inline h-3 w-3"/>{isCurrent?'Validated and active':'Saved run · inputs changed'}</>:error?'Safety baseline active':'Not run yet'}</span></div>
 <p className="mt-1 text-[11px] text-slate-400">20 cloud regions · preferred path: 4× five-region fluid microbatches · quantum discrete candidate selection · GLPK residual refinement</p>
 <div className="mt-3 grid gap-2 sm:grid-cols-3"><div className="rounded-lg bg-black/15 p-2 text-xs"><span className="text-slate-400">Quantum candidate</span><p className="mt-1 font-medium text-cyan-200">{valid?cooperativeResult?.nodes[cooperative!.outcome.quantumRegionIndex]?.id:'—'}</p></div><div className="rounded-lg bg-black/15 p-2 text-xs"><span className="text-slate-400">QAOA commitment</span><p className="mt-1 text-white">{valid?`${(cooperative!.outcome.committedFraction*100).toFixed(1)}%`:'—'}</p></div><div className="rounded-lg bg-black/15 p-2 text-xs"><span className="text-slate-400">Allocation status</span><p className="mt-1 text-white">{valid?'Feasible · GLPK validated':busy?'Optimising…':'Awaiting execution'}</p></div></div>
 {cooperative?.batchCandidates?.length?<div className="mt-3 grid gap-2 sm:grid-cols-4">{cooperative.batchCandidates.map(c=><div className="rounded-lg border border-white/10 p-2 text-xs" key={c.batch}><span className="text-slate-400">Batch {c.batch}</span><p className="mt-1 text-cyan-200">{c.region}</p></div>)}</div>:null}
 {valid?<div className="mt-3 grid gap-2 sm:grid-cols-3 xl:grid-cols-5">{rows.map(([id,weight])=><div key={id} className="rounded-lg bg-black/15 p-2"><div className="flex justify-between text-[11px] text-slate-200"><span>{id}</span><span>{(weight*100).toFixed(1)}%</span></div><div className="mt-2 h-1.5 rounded-full bg-slate-800"><div className="h-full rounded-full bg-cyan-400" style={{width:`${Math.min(100,weight*100)}%`}}/></div></div>)}</div>:<p className="mt-3 rounded-lg border border-dashed border-cyan-300/20 p-3 text-xs text-slate-300">{busy?'Calculating quantum candidates and constrained regional percentages…':'Click Run QAOA + GLPK to produce a cooperative allocation. A separately labeled safety preview may appear in the wider dashboard until this completes.'}</p>}
 {!isCurrent&&valid?<p className="mt-2 text-xs text-amber-200">Inputs have changed. Saved allocation is for the previous scenario and is not applied to the live dashboard.</p>:null}
 {error?<p role="alert" className="mt-2 flex items-center gap-2 text-xs text-amber-200"><AlertTriangle className="h-4 w-4"/>{error}</p>:null}
 </section>;
}
