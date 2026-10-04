'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Copy, Loader2, RefreshCw, Sparkles, X } from 'lucide-react';
import { buildSituation, describeSituation } from '@/lib/situation';
import type { ControlState, ControllerEvent, DecisionLogEntry, GridNodeTelemetry, OptimizationResult } from '@/lib/types';

interface Props { telemetry: GridNodeTelemetry[]; controls: ControlState; result: OptimizationResult | null; events: ControllerEvent[]; decisions: DecisionLogEntry[]; time: Date }

export default function ExplainButton({ telemetry, controls, result, events, decisions, time }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState('');
  const [source, setSource] = useState<'groq' | 'calculated' | ''>('');
  const [via, setVia] = useState<'primary' | 'backup' | ''>('');
  const [at, setAt] = useState('');
  const [copied, setCopied] = useState(false);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);

  async function explain(): Promise<void> {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setOpen(true); setBusy(true); setCopied(false);
    const facts = buildSituation(telemetry, controls, result, events, decisions, time);
    try {
      const r = await fetch('/api/summary', { method: 'POST', headers: { 'content-type': 'application/json' }, signal: controller.signal, body: JSON.stringify(facts) });
      const d = await r.json() as { text?: string; source?: 'groq' | 'calculated'; via?: 'primary' | 'backup'; error?: string };
      if (!r.ok || !d.text) throw new Error(d.error ?? 'Explanation unavailable');
      setText(d.text); setSource(d.source ?? 'calculated'); setVia(d.via ?? '');
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      setText(describeSituation(facts)); setSource('calculated'); setVia('');
    } finally {
      if (!controller.signal.aborted) { setBusy(false); setAt(new Date().toLocaleTimeString()); }
    }
  }

  async function copy(): Promise<void> {
    try { await navigator.clipboard.writeText(text); setCopied(true); window.setTimeout(() => setCopied(false), 1500); } catch { /* clipboard unavailable */ }
  }

  return <section aria-label="Explain what is happening" className="glass rounded-2xl p-3 sm:p-4">
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" onClick={() => void explain()} disabled={busy || !result} className="inline-flex items-center gap-2 rounded-xl border border-fuchsia-300/40 bg-fuchsia-400/20 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-fuchsia-400/30 disabled:cursor-not-allowed disabled:opacity-50">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Explain what&apos;s happening
      </button>
      <p className="text-xs text-slate-200">Plain-English summary of the current allocation, carbon, cost, latency and treasury.</p>
      {open && <button type="button" aria-label="Close explanation" onClick={() => { abort.current?.abort(); setBusy(false); setOpen(false); }} className="ml-auto rounded-lg p-1.5 text-slate-200 hover:bg-white/10"><X className="h-4 w-4" /></button>}
    </div>
    {open && <div role="status" aria-live="polite" className="mt-3 rounded-xl border border-white/15 bg-black/40 p-4">
      {busy && !text ? <p className="flex items-center gap-2 text-sm text-slate-200"><Loader2 className="h-4 w-4 animate-spin" /> Reading the dashboard…</p> : <>
        <div className="space-y-3 whitespace-pre-line text-sm leading-relaxed text-slate-100">{text}</div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-300">
          <span className="rounded-full border border-white/20 px-2 py-0.5">{source === 'groq' ? `Written by Groq${via === 'backup' ? ' (backup key)' : ''} from calculated facts` : 'Rule-based summary (add GROQ_API_KEY for AI wording)'}</span>
          {at && <span>Generated {at}</span>}
          <span className="ml-auto flex gap-2">
            <button type="button" onClick={() => void explain()} disabled={busy} className="inline-flex items-center gap-1 rounded-lg border border-white/15 px-2 py-1 font-semibold hover:bg-white/10 disabled:opacity-50"><RefreshCw className="h-3 w-3" /> Refresh</button>
            <button type="button" onClick={() => void copy()} className="inline-flex items-center gap-1 rounded-lg border border-white/15 px-2 py-1 font-semibold hover:bg-white/10">{copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />} {copied ? 'Copied' : 'Copy'}</button>
          </span>
        </div>
      </>}
    </div>}
  </section>;
}
