'use client';

import { Pause, Play, RotateCcw } from 'lucide-react';
import { SPEED_OPTIONS } from '@/lib/simClock';
import { useControllerStore } from '@/lib/store';

export default function TimeScrubber() {
  const time = useControllerStore((s) => s.simulationTime);
  const speed = useControllerStore((s) => s.simSpeed);
  const playing = useControllerStore((s) => s.playing);
  const setSimulation = useControllerStore((s) => s.setSimulation);
  const start = new Date(time); start.setUTCHours(0, 0, 0, 0);
  const hour = time.getUTCHours() + time.getUTCMinutes() / 60;
  function scrub(v: number): void {
    const next = new Date(start.getTime() + v * 3_600_000);
    setSimulation(next, speed, false);
  }
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/85 p-3 shadow-[0_-18px_70px_-35px_rgba(6,182,212,0.4)] backdrop-blur-2xl">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => setSimulation(time, speed, !playing)} className="grid h-9 w-9 place-items-center rounded-xl bg-cyan-400/15 text-cyan-200" aria-label={playing ? 'Pause simulation' : 'Play simulation'}>{playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}</button>
        <button type="button" onClick={() => scrub(12)} className="grid h-9 w-9 place-items-center rounded-xl bg-white/5 text-slate-300" aria-label="Reset to noon"><RotateCcw className="h-4 w-4" /></button>
        <input aria-label="24 hour simulation time" type="range" min="0" max="23.99" step="0.25" value={hour} onChange={(e) => scrub(Number(e.target.value))} className="range-slider flex-1" />
        <span className="w-16 text-right text-sm font-semibold tabular-nums text-slate-200">{String(time.getUTCHours()).padStart(2,'0')}:{String(time.getUTCMinutes()).padStart(2,'0')}Z</span>
        <select aria-label="Simulation speed" value={speed} onChange={(e) => setSimulation(time, Number(e.target.value), playing)} className="rounded-xl border border-white/10 bg-slate-900 px-2 py-2 text-xs text-slate-300">
          {SPEED_OPTIONS.map((v) => <option key={v} value={v}>{v}×</option>)}
        </select>
      </div>
      <div className="mt-2 flex justify-between px-12 text-[10px] uppercase tracking-[0.16em] text-slate-600"><span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>24:00</span></div>
    </div>
  );
}
