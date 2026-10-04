'use client';

import { Area, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { MonteCarloPoint } from '@/lib/monteCarlo';

export default function FrontierChart({ data }: { data: MonteCarloPoint[] }) {
  return <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><h2 className="text-sm font-semibold text-slate-100">Carbon futures risk frontier</h2><div className="mt-3 h-40"><ResponsiveContainer width="100%" height="100%"><LineChart data={data}><CartesianGrid stroke="#1e293b" vertical={false} /><XAxis dataKey="coverage" tickFormatter={(v)=>`${Math.round(v*100)}%`} stroke="#64748b" tick={{fontSize:10}} /><YAxis stroke="#64748b" tick={{fontSize:10}} /><Tooltip contentStyle={{background:'#0f172a',border:'1px solid #1e293b',fontSize:11}} /><Area type="monotone" dataKey="high" stroke="none" fill="#fbbf24" fillOpacity={0.08} /><Area type="monotone" dataKey="low" stroke="none" fill="#020617" fillOpacity={1} /><Line type="monotone" dataKey="mean" stroke="#34d399" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer></div></section>;
}
