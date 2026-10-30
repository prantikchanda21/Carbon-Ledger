import Link from 'next/link';
import { ArrowRight, Atom, BarChart3, Cloud, Cpu, Leaf, Waves } from 'lucide-react';
import BrandLogo from '@/components/BrandLogo';
import FlameHero from '@/components/FlameHero';

const pillars=[
 {title:'Carbon-aware telemetry',desc:'Compare modeled carbon intensity, region cost, latency, capacity and compliance across 20 cloud regions.',icon:Leaf},
 {title:'Dynamic hybrid allocation',desc:'Generate QAOA candidate decisions, validate them against GLPK and display the allocation actually selected.',icon:Cloud},
 {title:'Measured benchmarks',desc:'Explore recorded timings, feasibility, quality guards and honest quantum-versus-classical comparisons.',icon:BarChart3},
];
const engines=[
 {name:'GLPK',tag:'Classical benchmark reference',detail:'Linear programming solver baseline. 200-case median 1.878 ms.',icon:Cpu},
 {name:'Quantum Oracle',tag:'7q · Grover sampling',detail:'Zero rounded objective gap reported in the 200-case run; identical GLPK outputs must be audited.',icon:Atom},
 {name:'Curvilinear Fusion',tag:'10q · depth 3',detail:'Curved Hamiltonian phases, XY mixing and Grover. Reported 16.17% objective gap on the 200-case run.',icon:Waves},
 {name:'Adaptive Grover',tag:'10q · depth 3',detail:'Simulated amplitude amplification. Reported 16.20% objective gap on the 200-case run.',icon:Atom},
 {name:'Geometry-Aware Walk',tag:'10q · depth 3',detail:'XY quantum walk mixing and cost phases. Reported 16.66% gap on 200 cases.',icon:Atom},
];
export default function Landing(){return <main className="landing text-slate-100">
 <header className="relative z-20 mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-4"><BrandLogo href="/" size={50}/><nav aria-label="Main navigation" className="glass-pill flex flex-wrap items-center gap-2 rounded-full p-1.5 text-sm"><Link href="/ibm-hardware" className="rounded-full px-4 py-2 text-emerald-100 hover:bg-white/10">IBM Hardware</Link><Link href="/research" className="rounded-full px-4 py-2 text-emerald-100 hover:bg-white/10">Benchmarks</Link><Link href="/quantum-lab" className="rounded-full px-4 py-2 text-emerald-100 hover:bg-white/10">Quantum Lab</Link><Link href="/dashboard" className="rounded-full bg-white px-4 py-2 font-bold text-emerald-950 hover:bg-emerald-100">Launch dashboard</Link></nav></header>
 <section className="landing-stage" aria-label="Carbon Ledger overview">
  <FlameHero className="hero-ring">
   <div className="flex flex-col items-center text-center">
    <p className="glass-pill rounded-full px-4 py-1.5 text-xs font-semibold text-emerald-100">20-region quantum cloud operations terminal</p>
    <h1 className="mt-3 max-w-4xl text-balance text-[clamp(1.6rem,3.4vw,3rem)] font-black leading-[1.08] tracking-tight text-white">Carbon-aware cloud operations, quantum research, and scenario intelligence.</h1>
    <div className="mt-4 flex flex-wrap justify-center gap-3"><Link href="/dashboard" className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-2.5 font-bold text-emerald-950 shadow-[0_0_30px_rgba(52,211,153,.55)] hover:bg-emerald-100">Launch operations <ArrowRight className="h-4 w-4"/></Link><Link href="/research" className="glass-pill rounded-full px-6 py-2.5 font-semibold text-white hover:bg-white/15">View benchmarks</Link></div>
    <div className="mt-5 grid w-full gap-3 sm:grid-cols-3">{pillars.map(({title,desc,icon:Icon})=><article key={title} className="hero-glass rounded-2xl p-3.5 text-left"><div className="flex items-center gap-2"><Icon className="h-5 w-5 shrink-0 text-emerald-200"/><h3 className="text-sm font-bold leading-tight">{title}</h3></div><p className="hero-desc mt-1.5 text-xs leading-5 text-emerald-100/80">{desc}</p></article>)}</div>
    <div className="mt-3 grid w-full gap-3 sm:grid-cols-2 lg:grid-cols-5">{engines.map(({name,tag,detail,icon:Icon})=><article key={name} className="hero-glass rounded-2xl p-3.5 text-left"><div className="flex items-center gap-2"><Icon className="h-5 w-5 shrink-0 text-emerald-200"/><div className="min-w-0"><p className="text-[11px] font-semibold text-emerald-200">{tag}</p><h3 className="text-sm font-bold leading-tight">{name}</h3></div></div><p className="hero-desc mt-1.5 text-xs leading-5 text-emerald-100/80">{detail}</p></article>)}</div>
    <p className="hero-desc mt-3 max-w-3xl text-xs leading-5 text-emerald-100/70">Only five distinct active engines are exposed. Independent quantum modes calculate their own feasible allocations without a GLPK solution fallback. The displayed gaps come from the user’s 200-scenario v147 GLPK comparison; no quantum advantage is claimed.</p>
   </div>
  </FlameHero>
 </section>
 </main>}
