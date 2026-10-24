'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Grid3X3 } from 'lucide-react';
import type { ControlState, GridNodeTelemetry } from '@/lib/types';

interface Cell { sla_ms: number; carbon_tax: number; cost: number; engine: string; gap?: number; }

export default function SweepHeatmap({ telemetry, controls, onPick }: { telemetry?: GridNodeTelemetry[]; controls?: ControlState; onPick?: (sla: number, tax: number) => void }) {
  const [cells, setCells] = useState<Cell[]>([]);
  const [busy, setBusy] = useState(false);
  const [auto, setAuto] = useState(true);
  const abortRef = useRef<AbortController | null>(null);
  const dpdp = controls?.dpdp_locked ?? false;

  async function run(silent = false): Promise<void> {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    try {
      const response = await fetch('/api/sweep', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ telemetry }), signal: controller.signal });
      const data = await response.json() as { cells?: Cell[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? `Sweep returned HTTP ${response.status}`);
      if (!controller.signal.aborted) setCells(data.cells ?? []);
    } catch (error) {
      if (controller.signal.aborted) return;
      if (!silent) toast.error(error instanceof Error ? error.message : 'Sweep failed');
    } finally { if (!controller.signal.aborted) setBusy(false); }
  }

  // Re-run the sensitivity sweep whenever the live telemetry hour or residency lock changes.
  const telemetryKey = telemetry?.length ? telemetry.map((n) => `${n.region}:${Math.round(n.carbon_ci)}:${Math.round(n.energy_price)}`).join('|') : '';
  useEffect(() => {
    if (!auto || !telemetryKey) return;
    const timer = window.setTimeout(() => void run(true), 900);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, telemetryKey, dpdp]);
  useEffect(() => () => abortRef.current?.abort(), []);

  const min = cells.length ? Math.min(...cells.map((c) => c.cost)) : 0;
  const max = cells.length ? Math.max(...cells.map((c) => c.cost)) : 1;
  const color = (cost: number) => { const t = (cost - min) / Math.max(1e-9, max - min); return `rgba(${Math.round(34 + 180 * t)},${Math.round(211 - 100 * t)},${Math.round(238 - 90 * t)},${0.25 + 0.55 * (1 - t)})`; };
  const nearest = (value: number, key: 'sla_ms' | 'carbon_tax') => cells.reduce((best, c) => Math.abs(c[key] - value) < Math.abs(best - value) ? c[key] : best, cells[0]?.[key] ?? value);
  const currentSla = controls && cells.length ? nearest(controls.sla_ms, 'sla_ms') : null;
  const currentTax = controls && cells.length ? nearest(controls.carbon_tax, 'carbon_tax') : null;

  return <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><div className="mb-2 flex items-center gap-2"><Grid3X3 className="h-4 w-4 text-cyan-300" /><h2 className="text-sm font-semibold">SLA × carbon-tax sweep</h2><label className="ml-auto flex items-center gap-1 text-[10px] text-slate-500"><input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />live</label><button type="button" onClick={() => void run()} className="rounded-lg bg-white/5 px-2 py-1 text-[10px] text-slate-300">{busy ? 'running…' : 'run sweep'}</button></div>{cells.length ? <><div className="grid grid-cols-10 gap-1">{cells.map((c) => { const isCurrent = c.sla_ms === currentSla && c.carbon_tax === currentTax; return <button type="button" key={`${c.sla_ms}-${c.carbon_tax}`} onClick={() => onPick?.(c.sla_ms, Number(c.carbon_tax.toFixed(2)))} title={`${c.sla_ms}ms · tax ${c.carbon_tax.toFixed(2)} · ${c.cost.toFixed(4)} — click to apply`} className={`relative h-5 rounded ${isCurrent ? 'ring-2 ring-white' : ''}`} style={{ background: color(c.cost) }}>{c.engine !== 'onnx' ? <span className="absolute inset-0 grid place-items-center text-[7px] text-slate-200">×</span> : null}</button>; })}</div><p className="mt-2 text-[10px] text-slate-600">Click a cell to apply its SLA and carbon tax. Outlined cell = current controls.</p></> : <p className="py-8 text-center text-xs text-slate-600">{busy ? 'Running 100-cell sweep…' : 'Run a 100-cell sensitivity sweep.'}</p>}</section>;
}
