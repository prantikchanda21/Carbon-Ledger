import json,time,numpy as np
from scipy.optimize import linprog
from pathlib import Path
r=json.load(open('/mnt/data/v138/oracle-v138-raw.json'));out=[]
for row in r:
 inp=row['input'];c=np.array(inp['costs']);p=np.array(inp['preferred']);lam=inp['regularization'];n=len(c)
 params=dict(c=np.r_[c,np.full(n,lam)],A_ub=np.vstack([np.c_[np.eye(n),-np.eye(n)],np.c_[-np.eye(n),-np.eye(n)]]),b_ub=np.r_[p,-p],A_eq=np.array([[*([1]*n),*([0]*n)]]),b_eq=[1],bounds=[*((0,x) for x in inp['caps']),*((0,None) for _ in range(n))],method='highs')
 t=time.perf_counter();res=linprog(**params);ms=(time.perf_counter()-t)*1000
 assert res.success
 q=row['oracle'];w=np.array(q['weights']);ref=res.x[:n];f=row['features']
 def metrics(w):return {k:float(w@np.array(f[key])) for k,key in [('carbon','carbon'),('operating','operating'),('latency','latency'),('risk','risk'),('apy','apy')]}
 out.append(dict(case=row['caseId'],gapPct=float(100*(q['objective']/res.fun-1)),quantumMs=q['ms'],lpMs=ms,quantumObjective=q['objective'],lpObjective=float(res.fun),quantum=metrics(w),reference=metrics(ref),l1=float(np.abs(w-ref).sum()),feasible=bool(abs(w.sum()-1)<1e-8 and np.all(w>=-1e-10) and np.all(w<=np.array(inp['caps'])+1e-8)),maxNormDeviation=max(abs(x-1) for x in q['norms'])))
assert all(x['feasible'] and x['maxNormDeviation']<1e-8 for x in out)
def summary():
 d={'cases':len(out),'meanGapPct':np.mean([x['gapPct'] for x in out]),'worstGapPct':max(x['gapPct'] for x in out),'medianEngineMs':np.median([x['quantumMs'] for x in out]),'p95EngineMs':np.percentile([x['quantumMs'] for x in out],95),'medianHighsMs':np.median([x['lpMs'] for x in out]),'p95HighsMs':np.percentile([x['lpMs'] for x in out],95),'meanAllocationL1':np.mean([x['l1'] for x in out])}
 for k in ['carbon','operating','latency','risk','apy']:
  d[f'quantum_{k}']=np.mean([x['quantum'][k] for x in out]);d[f'lp_{k}']=np.mean([x['reference'][k] for x in out])
 return {k:float(v) for k,v in d.items()}
s=summary();root=Path('/mnt/data/v138');(root/'benchmark-v138-results.json').write_text(json.dumps({'summary':s,'cases':out},indent=2));print(json.dumps(s,indent=2))
(root/'QUANTUM-ORACLE-v138-REPORT.md').write_text('''# Carbon Ledger v138 — Quantum Oracle Research Benchmark

**32 synthetic 20-region cases.** Quantum simulation on CPU; this is not quantum hardware. Classical cost-aware candidate generation, energy ranking for threshold oracle, objective scoring, and final sampled-candidate selection remain in use. No GLPK, LP or analytical optimizer contributes an allocation candidate. Thus the full method is **hybrid quantum-classical**, not pure quantum or proof of quantum advantage.

The LP reference is **SciPy HiGHS, not GLPK**. This comparison has a different computational budget; LP timings include SciPy solver-call overhead, while quantum timings measure one warm in-process engine call. Neither reflects deployed API latency. The candidate objective is linear regional cost plus L1 deviation penalty; it omits any other production constraints not represented in this benchmark.

## Results

| Metric | v138 quantum oracle | SciPy HiGHS reference |
|---|---:|---:|
| Mean objective gap | %.3f%% | 0%% |
| Worst objective gap | %.3f%% | 0%% |
| Median solver time | %.3f ms | %.3f ms |
| P95 solver time | %.3f ms | %.3f ms |
| Normalized carbon | %.6f | %.6f |
| Normalized operating cost | %.6f | %.6f |
| Normalized latency | %.6f | %.6f |
| Normalized risk | %.6f | %.6f |
| Treasury APY | %.3f%% | %.3f%% |
| Feasibility | %d/32 | 32/32 |
| Mean allocation L1 difference | %.4f | 0 |

The runtime and solution-quality improvements cannot be attributed solely to quantum operations: the v138 candidate preparation uses cost-aware classical sorting. The final selected allocation does depend on quantum statevector measurement, without a classical optimal fallback.

Run `node --experimental-strip-types scripts/benchmark-oracle-v136.mjs > results.json` from project root to collect simulated oracle outputs; SciPy HiGHS comparison is in `scripts/report-v138.py` (expects `/mnt/data/v138/oracle-v138-raw.json` from this run in the current benchmark environment). The packaged JSON contains complete recorded results.
'''%(s['meanGapPct'],s['worstGapPct'],s['medianEngineMs'],s['medianHighsMs'],s['p95EngineMs'],s['p95HighsMs'],s['quantum_carbon'],s['lp_carbon'],s['quantum_operating'],s['lp_operating'],s['quantum_latency'],s['lp_latency'],s['quantum_risk'],s['lp_risk'],s['quantum_apy']*100,s['lp_apy']*100,len(out),s['meanAllocationL1']))
