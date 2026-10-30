"""Evaluate the A*-guided quantum ensemble against the exact convex-L1 LP (SciPy HiGHS).
Run `node --experimental-strip-types --no-warnings scripts/benchmark-graph-search-v133.mjs > V145-GRAPH-SEARCH-RAW.json`
then `python scripts/evaluate-astar-v145.py`.
This is NOT GLPK. JS worker timings and Python HiGHS timings are NOT matched overhead measurements.
"""
import json
import math
import statistics
import time
from pathlib import Path
import numpy as np
from scipy.optimize import linprog
root = Path(__file__).resolve().parent.parent
cases = json.loads((root/'research/benchmarks/archived/V145-GRAPH-SEARCH-RAW.json').read_text())
rows=[]
for x in cases:
    d=x['input']; c=np.asarray(d['costs']); caps=np.asarray(d['caps']); pref=np.asarray(d['preferred']); reg=d['regularization']; n=len(c)
    # Exact LP linearization of the absolute deviation objective.
    objective=np.r_[c,np.full(n,reg)]
    inequalities=np.vstack([np.c_[np.eye(n),-np.eye(n)],np.c_[-np.eye(n),-np.eye(n)]])
    bounds=np.r_[pref,-pref]
    start=time.perf_counter()
    result=linprog(objective,A_ub=inequalities,b_ub=bounds,A_eq=np.r_[np.ones(n),np.zeros(n)].reshape(1,-1),b_eq=np.array([1.]),bounds=[(0,float(cap)) for cap in caps]+[(0,None)]*n,method='highs')
    lp_ms=(time.perf_counter()-start)*1000
    if not result.success: raise RuntimeError(f'LP failed on scenario {x["caseId"]}: {result.message}')
    w=result.x[:n]; lp=float(np.dot(w,c)+reg*np.abs(w-pref).sum()); quantum=x['ensemble']['objective']; gap=100*(quantum-lp)/max(abs(lp),1e-9)
    lp_metrics={k:float(np.dot(w,values)) for k,values in x['features'].items()}
    lp_metrics['operatingCost']=lp_metrics.pop('operating');lp_metrics['treasuryApy']=lp_metrics.pop('apy')
    rows.append({'caseId':x['caseId'],'gapPct':gap,'ensembleObjective':quantum,'lpObjective':lp,'ensembleMs':x['ensemble']['ms'],'lpMs':lp_ms,'lpMetrics':lp_metrics,'ensembleMetrics':x['ensemble']['metrics'],'feasible':x['ensemble']['feasible']})
p95=lambda a:sorted(a)[math.ceil(.95*len(a))-1]
summary={'n':len(rows),'meanGapPct':statistics.mean(r['gapPct'] for r in rows),'worstGapPct':max(r['gapPct'] for r in rows),'ensembleMedianMs':statistics.median(r['ensembleMs'] for r in rows),'ensembleP95Ms':p95([r['ensembleMs'] for r in rows]),'lpMedianMs':statistics.median(r['lpMs'] for r in rows),'feasible':sum(r['feasible'] for r in rows),'meanMetrics':{k:{'ensemble':statistics.mean(r['ensembleMetrics'][k] for r in rows),'LP':statistics.mean(r['lpMetrics'][k] for r in rows)} for k in ['carbon','operatingCost','latency','risk','treasuryApy']}}
(root/'research/benchmarks/archived/V145-BENCHMARK-RESULTS.json').write_text(json.dumps({'summary':summary,'rows':rows},indent=2))
print(json.dumps(summary,indent=2))
