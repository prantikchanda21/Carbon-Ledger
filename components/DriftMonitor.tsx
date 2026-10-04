'use client';


export default function DriftMonitor({ gaps }: { gaps: number[] }) {
  const latest = gaps.at(-1) ?? 0;
  const mean = gaps.length ? gaps.reduce((a,b)=>a+b,0)/gaps.length : 0;
  const threshold = 2;
  return <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold">Surrogate drift</h2><p className="text-xs text-slate-500">ONNX vs LP cost gap</p></div><span className={latest>threshold?'rounded-full bg-rose-400/10 px-2 py-1 text-xs text-rose-200':'rounded-full bg-emerald-400/10 px-2 py-1 text-xs text-emerald-200'}>{latest.toFixed(2)}%</span></div><div className="mt-3 flex h-10 items-end gap-1">{gaps.slice(-30).map((g,i)=><div key={i} className={g>threshold?'bg-rose-400':'bg-cyan-400'} style={{height:`${Math.max(8,Math.min(100,g*18))}%`, width:'3.2%'}} />)}</div><p className="mt-2 text-[10px] text-slate-500">mean {mean.toFixed(2)}% · alert threshold {threshold}%</p></section>;
}
