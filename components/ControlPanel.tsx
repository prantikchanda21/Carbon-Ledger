'use client';
import { budgetLabel, budgetMillion, millionToCr } from '@/lib/budgetUsd';

import { motion } from 'framer-motion';
import { Bot, ShieldCheck } from 'lucide-react';
import { useId, type CSSProperties } from 'react';
import { cn } from '@/lib/cn';
import { BUDGET_MAX_CR, BUDGET_MIN_CR, SLA_MAX_MS, SLA_MIN_MS } from '@/lib/constants';
import { recommendAdaptiveAutopilot } from '@/lib/autopilot';
import { useControllerStore } from '@/lib/store';

function SliderField({label,value,min,max,step,display,onChange}:{label:string;value:number;min:number;max:number;step:number;display:string;onChange:(v:number)=>void}) {
  const id=useId(); const fill=((value-min)/(max-min))*100;
  return <div><div className="flex justify-between"><label htmlFor={id} className="text-xs font-medium text-slate-300">{label}</label><span className="text-xs font-semibold text-cyan-200">{display}</span></div><input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e)=>onChange(Number(e.target.value))} className="range-slider mt-3" style={{'--fill':`${fill}%`} as CSSProperties}/></div>;
}
export default function ControlPanel() {
  const controls=useControllerStore((s)=>s.controls); const setControls=useControllerStore((s)=>s.setControls);
  const auto=useControllerStore((s)=>s.autopilotActive);
  const autoStart=useControllerStore((s)=>s.autopilotStart);
  const feed=useControllerStore((s)=>s.telemetry);
  const recommendation=recommendAdaptiveAutopilot(controls,autoStart??controls,feed);
  const setAutopilotActive=useControllerStore((s)=>s.setAutopilotActive);
  const manuallySetControls=(patch:Parameters<typeof setControls>[0])=>{ setAutopilotActive(false); setControls(patch); };
  const preset=(kind:1|2|3):void=>{ if(kind===1)manuallySetControls({sla_ms:20,carbon_tax:0.8,budget_cr:millionToCr(20),dpdp_locked:true}); if(kind===2)manuallySetControls({sla_ms:45,carbon_tax:0.95,budget_cr:millionToCr(60),dpdp_locked:false}); if(kind===3)manuallySetControls({sla_ms:70,carbon_tax:0.1,budget_cr:millionToCr(10),dpdp_locked:false}); };
  return <motion.aside initial={{opacity:0,x:-12}} animate={{opacity:1,x:0}} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-[0_16px_50px_-24px_rgba(0,0,0,0.9)] backdrop-blur-xl">
    <div className="flex items-center justify-between"><h2 className="text-sm font-semibold">Controls</h2></div>
    <div className="mt-5 space-y-5"><SliderField label="Max latency" value={controls.sla_ms} min={SLA_MIN_MS} max={SLA_MAX_MS} step={1} display={`${controls.sla_ms} ms`} onChange={(v)=>manuallySetControls({sla_ms:v})}/><SliderField label="Carbon penalty" value={controls.carbon_tax} min={0} max={1} step={0.01} display={controls.carbon_tax.toFixed(2)} onChange={(v)=>manuallySetControls({carbon_tax:v})}/><SliderField label="Annual treasury capital (USD)" value={budgetMillion(controls.budget_cr)} min={5} max={100} step={5} display={budgetLabel(controls.budget_cr)} onChange={(v)=>manuallySetControls({budget_cr:millionToCr(v)})}/></div>
    <div className="mt-5 rounded-xl border border-white/10 bg-slate-900/50 p-3"><div className="flex items-start gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 text-emerald-300"/><div className="flex-1"><p className="text-xs font-medium">Keep data in India</p></div><button type="button" role="switch" aria-checked={controls.dpdp_locked} onClick={()=>manuallySetControls({dpdp_locked:!controls.dpdp_locked})} className={cn('h-5 w-9 rounded-full',controls.dpdp_locked?'bg-emerald-500':'bg-slate-700')}><span className={cn('mx-0.5 block h-4 w-4 rounded-full bg-white transition-transform',controls.dpdp_locked?'translate-x-4':'translate-x-0')}/></button></div></div>
    <div className="mt-4 grid grid-cols-3 gap-1.5"><button onClick={()=>preset(1)} className="rounded-lg bg-white/5 px-2 py-2 text-xs">Strict</button><button onClick={()=>preset(2)} className="rounded-lg bg-white/5 px-2 py-2 text-xs">Greenest</button><button onClick={()=>preset(3)} className="rounded-lg bg-white/5 px-2 py-2 text-xs">Cheapest</button></div>
    <div className="mt-3 flex gap-2"><button type="button" onClick={()=>setAutopilotActive(!auto)} className={cn('flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs',auto?'bg-rose-400/10 text-rose-200':'bg-cyan-400/10 text-cyan-200')}><Bot className="h-4 w-4"/>{auto?'Stop adaptive Autopilot':'Start adaptive Autopilot'}</button></div>
    {auto?<div role="status" aria-live="polite" className="mt-3 space-y-1 rounded-lg border border-emerald-400/20 bg-emerald-400/5 px-3 py-2 text-xs text-emerald-100"><p className="font-semibold">Continuous condition-aware mode · monitoring</p><p>{recommendation.reason}</p><p className="text-slate-300">Suggested: SLA {recommendation.target.sla_ms} ms · carbon {recommendation.target.carbon_tax.toFixed(2)} · modeled capital {budgetLabel(recommendation.target.budget_cr)}</p><p className="text-slate-400">All four KPI cards update after each solver cycle. Capital is illustrative; no investment transactions occur.</p></div>:null}
  </motion.aside>;
}
