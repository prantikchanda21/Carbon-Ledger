'use client';
import { useEffect, useState } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
interface Point { size:number; p:number; normalized_gap:{mean:number;p10:number;p90:number}|null }
interface Sweep {metadata:{synthetic:boolean;seed:number;scenarios:number;timestamp:string};summary:Point[]}
export default function QaoaSweepChart() {
  const [data,setData]=useState<Sweep|null>(null);
  useEffect(()=>{let active=true;fetch('/data/qaoa_sweep.json').then(r=>r.ok?r.json():null).then(x=>{if(active)setData(x as Sweep|null);}).catch(()=>{});return()=>{active=false;};},[]);
  if (!data?.summary?.length) return <p className="lab-note">No offline sweep artifact present. Run <code>npm run quantum:sweep</code> to generate reproducible benchmark data.</p>;
  const sizes=[...new Set(data.summary.map(x=>x.size))].sort((a,b)=>a-b);
  const depths=[...new Set(data.summary.map(x=>x.p))].sort((a,b)=>a-b);
  const rows=depths.map(p=>({p,exact:0,...Object.fromEntries(sizes.map(size=>[`n${size}`,data.summary.find(v=>v.size===size&&v.p===p)?.normalized_gap?.mean??null]))}));
  const strokes=['#22d3ee','#a78bfa','#fbbf24','#fb7185'];
  return <section className="rounded-xl border border-white/10 bg-slate-900/60 p-3"><h3 className="font-semibold text-slate-100">Offline QAOA depth sweep</h3>
    <p className="my-2 text-xs text-slate-400">Synthetic data · {data.metadata.scenarios} scenarios · seed {data.metadata.seed}. Normalized conditional feasible cost gap vs exact optimum (lower is better). Precomputed offline; no quantum advantage claimed. Classical solvers match or beat QAOA at this scale.</p>
    <div className="h-60 w-full"><ResponsiveContainer width="100%" height="100%"><LineChart data={rows}><CartesianGrid stroke="#334155"/><XAxis dataKey="p" stroke="#94a3b8" label={{value:'Circuit depth p',position:'insideBottom',offset:-3}}/><YAxis stroke="#94a3b8"/><Tooltip contentStyle={{background:'#020617',border:'1px solid #334155'}}/><Legend/><Line type="linear" dataKey="exact" name="Exact / GLPK reference" stroke="#10b981" strokeDasharray="4 4" dot={false}/>{sizes.map((size,i)=><Line key={size} type="monotone" dataKey={`n${size}`} name={`${size} candidates`} stroke={strokes[i%strokes.length]}/>)}</LineChart></ResponsiveContainer></div></section>;
}
