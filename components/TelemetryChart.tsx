'use client';

import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine, Legend } from 'recharts';
import { useState } from 'react';
import type { ForecastRegion } from '@/lib/types';
import type { SeriesPoint } from '@/lib/mockData';
import { REGIONS } from '@/lib/regions';

export default function TelemetryChart({ data, forecast, selected = 'mumbai' }: { data: SeriesPoint[]; forecast: ForecastRegion[]; selected?: keyof typeof REGIONS }) {
  const [windowSize,setWindowSize]=useState(24);
  const [compare,setCompare]=useState(true);
  const [threshold,setThreshold]=useState(450);
  const future = forecast.find((f) => f.region === selected)?.points ?? [];
  const merged = data.map((p) => ({ ...p, low: undefined, high: undefined, band: undefined }));
  const forecastRows = future.map((p) => ({ label:p.label, blended:p.mean, low:p.low, band:p.high-p.low }));
  const rows = [...merged.slice(-windowSize), ...forecastRows];
  return <section aria-label="24-hour carbon telemetry and forecast" className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><div className="flex items-center justify-between"><h2 className="text-sm font-semibold text-slate-100">Carbon intensity</h2><span className="text-[10px] uppercase tracking-wider text-slate-500">{REGIONS[selected].city}</span></div><div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-300"><label>History <select aria-label="Telemetry history window" className="lab-input ml-2" value={windowSize} onChange={e=>setWindowSize(Number(e.target.value))}><option value={6}>6 points</option><option value={12}>12 points</option><option value={24}>24 points</option><option value={48}>48 points</option></select></label><label className="flex items-center gap-2"><input type="checkbox" checked={compare} onChange={e=>setCompare(e.target.checked)}/> Show forecast</label><label>Target <input className="lab-input ml-2 w-20" type="number" min="0" max="2000" value={threshold} onChange={e=>setThreshold(Number(e.target.value)||0)}/></label></div><div className="mt-3 h-[290px]"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={rows}><defs><linearGradient id="fc" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#22d3ee" stopOpacity={0.18}/><stop offset="100%" stopColor="#22d3ee" stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="#1e293b" vertical={false}/><XAxis dataKey="label" stroke="#64748b" tick={{fontSize:10}} interval={3}/><YAxis stroke="#64748b" tick={{fontSize:10}}/><ReferenceLine y={threshold} stroke="#fbbf24" strokeDasharray="5 5" label={{value:"Target",fill:"#fbbf24",fontSize:10}}/><Tooltip cursor={{stroke:"#38bdf8",strokeDasharray:"3 3"}} contentStyle={{background:'#0f172a',border:'1px solid #1e293b',fontSize:11}}/><Area dataKey="low" hide={!compare} stackId="band" stroke="none" fill="transparent"/><Area dataKey="band" hide={!compare} stackId="band" stroke="none" fill="url(#fc)" name="forecast band"/><Line dataKey="blended" stroke="#34d399" strokeWidth={2.2} dot={false} name="blend"/><Legend verticalAlign="bottom" height={24}/></ComposedChart></ResponsiveContainer></div></section>;
}
