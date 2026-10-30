'use client';
import {useMemo,useState} from 'react';
import {estimateRisk} from '@/lib/quantumRiskIqae';
import {verifyIqaeRisk} from '@/lib/iqaeVerification';
import type {RiskDecision} from '@/lib/riskAwareAllocation';
export default function QuantumRiskPanel({engine,weights,carbon,latency,sla,scenarioKey,threshold,onThresholdChange,enabled,onEnabledChange,decision}:{engine:string;weights:Record<string,number>;carbon:number;latency:number;sla:number;scenarioKey:string;threshold:number;onThresholdChange:(value:number)=>void;enabled:boolean;onEnabledChange:(value:boolean)=>void;decision:RiskDecision|null}){

 const [verificationRevision,setVerificationRevision]=useState(0);
 const [verificationOpen,setVerificationOpen]=useState(false);
 const seed=useMemo(()=>{let h=2166136261;for(const c of `${engine}:${scenarioKey}`){h=Math.imul(h^c.charCodeAt(0),16777619);}return h>>>0;},[engine,scenarioKey]);
 const measured=useMemo(()=>estimateRisk({weights,carbon,latency,sla,seed},threshold/100),[weights,carbon,latency,sla,seed,threshold]);
 const data=enabled&&decision?decision.after:measured;
 const verification=useMemo(()=>verifyIqaeRisk({weights,carbon,latency,sla,seed},threshold,enabled,decision,`${engine} / ${scenarioKey}`),[weights,carbon,latency,sla,seed,threshold,enabled,decision,engine,scenarioKey,verificationRevision]);
 const passed=verification.checks.filter(c=>c.pass).length;
 const pct=(x:number)=>(x*100).toFixed(2)+'%';
 return <section className="atlas-card space-y-3 p-4" aria-label="Quantum risk intelligence" data-testid="quantum-risk-panel">
 <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-base font-semibold text-white">Quantum Risk Intelligence · risk-aware feedback</h2><p className="text-xs text-slate-300">Engine: {engine} · Live allocation-aware risk estimate</p></div><span className="rounded-md border border-amber-300/40 px-2 py-1 text-xs text-amber-200">CPU simulation</span></div>
 <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">{[['IQAE risk',pct(data.probability)],['Classical Monte Carlo',pct(data.mc)],['Exact model risk',pct(data.exact)],['Decision',enabled&&decision?(decision.status==='reallocated'?'Reallocated':decision.status==='accepted'?'Accepted':'Target unmet'):'Monitoring only']].map(([name,value])=><div key={name} className="rounded-xl border border-white/10 bg-white/5 p-3"><p className="text-xs text-slate-300">{name}</p><p className="mt-1 text-lg font-bold text-white">{value}</p></div>)}</div>
 <div className="flex flex-wrap items-center gap-3 text-xs text-slate-200"><label className="flex items-center gap-2"><input type="checkbox" checked={enabled} onChange={e=>onEnabledChange(e.target.checked)}/>Automatically apply risk-aware allocations</label><label>Risk tolerance <select className="rounded-md bg-slate-900 p-2 text-white" value={threshold} onChange={e=>onThresholdChange(Number(e.target.value))}>{[1,2,3,5,8,10,15,20].map(v=><option key={v} value={v}>{v}%</option>)}</select></label></div>
 {enabled&&decision&&<div className={`rounded-xl border p-3 text-xs ${decision.status==='unresolved'?'border-amber-400/30 bg-amber-400/5 text-amber-50':'border-emerald-400/25 bg-emerald-400/5 text-slate-200'}`}>
  <p className="font-semibold">{decision.status==='unresolved'?'Target unmet · best feasible candidate selected':decision.changed?'Risk-aware reallocation applied':'Original allocation accepted'}</p>
  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
   <div><p className="opacity-75">Requested tolerance</p><p className="text-base font-bold">{threshold}%</p></div>
   <div><p className="opacity-75">Lowest exact risk found</p><p className="text-base font-bold">{pct(decision.lowestRiskFound)}</p></div>
   <div><p className="opacity-75">Applied upper bound</p><p className="text-base font-bold">{pct(decision.after.iqaeInterval[1])}</p></div>
   <div><p className="opacity-75">Cost change</p><p className="text-base font-bold">{decision.costChangePct.toFixed(2)}%</p></div>
  </div>
  <p className="mt-2">{decision.changed?'Allocation updated':'Allocation unchanged'} · {decision.validCandidates} feasible candidates explored ({decision.attempts} unique attempts).</p>
  {decision.status==='unresolved'&&<p className="mt-1 text-amber-200">No evaluated candidate met the risk tolerance based on its simulated IQAE upper bound. The displayed minimum is the lowest exact risk found in the bounded search, not a theoretical minimum or a guarantee of infeasibility.</p>}
  {decision.status!=='unresolved'&&<p className="mt-1 opacity-80">Risk acceptance is based on the simulated IQAE interval, not the Monte Carlo estimate.</p>}
 </div>}
 <p className="text-xs text-slate-300">IQAE interval: {pct(data.iqaeInterval[0])}–{pct(data.iqaeInterval[1])} · MC 95% interval: {pct(data.mcInterval[0])}–{pct(data.mcInterval[1])}.</p>
 <div className="flex flex-wrap gap-3 text-xs text-slate-300"><span>IQAE: {data.iqaeCalls.toLocaleString()} ideal oracle applications</span><span>Monte Carlo: {data.mcCalls.toLocaleString()} samples</span><span>Exact: {data.scenarioCount} states</span></div>

 <div className="rounded-xl border border-cyan-300/25 bg-slate-950/40 p-3 space-y-3" data-testid="iqae-verification-monitor">
  <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-sm font-semibold text-cyan-100">IQAE Live Verification · {passed}/6 passing</h3><p className="text-[11px] text-slate-400">Six automatic checks of live risk behavior</p></div><div className="flex gap-2"><button onClick={()=>setVerificationRevision(v=>v+1)} className="rounded-md border border-cyan-400/40 px-2 py-1 text-xs text-cyan-100">Run checks again</button><button onClick={()=>setVerificationOpen(v=>!v)} className="rounded-md border border-white/20 px-2 py-1 text-xs text-slate-200">{verificationOpen?'Hide details':'Show details'}</button></div></div>
 
  {verificationOpen&&<div className="grid gap-2 md:grid-cols-2">{verification.checks.map(c=><div key={c.id} data-testid={`iqae-check-${c.id}`} className={`rounded-lg border p-2 ${c.pass?'border-emerald-400/25 bg-emerald-400/5':'border-rose-400/30 bg-rose-400/5'}`}><p className={`text-xs font-semibold ${c.pass?'text-emerald-200':'text-rose-200'}`}>{c.pass?'PASS':'FAIL'} · {c.name}</p><p className="mt-1 text-[11px] text-slate-200">{c.observed}</p><p className="mt-1 text-[10px] text-slate-400">Expected: {c.expected}</p></div>)}</div>}

 </div>

 </section>;
}
