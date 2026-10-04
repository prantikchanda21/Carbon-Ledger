'use client';

import { motion, useReducedMotion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useEffect, useState } from 'react';

export type Accent = 'cyan' | 'emerald' | 'amber' | 'rose';

const ACCENTS: Record<Accent, { ring: string; icon: string; chip: string }> = {
  cyan: { ring: 'border-cyan-400/30', icon: 'bg-cyan-400/15 text-cyan-300', chip: 'bg-cyan-400/10 text-cyan-200' },
  emerald: { ring: 'border-emerald-400/30', icon: 'bg-emerald-400/15 text-emerald-300', chip: 'bg-emerald-400/10 text-emerald-200' },
  amber: { ring: 'border-amber-400/30', icon: 'bg-amber-400/15 text-amber-300', chip: 'bg-amber-400/10 text-amber-200' },
  rose: { ring: 'border-rose-400/30', icon: 'bg-rose-400/15 text-rose-300', chip: 'bg-rose-400/10 text-rose-200' },
};

interface MetricCardProps {
  title: string; value: string; unit: string; icon: LucideIcon; accent: Accent;
  badge?: string; detail?: string; loading?: boolean; delta?: number;
  sparkline?: number[]; status?: 'good' | 'watch' | 'bad';
}

export default function MetricCard({ title, value, unit, icon: Icon, accent, badge, detail, loading, delta, sparkline = [], status = 'good' }: MetricCardProps) {
  const [display, setDisplay] = useState(value);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (!value) return;
    if (reduced) { setDisplay(value); return; }
    const start = Number(display.replace(/[^\d.-]/g, ''));
    const end = Number(value.replace(/[^\d.-]/g, ''));
    if (!Number.isFinite(start) || !Number.isFinite(end)) { setDisplay(value); return; }
    const steps = 10; let i = 0;
    const timer = setInterval(() => { i += 1; const current = start + (end - start) * (i / steps); setDisplay(current.toFixed(value.includes('.') ? 2 : 0)); if (i >= steps) clearInterval(timer); }, 28);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, reduced]);

  const tone = ACCENTS[accent];
  const min = sparkline.length ? Math.min(...sparkline) : 0;
  const max = sparkline.length ? Math.max(...sparkline) : 1;
  const points = sparkline.map((v, i) => `${(i / Math.max(1, sparkline.length - 1)) * 100},${28 - ((v - min) / Math.max(1, max - min)) * 22}`).join(' ');
  const DeltaIcon = delta === undefined ? Minus : delta < 0 ? ArrowDownRight : ArrowUpRight;

  return (
    <section aria-label={title} className={cn('relative overflow-hidden rounded-2xl border bg-white/[0.04] p-4 shadow-[0_16px_50px_-24px_rgba(0,0,0,0.9)] backdrop-blur-xl', tone.ring)}>
      <div className="flex items-start justify-between gap-3">
        <div><h2 className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">{title}</h2><div className="mt-3 flex items-baseline gap-1.5">
          <motion.span key={display} initial={{ opacity: 0.35, y: 3 }} animate={{ opacity: 1, y: 0 }} className={cn('text-3xl font-semibold tracking-tight text-slate-50 tabular-nums', loading && 'opacity-40')}>{display}</motion.span>
          <span className="text-xs text-slate-500">{unit}</span>
        </div></div>
        <span className={cn('grid h-9 w-9 place-items-center rounded-xl', tone.icon)}><Icon className="h-4.5 w-4.5" aria-hidden="true" /></span>
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs">
        {badge ? <span className={cn('rounded-full px-2 py-1 font-medium', tone.chip)}>{badge}</span> : null}
        {delta !== undefined ? <span className={cn('inline-flex items-center gap-1', delta < 0 ? 'text-emerald-300' : delta > 0 ? 'text-amber-300' : 'text-slate-500')}><DeltaIcon className="h-3.5 w-3.5" />{Math.abs(delta).toFixed(1)}%</span> : null}
        {detail ? <span className="ml-auto text-slate-500">{detail}</span> : null}
      </div>
      <div className="mt-2 flex items-end gap-2">
        <svg viewBox="0 0 100 30" className="h-7 flex-1 overflow-visible" aria-hidden="true"><polyline points={points || '0,28 100,28'} fill="none" stroke="currentColor" className={tone.icon.split(' ')[1]} strokeWidth="1.8" vectorEffect="non-scaling-stroke" /></svg>
        <span className={cn('h-2.5 w-2.5 rounded-full shadow-[0_0_12px_currentColor]', status === 'good' ? 'bg-emerald-400 text-emerald-400' : status === 'watch' ? 'bg-amber-400 text-amber-400' : 'bg-rose-400 text-rose-400')} aria-label={`status ${status}`} />
      </div>
    </section>
  );
}
