'use client';

import { Radio, Atom } from 'lucide-react';
import Link from 'next/link';
import BrandLogo from '@/components/BrandLogo';
import { cn } from '@/lib/cn';
import type { EngineKind } from '@/lib/types';
export type SystemStatus = 'loading'|'error'|'cooperative'|EngineKind;
const copy: Record<SystemStatus,{label:string;tone:string}> = {
  cooperative:{label:'Optimised',tone:'emerald'}, loading:{label:'Loading',tone:'slate'}, error:{label:'Error',tone:'rose'}, onnx:{label:'Optimal',tone:'emerald'}, 'glpk-wasm':{label:'Optimal · backup solver',tone:'cyan'}, 'greedy-safe':{label:'Safe mode',tone:'rose'}
};
export default function DashboardHeader({status}:{status:SystemStatus}) {
  const c=copy[status];
  return <header className="flex flex-wrap items-center gap-4"><div className="flex min-w-0 flex-1 items-center gap-3"><BrandLogo href="/" size={52}/><div><h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Carbon &amp; Treasury Controller</h1></div></div><Link href="/quantum-lab" className="lab-button inline-flex shrink-0 items-center gap-2" aria-label="Open Quantum Lab"><Atom className="h-4 w-4"/>Quantum Lab</Link><div role="status" aria-live="polite" className={cn('flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold',c.tone==='emerald'&&'border-emerald-400/30 bg-emerald-400/10 text-emerald-200',c.tone==='cyan'&&'border-cyan-400/30 bg-cyan-400/10 text-cyan-200',c.tone==='rose'&&'border-rose-400/30 bg-rose-400/10 text-rose-200',c.tone==='slate'&&'border-slate-700 bg-slate-900 text-slate-400')}><Radio className="h-3.5 w-3.5 animate-soft-pulse"/>{c.label}</div></header>;
}
