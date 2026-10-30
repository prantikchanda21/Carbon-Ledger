"""Run once offline. The web UI reads this small static report on demand."""
import argparse,json,hashlib,time,platform
from pathlib import Path
import numpy as np
from .solver import make_problem,problem_from_choices,solve,serial_problem,MODELS

def run(scenarios=8,budget=100,seed=42,depths=(1,2),workloads=2,scenarios_csv=None):
    imported=[]
    if scenarios_csv:
        import csv
        grouped={}
        with open(scenarios_csv,newline='') as f:
            for row in csv.DictReader(f):
                scenario_id=row.pop('scenario')
                row={k:row[k] for k in ('workload','region','slot','kwh','carbon','price','migration','allowed')}
                row['slot']=int(row['slot'])
                for k in ('kwh','carbon','price','migration'): row[k]=float(row[k])
                if row['allowed'].lower() not in ('true','false','1','0'):raise ValueError('allowed must be true/false/1/0')
                row['allowed']=row['allowed'].lower() in ('true','1')
                grouped.setdefault(scenario_id,[]).append(row)
        imported=[problem_from_choices(rows,seed+i,f'imported-{key}') for i,(key,rows) in enumerate(grouped.items())]
        scenarios=len(imported)
        if not 1<=scenarios<=100:raise ValueError('CSV must contain 1–100 scenarios')
    runs=[];started=time.perf_counter()
    for scenario in range(scenarios):
        preset=('balanced','carbon-spike','outage','deadline')[scenario%4]
        p=imported[scenario] if imported else make_problem(seed+scenario,preset,workloads=workloads)
        preset=p['preset']
        for model in MODELS:
            previous=None
            for depth in (depths if model in ('QAOA-X','QAOA-XY','Warm-XY','VQE') else (1,)):
                init=None
                if previous is not None and model!='VQE':
                    d=len(previous)//2;init=previous[:d]+[0.]+previous[d:]+[0.]
                result=solve(p,model,depth,seed+scenario,budget=budget,initial_theta=init)
                previous=result['parameters'];result.update(scenario=scenario,preset=preset,problem=serial_problem(p))
                runs.append(result)
        print(f'Scenario {scenario+1}/{scenarios} finished',flush=True)
    summary=[]
    for model in MODELS:
        for depth in sorted({r['depth'] for r in runs if r['model']==model}):
            selected=[r for r in runs if r['model']==model and r['depth']==depth];row=dict(model=model,depth=depth,trials=len(selected))
            for field in ('gap_pct','feasible_probability','optimum_probability','wall_ms'):
                values=np.array([r[field] for r in selected if r[field] is not None])
                row[field]=None if not len(values) else dict(mean=float(values.mean()),std=float(values.std()),p10=float(np.percentile(values,10)),p90=float(np.percentile(values,90)))
            row['no_feasible_sample']=sum(r['best_sampled_cost'] is None for r in selected);summary.append(row)
    pareto=[]
    for weight in (0.,.25,.5,.75,1.):
        p=problem_from_choices(imported[0]['choices'],seed,'imported-pareto',weight) if imported else make_problem(seed,carbon_weight=weight,workloads=workloads)
        valid=np.flatnonzero(p['feasible']);exact=int(valid[np.argmin(p['raw'][valid])]);r=solve(p,'Warm-XY',2,seed,budget=budget)
        best=None if r['best_bitstring'] is None else int(r['best_bitstring'],2)
        pareto.append(dict(carbon_weight=weight,exact=dict(cost=float(p['cost'][exact]),carbon=float(p['carbon'][exact])),
            quantum=None if best is None else dict(cost=float(p['cost'][best]),carbon=float(p['carbon'][best])),gap_pct=r['gap_pct']))
    report=dict(schema_version=1,synthetic=not bool(imported),seed=seed,scenarios=scenarios,budget=budget,workloads=workloads,
        source=scenarios_csv or 'seeded synthetic generator',backend='NumPy ideal statevector (CPU)',python=platform.python_version(),numpy=np.__version__,
        note='All solvers share objective and constraints. Warm preprocessing is counted separately and included in wall time. Readout noise is not a full device noise model. Timings are offline CPU timings, not website latency.',
        elapsed_seconds=time.perf_counter()-started,summary=summary,runs=runs,pareto=pareto)
    report['sha256']=hashlib.sha256(json.dumps(report,sort_keys=True,separators=(',',':')).encode()).hexdigest()
    return report

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--scenarios',type=int,default=8);ap.add_argument('--scenarios-csv');ap.add_argument('--budget',type=int,default=100);ap.add_argument('--seed',type=int,default=42);ap.add_argument('--workloads',type=int,choices=(2,3),default=2);ap.add_argument('--output',default='public/data/quantum-lab-v8.json');a=ap.parse_args()
    if not 1<=a.scenarios<=100 or not 40<=a.budget<=2000: ap.error('scenarios 1–100; budget 40–2000')
    result=run(a.scenarios,a.budget,a.seed,workloads=a.workloads,scenarios_csv=a.scenarios_csv);p=Path(a.output);p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(result,indent=2));print(f'Saved {len(result["runs"])} runs to {p}')
if __name__=='__main__': main()
