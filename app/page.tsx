import Link from 'next/link';
import { ArrowRight, Atom, Brain, CalendarClock, Cpu, Globe2, Landmark, LineChart, MapPinned, ShieldCheck, Sigma, Zap } from 'lucide-react';
import BrandLogo from '@/components/BrandLogo';

const stats = [
  { v: '20', l: 'Regions modelled' },
  { v: '2', l: 'Quantum methods: QAOA · Annealing' },
  { v: '168 h', l: 'Seeded telemetry window' },
  { v: 'QUBO', l: 'Formulation & validation' },
];

const features = [
  { icon: Globe2, t: 'Live control plane', d: 'A 3D globe, telemetry charts, a decision feed and a time scrubber show carbon intensity, energy price and latency across 20 regions.' },
  { icon: Cpu, t: 'Hybrid optimization', d: 'QAOA and annealing propose binary workload decisions; ONNX, GLPK and classical references support comparison and fallback.' },
  { icon: Atom, t: 'Quantum optimization laboratory', d: 'Experiment with QAOA, SPSA tuning and digitized quantum annealing, with local simulation and optional cloud CPU/GPU batches.' },
  { icon: Landmark, t: 'Treasury engine', d: 'Carbon-credit offsets, projected APY, budget burn-down, allocation editor and Sankey flows tie emissions to money.' },
  { icon: CalendarClock, t: 'Realistic scheduling', d: 'Durations, CPU/GPU capacity, dependencies, earliest starts, deadlines, latency limits and India-only residency constraints.' },
  { icon: MapPinned, t: 'Residency aware', d: 'DPDP-style India-only placement can be locked for the whole fleet or per job, and every rejection is explained.' },
  { icon: LineChart, t: 'Forecasts, QENN & replay', d: 'Compare measured classical forecast baselines with an experimental two-qubit quantum-enhanced neural readout, and replay past-only scenarios.' },
  { icon: Sigma, t: 'Stress tests', d: 'Seeded correlated energy and carbon shocks with hedge premium, liquidity reserve, percentiles and tail-mean exports.' },
  { icon: Sigma, t: 'QUBO & Ising inspection', d: 'Inspect quadratic coefficients and Ising parameters, export formulations and check equivalence before using quadratic representations.' },
  { icon: Brain, t: 'Research-grade comparisons', d: 'Compare quantum candidates against exact, greedy, local-search and simulated-annealing references on matched scenarios.' },
  { icon: ShieldCheck, t: 'Approval & dry-run', d: 'Draft → approval → dry-run → rollback, with suspended Kubernetes Job exports and a full local audit trail.' },
];

const steps = [
  ['Observe', 'Hourly carbon, price, latency and egress for every region.'],
  ['Forecast', 'Seasonal baselines with measured error and coverage.'],
  ['Optimise', 'Run quantum candidates and classical reference methods on shared scenarios.'],
  ['Verify', 'Check complete schedules for feasibility and compare plan quality.'],
  ['Execute', 'Approve, dry-run, export and roll back safely.'],
];

const glass = 'glass rounded-2xl';

