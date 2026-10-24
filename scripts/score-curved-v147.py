import json,math,statistics
from pathlib import Path
import numpy as np
from scipy.optimize import linprog
root=Path(__file__).resolve().parents[1]
rows=json.loads((root/'research/benchmarks/archived/V147-QUANTUM-BENCHMARK-RAW.json').read_text())
metrics=('carbon','operatingCost','latency','risk','treasuryApy')
summary={}
for r in rows:
 inp=r['input'];n=20
 if r.get('lpObjective') is None:
  c=np.array(inp['costs']+[inp['regularization']]*n)
  A=np.zeros((n*2,n*2));b=np.zeros(n*2)
  for i in range(n):
   A[2*i,i]=1;A[2*i,n+i]=-1;b[2*i]=inp['preferred'][i]
   A[2*i+1,i]=-1;A[2*i+1,n+i]=-1;b[2*i+1]=-inp['preferred'][i]
  x=linprog(c,A_ub=A,b_ub=b,A_eq=np.array([[1.]*n+[0.]*n]),b_eq=[1.],bounds=[(0,v) for v in inp['caps']]+[(0,None)]*n,method='highs')
  assert x.success,x.message
  r['lpObjective']=float(x.fun);r['lpWeights']=list(map(float,x.x[:n]));r['glpkExecuted']=False
 else:
  r['lpWeights']=None
 for mode,v in r['engines'].items():
  w=v['weights'];v['gapPct']=100*(v['objective']-r['lpObjective'])/max(abs(r['lpObjective']),1e-12)
  assert v['gapPct']>=-1e-5,(r['set'],mode,v['gapPct'])
  assert v['feasible'] and abs(sum(w)-1)<1e-8 and all(-1e-10<=a<=b+1e-8 for a,b in zip(w,inp['caps']))
 for m in metrics:
  if r['lpWeights']:
   feature='operating' if m=='operatingCost' else 'apy' if m=='treasuryApy' else m
   r.setdefault('lpMetrics',{})[m]=float(np.dot(r['lpWeights'],r['features'][feature]))
for dataset in ('train','holdout','unseen','prospective'):
 cases=[r for r in rows if r['set']==dataset]
 summary[dataset]={}
 for mode in ['geometry','grover','curved','fusion','quad']:
  arr=[r['engines'][mode] for r in cases];ts=sorted(v['ms'] for v in arr)
  summary[dataset][mode]={
   'meanObjectiveGapPct':statistics.mean(v['gapPct'] for v in arr),
   'medianObjectiveGapPct':statistics.median(v['gapPct'] for v in arr),
   'worstObjectiveGapPct':max(v['gapPct'] for v in arr),
   'medianLocalRuntimeMs':statistics.median(ts),
   'p95LocalRuntimeMs':ts[math.ceil(.95*len(ts))-1],
   'feasible':sum(v['feasible'] for v in arr),
   'winVsOriginalGeometry':sum(v['objective']<r['engines']['geometry']['objective']-1e-12 for v,r in zip(arr,cases)),
   'meanMetrics':{m:statistics.mean(v['metrics'][m] for v in arr) for m in metrics},
  }
  if mode in ('curved','fusion'):
   summary[dataset][mode]['meanUniformSamplingGapPct']=statistics.mean(100*(v['uniformSampleObjective']/r['lpObjective']-1) for v,r in zip(arr,cases))
   summary[dataset][mode]['meanPoolBestGapPct']=statistics.mean(100*(v['candidatePoolBest']/r['lpObjective']-1) for v,r in zip(arr,cases))
   summary[dataset][mode]['fractionCasesPoolBestSampled']=sum(v['objective']<=v['candidatePoolBest']+1e-10 for v in arr)/len(arr)
 if dataset in ('unseen','prospective'):
  summary[dataset]['highs']={'meanMetrics':{m:statistics.mean(r['lpMetrics'][m] for r in cases) for m in metrics}}
(root/'research/benchmarks/archived/V147-BENCHMARK-SUMMARY.json').write_text(json.dumps(summary,indent=2))
(root/'research/benchmarks/archived/V147-BENCHMARK-ALL-CASES.json').write_text(json.dumps(rows,indent=2))
print(json.dumps(summary,indent=2))
