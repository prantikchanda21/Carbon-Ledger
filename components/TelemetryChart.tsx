'use client';

import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ForecastRegion } from '@/lib/types';
import type { SeriesPoint } from '@/lib/mockData';
import { REGIONS } from '@/lib/regions';

export default function TelemetryChart({ data, forecast, selected = 'mumbai' }: { data: SeriesPoint[]; forecast: ForecastRegion[]; selected?: keyof typeof REGIONS }) {
  const future = forecast.find((f) => f.region === selected)?.points ?? [];
  const merged = data.map((p) => ({ ...p, low: undefined, high: undefined, band: undefined }));
  const forecastRows = future.map((p) => ({ label:p.label, blended:p.mean, low:p.low, band:p.high-p.low }));
  const rows = [...merged, ...forecastRows];
  return <section aria-label="24-hour carbon telemetry and forecast" className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><div className="flex items-center justify-between"><h2 className="text-sm font-semibold text-slate-100">Simulated carbon + forecast</h2><span className="text-[10px] uppercase tracking-wider text-slate-500">{REGIONS[selected].city} · illustrative band</span></div><div className="mt-3 h-[290px]"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={rows}><defs><linearGradient id="fc" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#22d3ee" stopOpacity={0.18}/><stop offset="100%" stopColor="#22d3ee" stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="#1e293b" vertical={false}/><XAxis dataKey="label" stroke="#64748b" tick={{fontSize:10}} interval={3}/><YAxis stroke="#64748b" tick={{fontSize:10}}/><Tooltip contentStyle={{background:'#0f172a',border:'1px solid #1e293b',fontSize:11}}/><Area dataKey="low" stackId="band" stroke="none" fill="transparent"/><Area dataKey="band" stackId="band" stroke="none" fill="url(#fc)" name="forecast band"/><Line dataKey="blended" stroke="#34d399" strokeWidth={2.2} dot={false} name="blend"/></ComposedChart></ResponsiveContainer></div></section>;
}
