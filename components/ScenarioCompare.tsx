'use client';
import {budgetLabel,crToUsd} from '@/lib/budgetUsd';
import {USD_INR} from '@/lib/constants';

import { ArrowDownRight, ArrowUpRight, GitCompare, Minus, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useControllerStore } from '@/lib/store';
import type { Scenario, OptimizationResult, RegionId } from '@/lib/types';

const num = (n: number, digits = 2) => Number.isFinite(n) ? n.toFixed(digits) : '—';
const regionName = (id: string) => id.replaceAll('_', ' ');

type Metric = { label: string; a: number; b: number; unit: string; decimals: number; lowerBetter?: boolean; note?: string };
function DeltaCard({ metric }: { metric: Metric }) {
  const delta = metric.b - metric.a;
  const relative = Math.abs(metric.a)>1e-9 ? (delta / Math.abs(metric.a))*100 : null;
  const unchanged = Math.abs(delta) < Math.max(1e-7, Math.abs(metric.a) * 0.00001);
  const good = metric.lowerBetter ? delta < 0 : delta > 0;
  return <div className="rounded-xl border border-white/10 bg-slate-950/40 p-3">
    <p className="text-[11px] font-medium text-slate-400">{metric.label}</p>
    <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1"><strong className="text-lg text-slate-100 tabular-nums">{num(metric.b,metric.decimals)} <span className="text-xs font-normal text-slate-400">{metric.unit}</span></strong><span className="text-[10px] text-slate-500">B</span></div>
    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
      <span className="text-slate-400">A: {num(metric.a,metric.decimals)} {metric.unit}</span>
      <span className={unchanged?'text-slate-400':good?'text-emerald-300':'text-amber-300'}>
        {unchanged?<Minus className="inline h-3.5 w-3.5"/>:delta>0?<ArrowUpRight className="inline h-3.5 w-3.5"/>:<ArrowDownRight className="inline h-3.5 w-3.5"/>}
        {' '}{delta>0?'+':''}{num(delta,metric.decimals)}{relative!==null?` (${delta>0?'+':''}${num(relative,1)}%)`:''}
      </span>
    </div>
    {metric.note && <p className="mt-1 text-[10px] text-slate-500">{metric.note}</p>}
  </div>;
}
function AllocationChanges({ a, b }: { a: OptimizationResult; b: OptimizationResult }) {
  const wa = a.allocations.node_weights;
  const wb = b.allocations.node_weights;
  const keys = [...new Set<RegionId>([...(Object.keys(wa) as RegionId[]), ...(Object.keys(wb) as RegionId[])])];
  const shifts = keys.map(id => ({ id, a: wa[id] ?? 0, b: wb[id] ?? 0, shift: (wb[id] ?? 0) - (wa[id] ?? 0) }))
    .sort((x,y)=>Math.abs(y.shift)-Math.abs(x.shift));
  const changed = shifts.filter(x=>Math.abs(x.shift) >= .00005);
  const moved = shifts.reduce((sum,x)=>sum+Math.abs(x.shift),0)*50;
  const active = (weights: Record<RegionId, number>) => Object.values(weights).filter(v => v > .0001).length;
  return <div className="rounded-xl border border-white/10 bg-slate-950/30 p-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="text-sm font-semibold text-slate-100">Where the workload moved</h4><span className="text-xs text-cyan-200">{num(moved,2)}% redistributed</span></div>
    <p className="mt-1 text-[11px] text-slate-400">Active regions: {active(wa)} in A → {active(wb)} in B. Regional changes are in percentage points.</p>
    <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto_auto_auto] gap-x-3 border-b border-white/10 pb-1 text-[10px] uppercase text-slate-500"><span>Region</span><span>A</span><span>B</span><span>Δ</span></div>
    {changed.length===0?<p className="py-4 text-xs text-slate-400">No meaningful allocation change. Both snapshots allocate workload to the same regions at the same percentages.</p>:changed.slice(0,8).map(r=><div className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-x-3 border-b border-white/5 py-2 text-[11px]" key={r.id}>
      <span className="min-w-0 truncate text-slate-200">{regionName(r.id)}</span><span className="tabular-nums text-slate-400">{num(r.a*100,2)}%</span><span className="tabular-nums text-cyan-200">{num(r.b*100,2)}%</span><span className={`tabular-nums ${r.shift>0?'text-emerald-300':'text-amber-300'}`}>{r.shift>0?'+':''}{num(r.shift*100,2)}</span>
    </div>)}
    {changed.length>8&&<p className="mt-2 text-[10px] text-slate-500">Showing the 8 largest shifts out of {changed.length} changed regions.</p>}
  </div>;
}
function ScenarioInputs({a,b}:{a:Scenario;b:Scenario}){
  const items=[
    ['SLA limit',`${a.controls.sla_ms} ms`,`${b.controls.sla_ms} ms`],
    ['Carbon tax weight',num(a.controls.carbon_tax),num(b.controls.carbon_tax)],
    ['Treasury budget',budgetLabel(a.controls.budget_cr),budgetLabel(b.controls.budget_cr)],
    ['India residency',a.controls.dpdp_locked?'On':'Off',b.controls.dpdp_locked?'On':'Off'],
  ];
  return <div className="rounded-xl border border-white/10 bg-black/10 p-3"><h4 className="text-sm font-semibold text-slate-100">What changed between the pins</h4><div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto_auto] gap-2 text-[11px]"><span className="text-slate-500">Control</span><span className="text-slate-500">A</span><span className="text-cyan-300">B</span>{items.map(([label,av,bv])=><div className="contents" key={label}><span className="text-slate-300">{label}</span><span className="text-slate-300">{av}</span><span className={av===bv?'text-slate-400':'font-semibold text-cyan-200'}>{bv}</span></div>)}</div></div>;
}
export default function ScenarioCompare() {
  const a=useControllerStore(s=>s.scenarioA);
  const b=useControllerStore(s=>s.scenarioB);
  if(!a||!b)return <section className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-4 text-xs text-slate-400"><GitCompare className="mb-2 h-4 w-4 text-cyan-300"/>Pin A, modify your SLA/carbon/budget scenario, then pin B to compare impacts.</section>;
  const ar=a.result, br=b.result;
  const metrics:Metric[] = ar&&br?[
    {label:'Operating cost per day',a:ar.cost.operating_cost_usd_per_day,b:br.cost.operating_cost_usd_per_day,unit:'USD/day',decimals:2,lowerBetter:true},
    {label:'Grid carbon intensity',a:ar.carbon_avoided.blended_ci,b:br.carbon_avoided.blended_ci,unit:'gCO₂/kWh',decimals:1,lowerBetter:true},
    {label:'Net carbon footprint',a:ar.carbon_avoided.net_footprint_mt,b:br.carbon_avoided.net_footprint_mt,unit:'MT/day',decimals:2,lowerBetter:true},
    {label:'Network latency',a:ar.latency.weighted_network_ms,b:br.latency.weighted_network_ms,unit:'ms',decimals:1,lowerBetter:true},
    {label:'Treasury projected APY',a:ar.allocations.treasury.projected_apy,b:br.allocations.treasury.projected_apy,unit:'%',decimals:2},
    {label:'Daily treasury income',a:ar.treasury_income_inr/USD_INR/365,b:br.treasury_income_inr/USD_INR/365,unit:'USD/day',decimals:0},
  ]:[];
  return <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-3 text-xs">
    <div className="flex flex-wrap items-center gap-2"><GitCompare className="h-4 w-4 text-cyan-300"/><h3 className="text-sm font-semibold text-slate-100">Scenario impact · Pin A vs Pin B</h3><span className="ml-auto text-[10px] text-slate-400">Frozen snapshots, not live measurements</span></div>
    <div className="mt-3"><ScenarioInputs a={a} b={b}/></div>
    {!ar||!br?<p className="mt-3 rounded-xl border border-amber-300/20 bg-amber-300/5 p-3 text-xs text-amber-200">An optimisation result is missing from {ar?'B':'A'}. Pin both scenarios after allocations finish to compare measured model outputs.</p>:<>
      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-black/10 px-3 py-2 text-[11px]"><span className="text-slate-400">SLA compliance:</span><span className={ar.latency.sla_compliant?'text-emerald-200':'text-amber-200'}>{ar.latency.sla_compliant?'A compliant':'A violation'}</span><span className="text-slate-500">→</span><span className={br.latency.sla_compliant?'text-emerald-200':'text-amber-200'}>{br.latency.sla_compliant?<ShieldCheck className="mr-1 inline h-3.5 w-3.5"/>:<ShieldAlert className="mr-1 inline h-3.5 w-3.5"/>}{br.latency.sla_compliant?'B compliant':'B violation'}</span><span className="ml-auto text-slate-400">Engine: {ar.engine} → {br.engine}</span></div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{metrics.map(metric=><DeltaCard key={metric.label} metric={metric}/>)}</div>
      <div className="mt-3"><AllocationChanges a={ar} b={br}/></div>
      <p className="mt-2 text-[10px] text-slate-500">Metric deltas show B minus A. Scenario cost and treasury figures come from saved model results; changes are not guaranteed to be causal effects of a single control when multiple inputs differ. Lower cost, carbon and latency are generally preferable.</p>
    </>}
  </section>;
}
