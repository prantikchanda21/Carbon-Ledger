'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { defaultQuantumExecution, readQuantumExecution, writeQuantumExecution, QUANTUM_EXECUTION_EVENT, type QuantumExecutionPreferences } from '@/lib/quantumExecutionPreferences';
export default function QuantumExecutionBar() {
  const [settings, setSettings] = useState<QuantumExecutionPreferences>(defaultQuantumExecution);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    const sync = () => setSettings(readQuantumExecution());
    sync(); window.addEventListener('storage', sync); window.addEventListener(QUANTUM_EXECUTION_EVENT, sync);
    return () => { window.removeEventListener('storage', sync); window.removeEventListener(QUANTUM_EXECUTION_EVENT, sync); };
  }, []);
  const change = <K extends keyof QuantumExecutionPreferences>(key: K, value: QuantumExecutionPreferences[K]) => {setSettings(old => ({...old,[key]:value})); setSaved(false);};
  const selectClass = 'min-w-0 rounded-lg border border-white/15 bg-slate-950/90 px-2 py-2 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-400';
  return <section aria-label="Quantum execution controls" className="glass rounded-2xl border border-cyan-400/20 px-4 py-3">
    <div className="flex flex-wrap items-center justify-between gap-2 mb-3"><div><h2 className="text-sm font-semibold text-cyan-100">Quantum execution</h2><p className="text-xs text-slate-400">Shared settings for the workload QAOA benchmark</p></div><Link href="/experiments" className="text-xs text-cyan-300 hover:text-cyan-100">Open experiments →</Link></div>
    <div className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-xs text-slate-300">Mode<select className={selectClass} value={settings.executionMode} onChange={e=>change('executionMode',e.target.value as QuantumExecutionPreferences['executionMode'])}><option value="auto">Auto (local)</option><option value="local">Local</option><option value="cloud">Cloud</option></select></label>
      <label className="flex flex-col gap-1 text-xs text-slate-300">Qubits (max 12)<input className={`${selectClass} w-20`} type="number" min={1} max={12} value={settings.maxQubits} onChange={e=>change('maxQubits',Math.max(1,Math.min(12,Math.floor(Number(e.target.value)||1))))}/></label>
      <label className="flex flex-col gap-1 text-xs text-slate-300">Memory budget<select className={selectClass} value={settings.memoryGb} onChange={e=>change('memoryGb',Number(e.target.value))}>{[2,4,8,16,32].map(v=><option key={v} value={v}>{v} GB</option>)}</select></label>
      <label className="flex flex-col gap-1 text-xs text-slate-300">Hardware<select className={selectClass} value={settings.cloudBackend} disabled={settings.executionMode!=='cloud'} onChange={e=>change('cloudBackend',e.target.value as QuantumExecutionPreferences['cloudBackend'])}><option value="auto">Auto</option><option value="cpu">Cloud CPU</option><option value="gpu">Cloud GPU</option></select></label>
      <button type="button" onClick={()=>{writeQuantumExecution(settings);setSaved(true);}} className="rounded-lg border border-cyan-400/40 bg-cyan-500/15 px-4 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/25">Apply settings</button>
      {saved&&<span role="status" className="text-xs text-emerald-300">Saved for next QAOA run</span>}
    </div>
    <p className="mt-2 text-xs text-slate-400">Actual qubits depend on the eligible workload count. GPU needs a configured cloud worker. Settings do not affect carbon forecasts.</p>
  </section>;
}
