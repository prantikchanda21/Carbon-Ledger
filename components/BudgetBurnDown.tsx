'use client';

import { Area, AreaChart, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from 'recharts';

export default function BudgetBurnDown({ budgetCr, offsetPct, carbonTax = 0.5, blendedCi = 400 }: { budgetCr: number; offsetPct: number; carbonTax?: number; blendedCi?: number }) {
  // Daily burn rises with offset coverage, carbon price and grid intensity.
  const dailyBurn = Math.max(0.002, (0.25 + offsetPct / 250) / 30 * (0.7 + carbonTax * 0.6) * (0.6 + blendedCi / 1000));
  const data = Array.from({ length: 30 }, (_, i) => ({ day: i + 1, remaining: Math.max(0, budgetCr * (1 - (i + 1) * dailyBurn)) }));
  const depletionDay = Math.ceil(1 / dailyBurn);
  const label = depletionDay <= 30 ? `day ${depletionDay}` : `day ${depletionDay} (beyond month)`;
  return <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><div className="flex items-center justify-between"><h2 className="text-sm font-semibold">Offset budget burn-down</h2><span className="text-xs text-slate-500">forecast depletion ~ {label} · ₹{budgetCr} Cr</span></div><div className="mt-2 h-28"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data}><XAxis dataKey="day" hide/><YAxis hide domain={[0, budgetCr]}/>{depletionDay <= 30 ? <ReferenceLine x={depletionDay} stroke="#fbbf24" strokeDasharray="3 3"/> : null}<Area type="monotone" dataKey="remaining" stroke="#34d399" fill="#34d399" fillOpacity={0.08} isAnimationActive={false}/></AreaChart></ResponsiveContainer></div></section>;
}
