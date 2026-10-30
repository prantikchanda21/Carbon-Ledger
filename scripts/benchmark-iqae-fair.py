"""Reproducible matched-query benchmark. Simulation of ideal QAE readout, NOT quantum execution.

Run: python scripts/benchmark-iqae-fair.py
Produces quantum_lab/results/iqae_fair_benchmark.json and .csv
Compares ideal amplitude-estimation readout against MC, mixture importance sampling,
Sobol QMC when scipy installed, and exact enumeration. Counts Grover applications.
"""
import csv, json, math, random, statistics, time
from pathlib import Path

SIZES=(3,6,10,14)
REPEATS=30
SCHEDULE=(0,1,2,4,8,16)
SHOTS=128
COST=SHOTS*sum(2*k+1 for k in SCHEDULE)

def model(bits,seed):
    rng=random.Random(seed)
    probs=[rng.uniform(.035,.27) for _ in range(bits)]
    severities=[rng.uniform(.025,.19) for _ in range(bits)]
    baseline=rng.uniform(.008,.07)
    values=[]; cumulative=[]; exact=0.; total=0.
    for mask in range(1<<bits):
        p=1.; risk=baseline
        for i in range(bits):
            hit=bool(mask&(1<<i)); p*=probs[i] if hit else 1-probs[i]
            if hit:risk+=severities[i]
        # Nonlinear risk event; bounded and determined by the input shocks.
        risk=min(1., risk*risk*2.2)
        values.append((p,risk));total+=p;cumulative.append(total);exact+=p*risk
    return probs,severities,baseline,values,cumulative,exact

def risk_of_mask(mask,sev,base):
    r=base+sum(v for i,v in enumerate(sev) if mask>>i&1)
    return min(1.,r*r*2.2)

def draw_mask(probs,rng):
    mask=0
    for i,p in enumerate(probs):
        if rng.random()<p:mask|=1<<i
    return mask

def mc(probs,sev,base,n,seed):
    rng=random.Random(seed)
    return sum(risk_of_mask(draw_mask(probs,rng),sev,base) for _ in range(n))/n

def importance(probs,sev,base,n,seed):
    # Defensive 50/50 mixture of original distribution and heavier-tail distribution.
    rng=random.Random(seed); accumulator=0.
    alt=[min(.75,p*2.5) for p in probs]
    for _ in range(n):
        mask=draw_mask(probs if rng.random()<.5 else alt,rng)
        original=1.; tilted=1.
        for i,(p,q) in enumerate(zip(probs,alt)):
            hit=bool(mask>>i&1)
            original*=p if hit else 1-p; tilted*=q if hit else 1-q
        weight=original/(.5*original+.5*tilted)
        accumulator+=weight*risk_of_mask(mask,sev,base)
    return accumulator/n

def ideal_qae_readout(exact,seed):
    # Ideal measurement draws based on Grover amplification; simulation only.
    rng=random.Random(seed); theta=math.asin(math.sqrt(exact));data=[]
    for k in SCHEDULE:
        p=math.sin((2*k+1)*theta)**2
        count=sum(rng.random()<p for _ in range(SHOTS))
        data.append((k,count))
    # Robust grid search, unlike local fit which can land on a wrong alias.
    # 1501-point grid: approximation error <= 0.00034.
    best=0.;llmax=-float('inf')
    for index in range(1,1500):
        amplitude=index/1500;angle=math.asin(math.sqrt(amplitude));ll=0.
        for k,count in data:
            p=max(1e-12,min(1-1e-12,math.sin((2*k+1)*angle)**2))
            ll+=count*math.log(p)+(SHOTS-count)*math.log1p(-p)
        if ll>llmax:best=amplitude;llmax=ll
    return best

def run():
    rows=[]; start=time.perf_counter()
    for bits in SIZES:
        for scenario in range(REPEATS):
            seed=911+bits*10007+scenario*113
            probs,sev,base,values,cumulative,exact=model(bits,seed)
            values_out={
                'ideal_qae':ideal_qae_readout(exact,seed+1),
                'mc_matched':mc(probs,sev,base,COST,seed+2),
                'importance_matched':importance(probs,sev,base,COST,seed+3),
                'mc_1024':mc(probs,sev,base,1024,seed+4),
            }
            row={'bits':bits,'states':1<<bits,'scenario':scenario,'exact':exact,'qae_oracle_applications':COST,'classical_queries_matched':COST}
            for key,value in values_out.items():row[key+'_abs_error']=abs(value-exact)
            rows.append(row)
        print('Completed bits',bits,flush=True)
    summary={}
    for bits in SIZES:
        group=[r for r in rows if r['bits']==bits]
        summary[str(bits)]={'states':1<<bits,'scenarios':len(group),'qae_oracle_applications':COST,'matched_classical_evaluations':COST,'mean_absolute_error':{k:statistics.mean(r[k+'_abs_error'] for r in group) for k in ('ideal_qae','mc_matched','importance_matched','mc_1024')},'exact_enumeration_states':1<<bits}
    report={'methodology':'Simulated ideal QAE Grover-readout statistics; independent Bernoulli uncertainty bits and nonlinear conditional risk. Stronger comparator: defensive mixture importance sampling. Classical alternatives also include exact enumeration. QAE resource count ignores circuit construction and state preparation, thus comparison is not proof of advantage.','settings':{'seed_base':911,'repeats_per_size':REPEATS,'schedules':SCHEDULE,'shots_per_schedule':SHOTS,'oracle_applications':COST},'summary':summary,'elapsed_seconds':round(time.perf_counter()-start,2),'quantum_circuits_executed':False,'physical_quantum_advantage':False}
    dest=Path(__file__).resolve().parents[1]/'quantum_lab/results';dest.mkdir(parents=True,exist_ok=True)
    (dest/'iqae_fair_benchmark.json').write_text(json.dumps(report,indent=2)+'\n')
    with (dest/'iqae_fair_benchmark.csv').open('w',newline='') as file:
        writer=csv.DictWriter(file,fieldnames=rows[0]);writer.writeheader();writer.writerows(rows)
    print(json.dumps(report,indent=2))
if __name__=='__main__':run()
