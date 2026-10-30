"""LP reference solved with SciPy HiGHS. It is NOT GLPK and must be labeled correctly."""
import json,statistics,math
import numpy as np
from scipy.optimize import linprog
from pathlib import Path
root=Path(__file__).resolve().parents[1]
import sys
label=sys.argv[1] if len(sys.argv)>1 else 'V146'
rows=json.loads((root/f'{label}-QUANTUM-RAW.json').read_text())
metrics=('carbon','operatingCost','latency','risk','treasuryApy')
modes=('quad','geometry','xy','grover')
for row in rows:
 inp=row['input']; n=len(inp['costs'])
 c=np.array(inp['costs']+[inp['regularization']]*n)
 A=np.zeros((2*n,2*n)); b=np.zeros(2*n)
 for i in range(n):
  A[2*i,i]=1;A[2*i,n+i]=-1;b[2*i]=inp['preferred'][i]
  A[2*i+1,i]=-1;A[2*i+1,n+i]=-1;b[2*i+1]=-inp['preferred'][i]
 res=linprog(c,A_ub=A,b_ub=b,A_eq=np.array([[1.]*n+[0.]*n]),b_eq=[1.],bounds=[(0,x) for x in inp['caps']]+[(0,None)]*n,method='highs')
 if not res.success:raise RuntimeError((row['caseId'],res.message))
 w=list(map(float,res.x[:n])); features=row['features']
 metric=lambda k:sum(x*y for x,y in zip(w,features[{'operatingCost':'operating','treasuryApy':'apy'}.get(k,k)]))
 row['lpReference']={'solver':'SciPy HiGHS (NOT GLPK)','objective':float(res.fun),'weights':w,'metrics':{m:metric(m) for m in metrics},'optimal':True}
 for key,engine in row['engines'].items():
  engine['gapPct']=100*(engine['objective']-res.fun)/max(abs(res.fun),1e-12)
  engine['l1VsLP']=sum(abs(a-b) for a,b in zip(engine['weights'],w))
  if engine['gapPct'] < -0.0001:raise RuntimeError('Better than LP optimum: wrong objective formulation')

mean=statistics.mean
summary={}
for key in modes:
 engines=[row['engines'][key] for row in rows]
 timing=sorted(r['ms'] for r in engines)
 summary[key]={'meanGapPct':mean(e['gapPct'] for e in engines),'worstGapPct':max(e['gapPct'] for e in engines),
 'medianMs':statistics.median(timing),'p95Ms':timing[math.ceil(.95*len(timing))-1],
 'meanL1AllocationDelta':mean(e['l1VsLP'] for e in engines),
 'meanWorkloadShiftPct':50*mean(e['l1VsLP'] for e in engines),
 'feasibleScenarios':sum(e['feasible'] for e in engines),
 'meanMetrics':{m:mean(e['metrics'][m] for e in engines) for m in metrics}}
summary['highs']={'meanGapPct':0,'meanMetrics':{m:mean(r['lpReference']['metrics'][m] for r in rows) for m in metrics},'allOptimal':len(rows)}
(root/f'{label}-EXACT-LP-COMPARISON.json').write_text(json.dumps({'summary':summary,'cases':rows},indent=2))
(root/f'{label}-EXACT-LP-SUMMARY.json').write_text(json.dumps(summary,indent=2))
print(json.dumps(summary,indent=2))
