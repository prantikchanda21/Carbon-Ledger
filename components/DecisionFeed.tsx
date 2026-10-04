'use client';

import { Pause, Play, Download } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { DecisionLogEntry } from '@/lib/types';
import { decisionLogCsv, brsrSummary } from '@/lib/decisionLog';

export default function DecisionFeed({ entries }: { entries: DecisionLogEntry[] }) {
  const [paused, setPaused] = useState(false);
  const [filter, setFilter] = useState<'all'|'fallback'|'sla'|'carbon'>('all');
  const ref = useRef<HTMLDivElement>(null);
  const visible = entries.filter((e) => filter === 'all' || (filter === 'fallback' && e.reasonCodes.includes('fallback')) || (filter === 'sla' && e.reasonCodes.includes('SLA')) || (filter === 'carbon' && e.reasonCodes.includes('carbon_shift')));
  useEffect(() => { if (!paused) ref.current?.scrollTo({ top: 0, behavior: 'smooth' }); }, [entries, paused]);
  function download(): void { const blob = new Blob([decisionLogCsv(entries)], {type:'text/csv'}); const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='decision-log.csv'; a.click(); URL.revokeObjectURL(url); }
  return <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><div className="mb-3 flex items-center gap-2"><h2 className="text-sm font-semibold">Decision feed</h2><select value={filter} onChange={(e)=>setFilter(e.target.value as typeof filter)} className="ml-auto rounded-lg bg-slate-900 px-2 py-1 text-[10px] text-slate-300"><option value="all">all</option><option value="fallback">fallback</option><option value="sla">SLA</option><option value="carbon">carbon</option></select><button type="button" onClick={()=>setPaused(!paused)} aria-label={paused?'resume feed':'pause feed'} className="grid h-7 w-7 place-items-center rounded bg-white/5">{paused?<Play className="h-3.5 w-3.5"/>:<Pause className="h-3.5 w-3.5"/>}</button><button type="button" onClick={download} aria-label="download log" className="grid h-7 w-7 place-items-center rounded bg-white/5"><Download className="h-3.5 w-3.5"/></button></div><div ref={ref} className="max-h-48 space-y-2 overflow-auto">{visible.length ? visible.map((e)=><div key={e.id} className="rounded-lg border border-white/5 bg-slate-900/40 p-2 text-[11px]"><div className="flex items-center gap-2 text-slate-400"><span>{new Date(e.timestamp).toLocaleTimeString()}</span><span className="rounded-full bg-cyan-400/10 px-1.5 py-0.5 text-cyan-200">{e.engine}</span><span>{e.reasonCodes.join(' · ')}</span></div><p className="mt-1 text-slate-200">{e.summary}</p></div>):<p className="py-8 text-center text-xs text-slate-600">No decisions yet.</p>}</div><p className="mt-2 text-[10px] text-slate-600">{brsrSummary(entries).replaceAll('\n',' · ')}</p></section>;
}
