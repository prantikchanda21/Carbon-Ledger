'use client';

import { motion } from 'framer-motion';
import { Bot, ShieldCheck } from 'lucide-react';
import { useEffect, useId, useState, type CSSProperties } from 'react';
import { cn } from '@/lib/cn';
import { BUDGET_MAX_CR, BUDGET_MIN_CR, SLA_MAX_MS, SLA_MIN_MS } from '@/lib/constants';
import { NET_ZERO_TARGETS, stepAutopilot } from '@/lib/autopilot';
import { useControllerStore } from '@/lib/store';

function SliderField({label,value,min,max,step,display,onChange}:{label:string;value:number;min:number;max:number;step:number;display:string;onChange:(v:number)=>void}) {
  const id=useId(); const fill=((value-min)/(max-min))*100;
  return <div><div className="flex justify-between"><label htmlFor={id} className="text-xs font-medium text-slate-300">{label}</label><span className="text-xs font-semibold text-cyan-200">{display}</span></div><input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e)=>onChange(Number(e.target.value))} className="range-slider mt-3" style={{'--fill':`${fill}%`} as CSSProperties}/></div>;
}
export default function ControlPanel() {
  const controls=useControllerStore((s)=>s.controls); const setControls=useControllerStore((s)=>s.setControls); const ui=useControllerStore((s)=>s.ui); const setUI=useControllerStore((s)=>s.setUI);
  const [auto,setAuto]=useState(false);
  useEffect(()=>{ if(!auto)return; const timer=setInterval(()=>{ const stepped=stepAutopilot(useControllerStore.getState().controls, NET_ZERO_TARGETS); setControls(stepped.controls); if(stepped.done) setAuto(false); },750); return()=>clearInterval(timer); },[auto,setControls]);
  const preset=(kind:1|2|3):void=>{ if(kind===1)setControls({sla_ms:20,carbon_tax:0.8,budget_cr:60,dpdp_locked:true}); if(kind===2)setControls({sla_ms:45,carbon_tax:0.95,budget_cr:75,dpdp_locked:false}); if(kind===3)setControls({sla_ms:70,carbon_tax:0.1,budget_cr:40,dpdp_locked:false}); };
  return <motion.aside initial={{opacity:0,x:-12}} animate={{opacity:1,x:0}} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-[0_16px_50px_-24px_rgba(0,0,0,0.9)] backdrop-blur-xl">
    <div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold">Controller</h2><p className="text-[10px] text-slate-500">live controls</p></div><span className="text-[10px] text-cyan-300">dynamic</span></div>
    <div className="mt-5 space-y-5"><SliderField label="SLA latency" value={controls.sla_ms} min={SLA_MIN_MS} max={SLA_MAX_MS} step={1} display={`${controls.sla_ms} ms`} onChange={(v)=>setControls({sla_ms:v})}/><SliderField label="Carbon tax penalty" value={controls.carbon_tax} min={0} max={1} step={0.01} display={controls.carbon_tax.toFixed(2)} onChange={(v)=>setControls({carbon_tax:v})}/><SliderField label="Treasury budget" value={controls.budget_cr} min={BUDGET_MIN_CR} max={BUDGET_MAX_CR} step={1} display={`₹${controls.budget_cr} Cr`} onChange={(v)=>setControls({budget_cr:v})}/></div>
    <div className="mt-5 rounded-xl border border-white/10 bg-slate-900/50 p-3"><div className="flex items-start gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 text-emerald-300"/><div className="flex-1"><p className="text-xs font-medium">DPDP residency lock</p><p className="mt-1 text-[10px] text-slate-500">India-only placement.</p></div><button type="button" role="switch" aria-checked={controls.dpdp_locked} onClick={()=>setControls({dpdp_locked:!controls.dpdp_locked})} className={cn('h-5 w-9 rounded-full',controls.dpdp_locked?'bg-emerald-500':'bg-slate-700')}><span className={cn('mx-0.5 block h-4 w-4 rounded-full bg-white transition-transform',controls.dpdp_locked?'translate-x-4':'translate-x-0')}/></button></div></div>
    <div className="mt-4 grid grid-cols-3 gap-1.5"><button onClick={()=>preset(1)} className="rounded-lg bg-white/5 px-2 py-2 text-[10px]">1 · Strict</button><button onClick={()=>preset(2)} className="rounded-lg bg-white/5 px-2 py-2 text-[10px]">2 · Green</button><button onClick={()=>preset(3)} className="rounded-lg bg-white/5 px-2 py-2 text-[10px]">3 · Cost</button></div>
    <div className="mt-3 flex gap-2"><button type="button" onClick={()=>setAuto(!auto)} className={cn('flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs',auto?'bg-rose-400/10 text-rose-200':'bg-cyan-400/10 text-cyan-200')}><Bot className="h-4 w-4"/>{auto?'Stop autopilot':'Net-zero autopilot'}</button><button type="button" onClick={()=>setUI({chaosMode:ui.chaosMode==='none'?'onnx':ui.chaosMode==='onnx'?'both':'none'})} className="rounded-xl bg-white/5 px-3 py-2 text-[10px] text-slate-400">Chaos: {ui.chaosMode}</button></div>
    {auto?<div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full bg-emerald-400 transition-all" style={{ width: `${Math.min(100, Math.round((Math.abs(controls.sla_ms - 30) / 70 + Math.abs(controls.carbon_tax - 0.88) + Math.abs(controls.budget_cr - 72) / 100) * 100))}%` }}/></div>:null}
  </motion.aside>;
}
