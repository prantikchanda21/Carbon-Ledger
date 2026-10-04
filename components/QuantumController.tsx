'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Atom, CheckCircle2, Clock3, Loader2, RotateCw, ShieldCheck, Zap } from 'lucide-react';
import { toast } from 'sonner';
import type { ControlState, GridNodeTelemetry, OptimizationResult } from '@/lib/types';
import { buildQuantumRequest, pollQuantum, submitQuantum, type QuantumOptimizationRequest, type QuantumOptimizationResult } from '@/lib/quantumClient';

export default function QuantumController({ telemetry, controls, result }: { telemetry: GridNodeTelemetry[]; controls: ControlState; result: OptimizationResult | null }) {
  const mode = 'simulator' as const;
  const [state, setState] = useState<QuantumOptimizationResult | null>(null);
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const request = useMemo<QuantumOptimizationRequest>(() => buildQuantumRequest(telemetry, controls, mode), [telemetry, controls, mode]);
  const quantumCost = state?.qaoa_cost_usd_per_kwh ?? null;
  const baselineCost = result?.cost.blended_unit_cost_usd_per_kwh ?? null;
  const costGap = quantumCost !== null && baselineCost !== null && baselineCost > 0 ? ((quantumCost - baselineCost) / baselineCost) * 100 : null;

  useEffect(() => () => abortRef.current?.abort(), []);

  async function run(): Promise<void> {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setState(null);
    try {
      let latest = await submitQuantum(request, controller.signal);
      setState(latest);
      const jobId = latest.job_id;
      if (latest.status === 'queued' && jobId) {
        for (let i = 0; i < 40; i += 1) {
          await new Promise((resolve) => window.setTimeout(resolve, 2500));
          const next = await pollQuantum(jobId, request, controller.signal);
          latest = next;
          setState(next);
          if (['completed', 'done', 'cancelled', 'error', 'failed'].includes(next.status)) break;
        }
      }
      if (latest.status === 'completed' || latest.status === 'done') toast.success('QAOA allocation completed', { id: 'qaoa-complete' });
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        const message = error instanceof Error ? error.message : 'Unknown quantum error';
        setState({ status: 'error', job_id: null, mode: 'qiskit-simulator', backend: 'Qiskit Statevector', candidate_region_ids: [], error: message, quantum_verified: false });
        toast.error(`Quantum solve failed: ${message}`, { id: 'qaoa-error' });
      }
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  const completed = state?.status === 'completed' || state?.status === 'done';
  const weightRows: Array<[string, number]> = (Object.entries(state?.weights ?? {}) as Array<[string, number | undefined]>).map(([id, value]) => [id, value ?? 0] as [string, number]).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return <section className="rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.035] p-4 shadow-[0_16px_60px_-35px_rgba(34,211,238,0.35)]">
    <div className="flex flex-wrap items-center gap-2">
      <div className="grid h-8 w-8 place-items-center rounded-lg bg-cyan-300/10 text-cyan-200"><Atom className="h-4 w-4" /></div>
      <div><div className="flex items-center gap-2 text-sm font-semibold text-slate-100">Live Quantum Controller <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2 py-0.5 text-[9px] uppercase tracking-wider text-cyan-200">QAOA</span></div><div className="text-[10px] text-slate-500">Qiskit simulator → allocation candidate</div></div>
      <div className="ml-auto flex items-center gap-2">
        <button type="button" onClick={() => void run()} disabled={busy || telemetry.length < 20} className="inline-flex items-center gap-2 rounded-lg bg-cyan-300/10 px-3 py-1.5 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-300/15 disabled:cursor-not-allowed disabled:opacity-50">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />} Run QAOA
        </button>
      </div>
    </div>
    <div className="mt-3 grid gap-2 sm:grid-cols-4">
      <div className="rounded-xl border border-white/5 bg-black/10 p-2"><div className="text-[9px] uppercase tracking-wider text-slate-600">Execution</div><div className="mt-1 flex items-center gap-1.5 text-xs text-slate-200"><Atom className="h-3.5 w-3.5 text-cyan-300"/>{state?.backend ?? 'idle'}</div></div>
      <div className="rounded-xl border border-white/5 bg-black/10 p-2"><div className="text-[9px] uppercase tracking-wider text-slate-600">Job</div><div className="mt-1 flex items-center gap-1.5 text-xs text-slate-200">{state?.status ?? 'idle'} {state?.job_id ? <span className="font-mono text-[9px] text-slate-500">{state.job_id.slice(0, 10)}…</span> : null}</div></div>
      <div className="rounded-xl border border-white/5 bg-black/10 p-2"><div className="text-[9px] uppercase tracking-wider text-slate-600">QAOA cost</div><div className="mt-1 text-xs text-slate-200">{quantumCost === null ? '—' : quantumCost.toFixed(4)} <span className="text-[9px] text-slate-600">USD/kWh</span></div></div>
      <div className="rounded-xl border border-white/5 bg-black/10 p-2"><div className="text-[9px] uppercase tracking-wider text-slate-600">Controller gap*</div><div className="mt-1 text-xs text-slate-200">{costGap === null ? '—' : `${costGap >= 0 ? '+' : ''}${costGap.toFixed(2)}%`} {completed ? <ShieldCheck className="ml-1 inline h-3.5 w-3.5 text-emerald-300"/> : null}</div></div>
    </div>
    <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
      <span className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3"/> Qiskit simulator · *different candidate sets/caps; use the experiment benchmark for a fair comparison</span>
      <span className="inline-flex items-center gap-1"><RotateCw className="h-3 w-3"/>{state?.execution_ms ? `${state.execution_ms.toFixed(0)} ms compute` : 'waiting'}</span>
      {completed ? <span className="inline-flex items-center gap-1 text-emerald-300"><CheckCircle2 className="h-3 w-3"/> quantum solution received</span> : null}
    </div>
    {weightRows.length ? <div className="mt-3 grid gap-2 md:grid-cols-5">{weightRows.map(([id, weight]) => <div key={id} className="rounded-xl bg-white/[0.025] p-2"><div className="flex items-center justify-between text-[10px]"><span className="text-slate-400">{id}</span><span className="tabular-nums text-cyan-200">{((weight ?? 0) * 100).toFixed(1)}%</span></div><div className="mt-1 h-1.5 rounded-full bg-slate-800"><div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400" style={{ width: `${Math.min(100, (weight ?? 0) * 100)}%` }} /></div></div>)}</div> : null}
    {state?.error ? <div role="alert" className="mt-3 rounded-xl border border-rose-300/20 bg-rose-300/5 px-3 py-2 text-[10px] text-rose-200">{state.error}</div> : null}
  </section>;
}
