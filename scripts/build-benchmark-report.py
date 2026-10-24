"""Derive dashboard summaries from saved measurements, without inventing metrics."""
import json, math, statistics
from pathlib import Path
root=Path(__file__).resolve().parents[1]
timing=json.loads((root/'public/data/engines-v92.json').read_text())
quality=json.loads((root/'public/data/quality-v93.json').read_text())
methods=['glpk','standard','fluid','gaseous']
mean=statistics.mean

def stats(rows):
 t=sorted(r['ms'] for r in rows)
 q=lambda p:t[max(0,math.ceil(p*len(t))-1)]
 return dict(n=len(t),mean=mean(t),median=q(.5),p95=q(.95),p99=q(.99),minimum=min(t),maximum=max(t),sd=statistics.pstdev(t),under5=sum(x<=5 for x in t),feasible=sum(r['feasible'] for r in rows),guardRejected=sum(r['guardRejected'] for r in rows),qaoaMean=mean(r['qaoaMs'] for r in rows),remainingMean=mean(r['ms']-r['qaoaMs'] for r in rows))

groups={}
for family in ['all']+sorted({r['family'] for r in quality['rows']}):
 ids={r['scenario'] for r in quality['rows'] if family=='all' or r['family']==family}
 rows=[r for r in timing['rows'] if r['scenario'] in ids and r['version']=='v92']
 qr=[r for r in quality['rows'] if r['scenario'] in ids]
 by=[]
 for m in methods:
  mr=[r for r in rows if r['method']==m];mq=[r for r in qr if r['method']==m]
  bases={(r['scenario'],r['round']):r for r in rows if r['method']=='glpk'}
  gaps=[100*(r['objective']-bases[r['scenario'],r['round']]['objective'])/max(1e-12,abs(bases[r['scenario'],r['round']]['objective'])) for r in mr]
  by.append(dict(method=m,**stats(mr),maxGap=max(gaps),faster=sum(r['ms']<bases[r['scenario'],r['round']]['ms'] for r in mr) if m!='glpk' else 0,quality={key:mean(r[key] for r in mq) for key in ['carbon','energyPrice','latency','renewable','egress','activeRegions','objective']},equalAllocations=sum(r['maxWeightDifference']<=1e-8 for r in mq),uniqueScenarios=len(mq)))
 quantiles=[]
 for percentile in [0,10,25,50,75,90,95,99,100]:
  point={'percentile':percentile}
  for m in methods:
   t=sorted(r['ms'] for r in rows if r['method']==m);point[m]=t[max(0,math.ceil(percentile/100*len(t))-1)]
  quantiles.append(point)
 scenarios=[]
 for id in sorted(ids):
  scenarios.append({'id':id,**{m:stats([r for r in rows if r['method']==m and r['scenario']==id])['median'] for m in methods}})
 groups[family]={'engines':by,'quantiles':quantiles,'scenarios':scenarios}
out={'hardware':timing['hardware'],'equivalenceChecks':timing['equivalenceChecks'],'startup':timing['startup'],'beforeAfter':timing['summary'],'groups':groups,'qualityMethodology':quality['methodology']}
(root/'lib/benchmarkReportV93.json').write_text(json.dumps(out,indent=2))
