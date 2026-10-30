"""Reproducible independent LP audit. SciPy HiGHS is NOT GLPK."""
from scipy.optimize import linprog
from pathlib import Path
import json, statistics, time, math
from collections import Counter
here=Path(__file__).resolve().parent
raw=json.loads((here/'raw.json').read_text())
results=[]
for row in raw['cases']:
    inp=row['input']; costs=inp['costs']; caps=inp['caps']; pref=inp['preferred']; reg=inp['regularization'];n=len(costs)
    c=costs+[reg]*n
    A_ub=[];b_ub=[]
    for i in range(n):
        a=[0.0]*(2*n);a[i]=1;a[n+i]=-1;A_ub.append(a);b_ub.append(pref[i])
        a=[0.0]*(2*n);a[i]=-1;a[n+i]=-1;A_ub.append(a);b_ub.append(-pref[i])
    args=dict(c=c, A_ub=A_ub,b_ub=b_ub,A_eq=[[1.0]*n+[0.0]*n],b_eq=[1.0],bounds=[(0,cap) for cap in caps]+[(0,None)]*n,method='highs')
    timings=[]
    for k in range(4):
        t=time.perf_counter_ns(); sol=linprog(**args); timings.append((time.perf_counter_ns()-t)/1e6)
        assert sol.success,sol.message
    weights=sol.x[:n];opt=sum(costs[i]*weights[i]+reg*abs(weights[i]-pref[i]) for i in range(n))
    metrics={key:sum(weights[i]*values[i] for i in range(n)) for key,values in row['features'].items()}
    quantum=row['quantum'];rand=row['classicalUniform']; control=row['groverOnly']
    for m in (quantum['objective'],rand['objective'],control['objective']):
       if m < opt-1e-7: raise AssertionError('candidate beats proven LP optimum unexpectedly')
    results.append({'id':row['id'],'lpObjective':opt,'quantumObjective':quantum['objective'],'classicalSamplingObjective':rand['objective'],'groverOnlyObjective':control['objective'],
       'quantumGapPct':100*(quantum['objective']-opt)/max(abs(opt),1e-10), 'samplingGapPct':100*(rand['objective']-opt)/max(abs(opt),1e-10), 'groverOnlyGapPct':100*(control['objective']-opt)/max(abs(opt),1e-10),
       'quantumMs':quantum['medianRuntimeMs'],'samplingMs':rand['medianRuntimeMs'],'lpMs':statistics.median(timings),
       'quantumMetrics':quantum['metrics'],'lpMetrics':metrics,'quantumFeasible':quantum['feasible'],'norms':quantum['norms']})
mean=lambda vals:sum(vals)/len(vals)
quantumBetter=sum(r['quantumObjective']<r['classicalSamplingObjective']-1e-10 for r in results)
quantumWorse=sum(r['quantumObjective']>r['classicalSamplingObjective']+1e-10 for r in results)
gaps=[r['quantumGapPct'] for r in results]
metricSummary={}
for m in ('carbon','operating','latency','risk','apy'):
  metricSummary[m]={'quantum':mean([x['quantumMetrics'][m] for x in results]),'lp':mean([x['lpMetrics'][m] for x in results])}
summary={'cases':len(results),'reference':'SciPy HiGHS, NOT GLPK','quantumGapMeanPct':mean(gaps),'quantumGapMaxPct':max(gaps),'quantumGapMedianPct':statistics.median(gaps), 'samplerGapMeanPct':mean([r['samplingGapPct'] for r in results]),'groverOnlyGapMeanPct':mean([r['groverOnlyGapPct'] for r in results]),'quantumMedianOfCaseMediansMs':statistics.median([r['quantumMs'] for r in results]),'samplingMedianOfCaseMediansMs':statistics.median([r['samplingMs'] for r in results]),'lpMedianOfCaseMediansMs':statistics.median([r['lpMs'] for r in results]),'quantumBetterThanUniformCases':quantumBetter,'quantumWorseThanUniformCases':quantumWorse,'quantumEqualUniformCases':len(results)-quantumBetter-quantumWorse,'feasible':sum(x['quantumFeasible'] for x in results),'metrics':metricSummary,
'gate':{'passes':False,'reason':'GLPK is unavailable; actual GLPK superiority unverified. Independently optimal HiGHS objective beats the quantum experiment on the same LP, so all-aspect dominance is impossible to certify.'}}
(here/'evaluated.json').write_text(json.dumps({'summary':summary,'cases':results},indent=2))
print(json.dumps(summary,indent=2))
