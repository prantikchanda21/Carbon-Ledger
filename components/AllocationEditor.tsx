'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { RotateCcw, SlidersHorizontal } from 'lucide-react';
import type { OptimizationResult, RegionId } from '@/lib/types';
import { REGIONS, REGION_ORDER } from '@/lib/regions';
import { greedyAllocation } from '@/lib/controllerMath';
import { capFor, eligibilityOf, evenSplit, rebalanceWeights, type Weights } from '@/lib/override';

interface Props {
  /** The optimizer's own result (what "reset" returns to). */
  base: OptimizationResult | null;
  /** The result currently driving the dashboard (optimizer, or optimizer + manual override). */
  result: OptimizationResult | null;
  /** Pinned manual weights, or null when the optimizer is in control. */
  override: Weights | null;
  onChange: (weights: Weights | null) => void;
}

const pct = (n: number): string => `${Math.round(n * 100)}%`;
const signed = (n: number, digits = 2): string => `${n > 0 ? '+' : ''}${n.toFixed(digits)}`;

export default function AllocationEditor({ base, result, override, onChange }: Props) {
  const eligible = useMemo(() => (result ? eligibilityOf(result) : null), [result]);
  const weights = result?.allocations.node_weights;
  const cap = eligible ? capFor(eligible) : 1;
  const nodeById = useMemo(() => new Map((result?.nodes ?? []).map((n) => [n.id, n])), [result]);

  if (!base || !result || !eligible || !weights) {
    return <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-xs text-slate-500"><div className="mb-2 flex items-center gap-2"><SlidersHorizontal className="h-4 w-4 text-cyan-300" /><h2 className="text-sm font-semibold text-slate-100">Allocation editor</h2></div>Waiting for the first optimizer result…</section>;
  }

  const active = override !== null && result.manual_override?.active === true;
  const total = REGION_ORDER.reduce((s, id) => s + (weights[id] ?? 0), 0);

  function edit(id: RegionId, value: number): void {
    if (!weights || !eligible) return;
    onChange(rebalanceWeights(weights, id, value, eligible));
  }
  function lowestCarbon(): void {
    if (!base || !eligible) return;
    const ids = base.nodes.map((n) => n.id);
    const spread = greedyAllocation(base.nodes.map((n) => n.carbon_ci), ids.map((id) => eligible[id]), cap);
    onChange(Object.fromEntries(REGION_ORDER.map((id) => [id, spread[ids.indexOf(id)] ?? 0])) as Weights);
  }
  function even(): void {
    if (!eligible) return;
    const next = evenSplit(eligible);
    if (next) onChange(next);
  }

  const gap = result.manual_override?.cost_gap_pct ?? 0;
  const ciDelta = active ? result.carbon_avoided.blended_ci - (result.manual_override?.optimizer_blended_ci ?? result.carbon_avoided.blended_ci) : 0;

  return <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
    <div className="mb-3 flex items-center gap-2">
      <SlidersHorizontal className="h-4 w-4 text-cyan-300" />
      <h2 className="text-sm font-semibold text-slate-100">Allocation editor</h2>
      <span className={active ? 'ml-auto rounded-full bg-amber-400/10 px-2 py-0.5 text-[10px] text-amber-200' : 'ml-auto rounded-full bg-emerald-400/10 px-2 py-0.5 text-[10px] text-emerald-200'}>{active ? 'manual override' : 'optimizer'}</span>
    </div>

    <div className="mb-3 grid grid-cols-3 gap-2 text-[10px]">
      <div className="rounded-lg bg-white/[0.04] p-2"><span className="text-slate-500">Cost vs optimizer</span><b className={`mt-0.5 block text-xs ${gap > 0.005 ? 'text-amber-300' : 'text-slate-200'}`}>{active ? `${signed(gap)}%` : '0.00%'}</b></div>
      <div className="rounded-lg bg-white/[0.04] p-2"><span className="text-slate-500">Carbon shift</span><b className={`mt-0.5 block text-xs ${ciDelta > 0.5 ? 'text-amber-300' : ciDelta < -0.5 ? 'text-emerald-300' : 'text-slate-200'}`}>{active ? `${signed(ciDelta, 1)} g` : '0.0 g'}</b></div>
      <div className="rounded-lg bg-white/[0.04] p-2"><span className="text-slate-500">SLA</span><b className={`mt-0.5 block text-xs ${result.latency.sla_compliant ? 'text-emerald-300' : 'text-rose-300'}`}>{result.latency.sla_compliant ? 'compliant' : 'breach'}</b></div>
    </div>

    <div className="mb-3 flex flex-wrap gap-1.5">
      <button type="button" onClick={() => onChange(null)} disabled={!active} className="inline-flex items-center gap-1 rounded-lg bg-cyan-400/10 px-2 py-1 text-[10px] text-cyan-200 disabled:opacity-40"><RotateCcw className="h-3 w-3" />Reset to optimizer</button>
      <button type="button" onClick={lowestCarbon} className="rounded-lg bg-white/5 px-2 py-1 text-[10px] text-slate-300">Lowest carbon</button>
      <button type="button" onClick={even} className="rounded-lg bg-white/5 px-2 py-1 text-[10px] text-slate-300">Even split</button>
    </div>

    <div className="space-y-2">{REGION_ORDER.map((id) => {
      const weight = weights[id] ?? 0;
      const node = nodeById.get(id);
      const locked = !eligible[id];
      return <div key={id} className={locked ? 'opacity-45' : ''}>
        <div className="mb-1 flex justify-between text-[11px]">
          <span className="text-slate-400" title={locked ? node?.exclusion_reason ?? 'Excluded' : undefined}>{REGIONS[id].city}{locked ? ' · excluded' : ''}</span>
          <span className="text-slate-200 tabular-nums">{pct(weight)}</span>
        </div>
        <div className="relative mb-1 h-1.5 overflow-hidden rounded-full bg-slate-900">
          <motion.div animate={{ width: `${weight * 100}%` }} transition={{ type: 'spring', stiffness: 240, damping: 25 }} className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400" />
          {!locked && cap < 1 ? <span className="absolute top-0 h-full w-px bg-amber-300/60" style={{ left: `${cap * 100}%` }} /> : null}
        </div>
        <input aria-label={`${REGIONS[id].city} allocation`} type="range" min="0" max={cap} step="0.01" value={Math.min(weight, cap)} disabled={locked} onChange={(e) => edit(id, Number(e.target.value))} className="range-slider" />
      </div>;
    })}</div>
    <p className="mt-3 text-[10px] text-slate-600">Total {pct(total)} · each region is capped at {pct(cap)} (amber tick). Moving a slider rebalances the others; excluded regions are locked. Edits stay pinned across re-optimization until you reset.</p>
  </section>;
}
