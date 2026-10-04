'use client';

import { GitCompare } from 'lucide-react';
import { useControllerStore } from '@/lib/store';

export default function ScenarioCompare() {
  const a = useControllerStore((s) => s.scenarioA);
  const b = useControllerStore((s) => s.scenarioB);
  if (!a || !b) return <section className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-4 text-xs text-slate-500"><GitCompare className="mb-2 h-4 w-4" />Pin Scenario A and edit controls for Scenario B to compare.</section>;
  const row = (label: string, av: string, bv: string) => <div className="grid grid-cols-[1fr_1fr_1fr] gap-2 border-t border-white/5 py-2.5"><span className="text-slate-400">{label}</span><span className="text-slate-200">{av}</span><span className="text-cyan-200">{bv}</span></div>;
  return <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-xs"><div className="mb-2 grid grid-cols-3 gap-2 text-[10px] uppercase tracking-wider text-slate-500"><span>Metric</span><span>A · {a.name}</span><span>B · {b.name}</span></div>
    {row('Cost / kWh', a.result?.cost.blended_unit_cost_usd_per_kwh.toFixed(5) ?? '—', b.result?.cost.blended_unit_cost_usd_per_kwh.toFixed(5) ?? '—')}
    {row('Carbon', `${a.result?.carbon_avoided.blended_ci.toFixed(0) ?? '—'} g`, `${b.result?.carbon_avoided.blended_ci.toFixed(0) ?? '—'} g`)}
    {row('APY', `${a.result?.allocations.treasury.projected_apy.toFixed(2) ?? '—'}%`, `${b.result?.allocations.treasury.projected_apy.toFixed(2) ?? '—'}%`)}
    {row('Weights', `${Object.values(a.result?.allocations.node_weights ?? {}).map((v) => Math.round(v*100)).join('/')}%`, `${Object.values(b.result?.allocations.node_weights ?? {}).map((v) => Math.round(v*100)).join('/')}%`)}
  </section>;
}
