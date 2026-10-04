'use client';

import { Zap } from 'lucide-react';
import type { OptimizationResult } from '@/lib/types';

export default function EngineRace({ result }: { result: OptimizationResult | null }) {
  const onnx = result?.engine_race?.onnx_ms ?? null;
  const glpk = result?.engine_race?.glpk_ms ?? null;
  const target = result?.engine_race?.target_ms ?? 3;
  const max = Math.max(target * 4, onnx ?? 0, glpk ?? 0, 1);
  return <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
    <div className="mb-3 flex items-center gap-2"><Zap className="h-4 w-4 text-cyan-300" /><h2 className="text-sm font-semibold text-slate-100">Engine race</h2><span className="ml-auto text-[10px] uppercase tracking-wider text-slate-500">3 ms target</span></div>
    <div className="space-y-3 text-xs">
      {[['ONNX', onnx, 'bg-cyan-400'], ['GLPK', glpk, 'bg-emerald-400']].map(([name, ms, tone]) => <div key={String(name)}><div className="mb-1 flex justify-between text-slate-400"><span>{String(name)}</span><span>{ms === null ? 'shadow off' : `${Number(ms).toFixed(2)} ms`}</span></div><div className="relative h-2 rounded-full bg-slate-800"><div className={`h-full rounded-full ${tone}`} style={{ width: ms === null ? '0%' : `${Math.min(100, (Number(ms)/max)*100)}%` }} /><div className="absolute left-[75%] top-[-3px] h-4 w-px bg-amber-300/70" /></div></div>)}
    </div>
  </section>;
}