export default function Landing() {
  return (
    <div className="min-h-screen">
      <nav className="sticky top-0 z-20 mx-auto mt-3 flex max-w-6xl items-center justify-between gap-4 px-3">
        <div className={`${glass} flex w-full items-center justify-between gap-3 px-4 py-2`}>
          <BrandLogo href="/" size={44} />
          <div className="hidden items-center gap-6 text-sm text-slate-300 md:flex">
            <a href="#features" className="hover:text-white">Features</a>
            <a href="#how" className="hover:text-white">How it works</a>
            <a href="#research" className="hover:text-white">Research</a>
            <a href="#data" className="hover:text-white">Data & honesty</a>
          </div>
          <div className="flex gap-2">
            <Link href="/quantum-lab" className="lab-button inline-flex items-center gap-1.5"><Atom className="h-4 w-4"/>Quantum Lab</Link>
            <Link href="/experiments" className="lab-button hidden sm:inline-flex">Experiments</Link>
            <Link href="/dashboard" className="lab-button lab-primary">Launch dashboard</Link>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-6xl space-y-6 px-3 pb-16 pt-8">
        <section className={`${glass} flex flex-col items-center px-6 py-14 text-center sm:py-20`}>
          <BrandLogo variant="full" size={190} />
          <p className="mt-8 text-xs uppercase tracking-[.3em] text-fuchsia-300">Quantum-First Carbon &amp; Treasury Research Platform</p>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">Run compute where it is cleanest, cheapest and compliant.</h1>
          <p className="mt-5 max-w-2xl text-base text-slate-300">A quantum-first research workspace for carbon-aware workload planning across 20 modeled regions. Compare QAOA and digitized annealing with classical references, inspect QUBO formulations, and explore forecasting and treasury trade-offs.</p>
          <p className="mt-3 max-w-2xl text-xs text-slate-300">Quantum execution is simulated and bounded. Forecasting and some controller modes remain classical; accepted plans require global feasibility checks.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/dashboard" className="lab-button lab-primary !px-6 !py-3 !text-sm">Launch dashboard <ArrowRight className="ml-2 h-4 w-4" /></Link>
            <Link href="/experiments" className="lab-button !px-6 !py-3 !text-sm">Open experiment workspace</Link>
            <Link href="/quantum-lab" className="lab-button !px-6 !py-3 !text-sm"><Atom className="mr-2 inline h-4 w-4"/>Open Quantum Lab</Link>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {stats.map(s => <div key={s.l} className={`${glass} px-4 py-5 text-center`}><p className="text-3xl font-semibold text-emerald-300">{s.v}</p><p className="mt-1 text-xs text-slate-400">{s.l}</p></div>)}
        </section>

        <section id="features" className="scroll-mt-24">
          <h2 className="mb-4 px-1 text-2xl font-semibold">Everything in one place</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon: Icon, t, d }) => (
              <article key={t} className={`${glass} p-5`}>
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-fuchsia-400/25 to-emerald-400/25 text-emerald-300"><Icon className="h-5 w-5" /></span>
                <h3 className="mt-4 text-base font-semibold">{t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{d}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="how" className={`${glass} scroll-mt-24 p-6 sm:p-8`}>
          <h2 className="text-2xl font-semibold">How it works</h2>
          <ol className="mt-6 grid gap-4 md:grid-cols-5">
            {steps.map(([t, d], i) => (
              <li key={t} className="rounded-xl border border-white/10 bg-black/30 p-4">
                <span className="text-xs font-semibold text-fuchsia-300">0{i + 1}</span>
                <h3 className="mt-1 font-semibold">{t}</h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">{d}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="research" className={`${glass} scroll-mt-24 p-6 sm:p-8`}>
          <h2 className="text-2xl font-semibold">Quantum research, verified decisions</h2>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-300">The experiment workspace offers quantum-first candidate generation with QAOA and digitized annealing. Constraint verification protects scheduling decisions, while classical solvers provide transparent reference points and fallbacks.</p>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-black/30 p-4"><h3 className="text-sm font-semibold text-emerald-300">Optimization</h3><p className="mt-2 text-xs leading-relaxed text-slate-300">QAOA, SPSA parameter tuning, digitized quantum annealing, local parallel execution and optional cloud batches.</p></div>
            <div className="rounded-xl border border-white/10 bg-black/30 p-4"><h3 className="text-sm font-semibold text-emerald-300">Mathematical inspection</h3><p className="mt-2 text-xs leading-relaxed text-slate-300">QUBO / Ising coefficient exports with quadratic-equivalence diagnostics; higher-order objectives are not silently labeled exact QUBOs.</p></div>
            <div className="rounded-xl border border-white/10 bg-black/30 p-4"><h3 className="text-sm font-semibold text-emerald-300">Forecasting research</h3><p className="mt-2 text-xs leading-relaxed text-slate-300">Experimental two-qubit QENN and classical reference comparisons. Quantum predictive advantage is not assumed.</p></div>
          </div>
          <Link href="/experiments" className="lab-button mt-5">Explore research benchmarks <ArrowRight className="ml-2 h-4 w-4" /></Link>
        </section>

        <section id="data" className="grid scroll-mt-24 gap-3 md:grid-cols-2">
          <div className={`${glass} p-6`}>
            <Brain className="h-6 w-6 text-fuchsia-300" />
            <h2 className="mt-3 text-xl font-semibold">Reproducible by design</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">The starting dataset is 168 hours of deterministic synthetic telemetry seeded with 42 and clearly labelled. Import your own hourly CSV, save experiments in the browser, export portable JSON snapshots and generate a PDF report with assumptions and audit.</p>
          </div>
          <div className={`${glass} p-6`}>
            <Zap className="h-6 w-6 text-emerald-300" />
            <h2 className="mt-3 text-xl font-semibold">Honest about savings</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">Savings are compared on identical workloads and horizon, include energy, carbon charge, transfers and downtime, and are withheld when either plan leaves jobs unserved. Execution is always a dry run.</p>
          </div>
        </section>

        <section className={`${glass} flex flex-col items-center gap-4 px-6 py-10 text-center`}>
          <BrandLogo size={64} />
          <h2 className="text-2xl font-semibold">Ready to see the controller in action?</h2>
          <Link href="/dashboard" className="lab-button lab-primary !px-6 !py-3 !text-sm">Launch dashboard <ArrowRight className="ml-2 h-4 w-4" /></Link>
        </section>

        <footer className="flex items-center justify-center gap-3 pt-2 text-xs text-slate-400">
          <BrandLogo size={24} /> Carbon Ledger Quantum · Research &amp; Treasury
        </footer>
      </main>
    </div>
  );
}
