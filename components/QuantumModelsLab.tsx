'use client';
import Link from 'next/link';
import DashboardSidebar from './DashboardSidebar';
import LiveQuantumLab from './LiveQuantumLab';
import ibmEvidence from '@/lib/ibmHardwareEvidence.json';
export default function QuantumModelsLab(){
 const evidence=ibmEvidence.results[0];
 return <main className="carbon-research carbon-workspace relative z-10 mx-auto max-w-[1440px] space-y-4 p-4 text-slate-100 sm:p-6">
  <DashboardSidebar/><header className="lab-card !p-5">
   <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-widest text-emerald-300">Carbon Ledger · Research workspace</p><h1 className="mt-1 text-2xl font-bold">Quantum Lab</h1><p className="lab-note mt-2 max-w-3xl">Run one engine or compare five active approaches on the same modeled 20-region workload. Results are calculated on demand; hardware evidence is recorded separately.</p></div><Link className="lab-button" href="/dashboard">Back to dashboard →</Link></div>
  </header>
  <LiveQuantumLab/>
  <details className="lab-card group"><summary className="cursor-pointer text-base font-semibold text-emerald-100">Research evidence and methodology <span className="ml-2 text-xs font-normal text-slate-400">Recorded data · optional</span></summary>
   <div className="mt-4 space-y-4 border-t border-white/10 pt-4 text-sm text-slate-300">
    <p>Live comparisons run modeled, server-side calculations; they do not submit IBM jobs. Recorded hardware results below are an independent small-circuit validation, not proof that quantum optimization beats GLPK.</p>
    <div className="grid gap-3 md:grid-cols-3"><div className="rounded-xl border border-white/10 p-3"><p className="lab-note">Recorded processor</p><strong className="break-all">{evidence.backend}</strong></div><div className="rounded-xl border border-white/10 p-3"><p className="lab-note">Circuit and measurements</p><strong>{evidence.num_qubits} qubits · {evidence.shots} shots · depth 1</strong></div><div className="rounded-xl border border-white/10 p-3"><p className="lab-note">Valid one-hot measurements</p><strong>{(100*evidence.hardware_feasible_probability).toFixed(2)}%</strong></div></div>
    <p className="lab-note">IBM job identifier: <code className="break-all">{evidence.job_id}</code></p>
    <Link href="/history" className="lab-button inline-flex">Open historical hardware evidence →</Link>
    <div className="rounded-xl border border-white/10 p-3"><strong>Interpretation</strong><p className="lab-note mt-1">GLPK is a classical optimization reference. QAOA variants generate candidate selections that GLPK can refine. A hybrid result can equal the classical baseline, and engine latency includes computation rather than network time. No quantum advantage is claimed.</p></div>
   </div>
  </details>
 </main>;
}
