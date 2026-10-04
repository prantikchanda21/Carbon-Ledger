'use client';

import { X, ShieldCheck, Ban, TrendingDown } from 'lucide-react';
import type { OptimizationResult, RegionId } from '@/lib/types';
import { REGIONS } from '@/lib/regions';
import { carbonAt, priceAt } from '@/lib/mockData';

export default function RegionDrawer({ id, result, onClose, hour, carbonTax }: { carbonTax?: number; id: RegionId|null; result: OptimizationResult|null; onClose:()=>void; hour:number }) {
  if(!id) return null;
  const meta=REGIONS[id]; const node=result?.nodes.find(n=>n.id===id); const excluded=Boolean(node && !node.eligible);
  const history=Array.from({length:24},(_,i)=>({h:i,ci:Math.round(carbonAt(id,i)),price:Math.round(priceAt(id,i))}));
  return <aside className="h-full overflow-auto rounded-2xl border border-white/10 bg-slate-950/95 p-4 shadow-xl backdrop-blur-2xl" aria-label={`${meta.city} region details`}>
    <div className="flex items-start justify-between"><div><p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{meta.provider} · {meta.code} · {node?.source ?? 'mock'}</p><h2 className="mt-1 text-xl font-semibold">{meta.city}</h2></div><button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg bg-white/5"><X className="h-4 w-4"/></button></div>
    <div className="mt-4 grid grid-cols-3 gap-2 text-xs"><div className="rounded-xl bg-white/[0.04] p-2"><span className="text-slate-500">Carbon</span><b className="mt-1 block">{node?.carbon_ci.toFixed(0)??Math.round(carbonAt(id,hour))}</b></div><div className="rounded-xl bg-white/[0.04] p-2"><span className="text-slate-500">Price</span><b className="mt-1 block">${node?.energy_price.toFixed(0)??Math.round(priceAt(id,hour))}</b></div><div className="rounded-xl bg-white/[0.04] p-2"><span className="text-slate-500">Weight</span><b className="mt-1 block">{Math.round((node?.weight??0)*100)}%</b></div></div>
    <div className="mt-4 rounded-xl border border-white/5 bg-slate-900/60 p-3"><div className="flex items-center gap-2 text-sm">{excluded?<Ban className="h-4 w-4 text-rose-300"/>:<ShieldCheck className="h-4 w-4 text-emerald-300"/>}<span>{excluded?'Excluded':'Chosen / eligible'}</span></div><p className="mt-2 text-xs text-slate-500">{node?.exclusion_reason??`Chosen because it balances carbon, energy price, latency and egress at ${hour}:00Z.`}</p></div>
    <div className="mt-4"><h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">24h profile</h3><svg viewBox="0 0 240 70" className="w-full"><line x1={hour/23*240} x2={hour/23*240} y1="0" y2="70" stroke="#fbbf24" strokeDasharray="2 2" strokeWidth="1"/><polyline fill="none" stroke="#34d399" strokeWidth="2" points={history.map((p,i)=>`${i/23*240},${68-p.ci/1000*55}`).join(' ')}/><polyline fill="none" stroke="#22d3ee" strokeWidth="1.5" points={history.map((p,i)=>`${i/23*240},${68-p.price/140*40}`).join(' ')}/></svg></div>
    <div className="mt-4 grid grid-cols-3 gap-2 text-xs"><div className="rounded-xl bg-white/[0.04] p-2"><span className="text-slate-500">Energy</span><b className="mt-1 block">${((node?.energy_price??priceAt(id,hour))/1000).toFixed(3)}/kWh</b></div><div className="rounded-xl bg-white/[0.04] p-2"><span className="text-slate-500">Carbon tax</span><b className="mt-1 block">{carbonTax === undefined ? 'variable' : carbonTax.toFixed(2)}</b></div><div className="rounded-xl bg-white/[0.04] p-2"><span className="text-slate-500">Egress</span><b className="mt-1 block">${((node?.unit_cost_usd_per_kwh??0)*0.05).toFixed(3)}</b></div></div>
    <p className="mt-4 text-xs text-slate-600"><TrendingDown className="mr-1 inline h-3.5 w-3.5"/>Live selection reasoning updates with every simulation tick.</p>
  </aside>;
}
