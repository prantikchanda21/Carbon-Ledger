'use client';
import { useEffect, useState } from 'react';
import { useControllerStore } from '@/lib/store';

const story = [
  ['Baseline', 'Review the synthetic default telemetry and baseline controller allocation.'],
  ['Shock', 'Apply the carbon-price or regional-SLA stress preset and watch the controller re-plan.'],
  ['Re-plan', 'Compare cost, carbon intensity, and rejected-region explanations.'],
  ['Resilience', 'Use the existing engine race and chaos controls to demonstrate failover.'],
  ['Audit', 'Review the decision feed, downloadable CSV and the dry-run boundaries.'],
];
export default function GuidedDemo() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const setControls = useControllerStore(s => s.setControls);
  useEffect(() => { if (new URLSearchParams(window.location.search).get('demo') === '1') setOpen(true); }, []);
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
      if (event.key === 'ArrowRight') setStep(s => Math.min(story.length - 1, s + 1));
      if (event.key === 'ArrowLeft') setStep(s => Math.max(0, s - 1));
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  return <section className="rounded-xl border border-cyan-400/20 bg-slate-950/90 p-3 text-xs text-slate-300" aria-label="Guided hackathon demo">
    <div className="flex flex-wrap items-center gap-2"><strong className="text-cyan-200">Guided demonstration</strong><span className="rounded bg-amber-400/10 px-2 py-1 text-amber-200">Synthetic data · dry run only</span><button type="button" className="ml-auto rounded bg-cyan-300/10 px-3 py-1.5 text-cyan-100" onClick={() => setOpen(v => !v)}>{open ? 'Close guide' : 'Start demo'}</button></div>
    {open && <div className="mt-3 space-y-3"><div className="flex items-center justify-between gap-2"><strong className="text-slate-100">{step + 1}/{story.length} · {story[step][0]}</strong><span>← / →</span></div><p>{story[step][1]}</p>
      <div className="flex flex-wrap gap-2"><button type="button" className="rounded bg-amber-300/10 px-3 py-1.5" onClick={() => setControls({carbon_tax: 1})}>Carbon price spike</button><button type="button" className="rounded bg-cyan-300/10 px-3 py-1.5" onClick={() => setControls({sla_ms: 25})}>Tight SLA</button><button type="button" className="rounded bg-cyan-300/10 px-3 py-1.5" onClick={() => setControls({dpdp_locked: true})}>India-only</button><button type="button" className="rounded bg-slate-600/30 px-3 py-1.5" onClick={() => setControls({carbon_tax: .5, sla_ms: 100, dpdp_locked: false})}>Reset demo controls</button></div>
      <div className="flex justify-between"><button type="button" disabled={step===0} className="rounded bg-white/10 px-3 py-1.5 disabled:opacity-30" onClick={() => setStep(s => s - 1)}>Previous</button><button type="button" className="rounded bg-cyan-400/20 px-3 py-1.5 text-cyan-100" onClick={() => step === story.length-1 ? setOpen(false) : setStep(s => s + 1)}>{step === story.length-1 ? 'Finish' : 'Next'}</button></div>
    </div>}
  </section>;
}
