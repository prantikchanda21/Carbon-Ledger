"""Small, reproducible QUBO scheduling experiments using ideal statevector simulation.
Bit order is little endian. All solvers receive the identical diagonal objective.
XY mixers preserve assignment cardinality, NOT capacity or residency constraints.
"""
from __future__ import annotations
import time
import numpy as np
from scipy.optimize import minimize

MODELS = ('QAOA-X', 'QAOA-XY', 'Warm-XY', 'VQE', 'Simulated annealing', 'Classical warm start')

def make_problem(seed=42, preset='balanced', carbon_weight=0.5, workloads=2):
    if workloads not in (2, 3):
        raise ValueError('Supported offline sizes: 2 or 3 workloads')
    rng = np.random.default_rng(seed)
    # Four assignment choices per workload: two regions, two time slots.
    slots = [('Mumbai', 0), ('Mumbai', 1), ('Hyderabad', 0), ('Hyderabad', 1)]
    base_carbon = rng.uniform(.2, .8, 4)
    base_price = rng.uniform(.08, .24, 4)
    if preset == 'carbon-spike': base_carbon[:2] *= 1.8
    choices=[]
    for w in range(workloads):
        for r, (region, slot) in enumerate(slots):
            choices.append(dict(workload=f'Workload {w+1}', region=region, slot=slot,
                kwh=float(1 + .2*w), carbon=float(base_carbon[r]*(1+.2*w)),
                price=float(base_price[r]*(1+.2*w)), migration=float(.025 if r//2 != w%2 else 0),
                allowed=not ((preset=='outage' and r==0) or (preset=='deadline' and w==0 and slot==1))))
    return problem_from_choices(choices,seed,preset,carbon_weight)

def problem_from_choices(choices,seed=42,preset='imported',carbon_weight=.5):
    workloads=len(choices)//4
    if workloads not in (2,3) or len(choices)!=workloads*4: raise ValueError('Need 2 or 3 workloads with 4 options each')
    if not np.isfinite(carbon_weight) or carbon_weight<0: raise ValueError('Invalid carbon weight')
    slots=[(c['region'],c['slot']) for c in choices[:4]]
    if len(set(slots))!=4: raise ValueError('Four distinct region/time choices required per workload')
    names=set()
    for w in range(workloads):
        block=choices[4*w:4*w+4]
        if len({c['workload'] for c in block})!=1 or block[0]['workload'] in names: raise ValueError('Workload options must be contiguous and unique')
        names.add(block[0]['workload'])
        if [(c['region'],c['slot']) for c in block]!=slots: raise ValueError('Each block must use identical region/time ordering')
        for c in block:
            if any(not np.isfinite(c[k]) or c[k]<0 for k in ('kwh','carbon','price','migration')): raise ValueError('Finite nonnegative quantities required')
            if not isinstance(c['allowed'],bool): raise ValueError('allowed must be boolean')
    n=len(choices)+1
    states=np.arange(1<<n)
    bits=((states[:,None] >> np.arange(n)) & 1).astype(float)
    x=bits[:,:-1]; hedge=bits[:,-1]
    carbon=x@np.array([c['carbon'] for c in choices])
    cost=x@np.array([c['price']+c['migration'] for c in choices]) + .06*hedge
    # Financial exposure is coupled to hedge; hedge never removes physical emissions.
    risk=.12*(carbon-.65*hedge)**2
    raw=cost+carbon_weight*carbon+risk
    assignment=sum((x[:,4*w:4*w+4].sum(1)-1)**2 for w in range(workloads))
    capacity=sum(np.maximum(x[:,r::4].sum(1)-1,0)**2 for r in range(4))
    forbidden=x@np.array([not c['allowed'] for c in choices])
    feasible=(assignment==0)&(capacity==0)&(forbidden==0)
    if not feasible.any(): raise ValueError('No feasible schedule under supplied constraints')
    # For three workloads the capacity square hinge is not quadratic; use pair conflicts,
    # equal to zero exactly at capacity<=1 and still a valid quadratic penalty.
    capacity_pairs=sum(sum(x[:,4*a+r]*x[:,4*b+r] for a in range(workloads) for b in range(a+1,workloads)) for r in range(4))
    penalty=10.*(assignment+capacity_pairs+forbidden)
    return dict(seed=seed,preset=preset,carbon_weight=carbon_weight,workloads=workloads,n=n,
        choices=choices,bits=bits,raw=raw,energy=raw+penalty,feasible=feasible,carbon=carbon,cost=cost)

def qubo(p):
    e=p['energy']; n=p['n']; constant=float(e[0])
    linear=np.array([e[1<<i]-constant for i in range(n)])
    pairs={(i,j):float(e[(1<<i)|(1<<j)]-constant-linear[i]-linear[j]) for i in range(n) for j in range(i+1,n)}
    return constant,linear,pairs

def rotate(psi,q,theta,axis='x'):
    shaped=psi.reshape(-1,2,1<<q); a=shaped[:,0,:].copy(); b=shaped[:,1,:].copy()
    c=np.cos(theta); s=np.sin(theta)
    if axis=='x': shaped[:,0,:]=c*a-1j*s*b; shaped[:,1,:]=c*b-1j*s*a
    else: shaped[:,0,:]=c*a-s*b; shaped[:,1,:]=s*a+c*b

def xy_pairs(n,workloads):
    indices=np.arange(1<<n)
    pairs=[]
    for w in range(workloads):
        for j in range(4):
            a=4*w+j; b=4*w+(j+1)%4
            src=indices[((indices>>a)&1)==1]; src=src[((src>>b)&1)==0]
            pairs.append((src,src^((1<<a)|(1<<b))))
    return pairs

def warm_solution(p):
    constant,linear,pairs=qubo(p)
    def objective(x): return constant+linear@x+sum(v*x[i]*x[j] for (i,j),v in pairs.items())
    constraints=[{'type':'eq','fun':lambda x,w=w: x[4*w:4*w+4].sum()-1} for w in range(p['workloads'])]
    constraints += [{'type':'ineq','fun':lambda x,r=r: 1-x[:-1][r::4].sum()} for r in range(4)]
    bounds=[(0,1) if c['allowed'] else (0,0) for c in p['choices']]+[(0,1)]
    initial=np.r_[np.full(len(p['choices']),.25),.5]
    result=minimize(objective,initial,method='SLSQP',bounds=bounds,constraints=constraints,options={'maxiter':100,'ftol':1e-8})
    return np.clip(result.x,0,1),int(result.nfev)

def initial_state(p,warm=None):
    bits=p['bits']; probability=np.ones(len(bits))
    for w in range(p['workloads']):
        block=bits[:,4*w:4*w+4]
        probs=np.ones(4)/4 if warm is None else np.maximum(warm[4*w:4*w+4],.02)
        probs=probs/probs.sum()
        probability*=np.where(block.sum(1)==1,block@probs,0)
    h=.5 if warm is None else float(np.clip(warm[-1],.02,.98))
    probability*=np.where(bits[:,-1]==1,h,1-h)
    return np.sqrt(probability).astype(complex)

def circuit_state(p,model,theta,depth,warm=None):
    n=p['n']; scale=max(float(np.ptp(p['raw'][p['feasible']])),1.)
    if model=='VQE':
        psi=np.zeros(1<<n,complex);psi[0]=1
        idx=np.arange(1<<n)
        for layer in range(depth+1):
            for q in range(n): rotate(psi,q,theta[layer*n+q]/2,'y')
            if layer<depth:
                for q in range(n-1): psi=psi[idx^(((idx>>q)&1)<<(q+1))]
        return psi
    psi=np.full(1<<n,1/np.sqrt(1<<n),complex) if model=='QAOA-X' else initial_state(p,warm if model=='Warm-XY' else None)
    pairs=p.get('xy_pairs')
    if pairs is None: pairs=xy_pairs(n,p['workloads'])
    for layer in range(depth):
        psi*=np.exp(-1j*theta[depth+layer]*p['energy']/scale)
        beta=theta[layer]
        if model=='QAOA-X':
            for q in range(n): rotate(psi,q,beta)
        else:
            for src,dst in pairs:
                a=psi[src].copy();b=psi[dst].copy();c=np.cos(beta);s=-1j*np.sin(beta)
                psi[src]=c*a+s*b;psi[dst]=c*b+s*a
            rotate(psi,n-1,beta)
    return psi

def readout_noise(probs,n,rate):
    out=probs.copy();idx=np.arange(len(probs))
    for q in range(n): out=(1-rate)*out+rate*out[idx^(1<<q)]
    return out/out.sum()

def summarize(p,probs,shots,seed):
    rng=np.random.default_rng(seed); probs=np.maximum(probs,0);probs/=probs.sum()
    counts=rng.multinomial(shots,probs); valid=p['feasible']; energy=p['raw']
    optimum=float(energy[valid].min()); mass=float(probs[valid].sum())
    sampled=np.flatnonzero((counts>0)&valid)
    best=int(sampled[np.argmin(energy[sampled])]) if len(sampled) else None
    expected=float(probs[valid]@energy[valid]/mass) if mass>1e-12 else None
    ordered=np.argsort(counts)[::-1][:12]
    timeline=[] if best is None else [dict(c) for i,c in enumerate(p['choices']) if (best>>i)&1]
    return dict(feasible_probability=mass,optimum_probability=float(probs[valid & np.isclose(energy,optimum,atol=1e-8)].sum()),
        expected_feasible_cost=expected,exact_cost=optimum,best_sampled_cost=None if best is None else float(energy[best]),
        gap_pct=None if expected is None else 100*(expected-optimum)/max(abs(optimum),1e-9),
        best_bitstring=None if best is None else format(best,f"0{p['n']}b"),timeline=timeline,
        hedge=None if best is None else bool((best>>(p['n']-1))&1),
        histogram=[dict(bitstring=format(int(i),f"0{p['n']}b"),count=int(counts[i]),feasible=bool(valid[i]),cost=float(energy[i])) for i in ordered if counts[i]],
        sampled_feasible_rate=float(counts[valid].sum()/shots),shots=shots)

def solve(p,model='Warm-XY',depth=1,seed=42,budget=100,restarts=2,shots=1024,initial_theta=None):
    if model not in MODELS: raise ValueError('Unknown model')
    if depth not in range(1,5) or budget<20 or shots<1 or restarts<1: raise ValueError('Invalid solve settings')
    start=time.perf_counter();rng=np.random.default_rng(seed);trace=[];pre_evals=0
    p['xy_pairs']=xy_pairs(p['n'],p['workloads'])
    warm=None
    if model in ('Warm-XY','Classical warm start'): warm,pre_evals=warm_solution(p)
    theta=[];evals=0
    if model=='Classical warm start':
        probs=np.abs(initial_state(p,warm))**2
    elif model=='Simulated annealing':
        current=int(rng.integers(len(p['energy'])));best=current
        for k in range(budget):
            candidate=current^(1<<int(rng.integers(p['n'])))
            delta=p['energy'][candidate]-p['energy'][current]
            temp=max(.01,5*(1-k/budget))
            if delta<=0 or rng.random()<np.exp(-delta/temp): current=candidate
            if p['energy'][current]<p['energy'][best]: best=current
            trace.append(float(p['energy'][best]))
        probs=np.zeros(len(p['energy']));probs[best]=1;evals=budget
    else:
        params=p['n']*(depth+1) if model=='VQE' else 2*depth
        best_energy=float('inf');best_theta=None
        def objective(t):
            nonlocal evals,best_energy,best_theta
            probs=np.abs(circuit_state(p,model,t,depth,warm))**2
            value=float(probs@p['energy']);evals+=1
            if value<best_energy: best_energy=value;best_theta=t.copy()
            trace.append(best_energy)
            return value
        if model in ('Warm-XY','QAOA-XY'): objective(np.zeros(params))
        # Budget is an objective-evaluation limit, not a promise of identical wall time.
        per=max(params+2,budget//restarts)
        for run in range(restarts):
            if evals>=budget: break
            initial=rng.uniform(.05,1,params)
            if run==0 and initial_theta is not None and len(initial_theta)==params: initial=np.array(initial_theta)
            remaining=budget-evals
            if remaining<params+2: break
            minimize(objective,initial,method='COBYLA',options={'maxiter':min(per,remaining),'rhobeg':.35,'tol':1e-6})
        if best_theta is None: objective(rng.uniform(.05,1,params))
        theta=best_theta.tolist();probs=np.abs(circuit_state(p,model,best_theta,depth,warm))**2
    result=summarize(p,probs,shots,seed+10000)
    result.update(model=model,depth=depth,seed=seed,qubits=p['n'],optimizer_evals=evals,
        preprocessing_evals=pre_evals,wall_ms=(time.perf_counter()-start)*1000,parameters=theta,trace=trace,
        mode='classical' if model in ('Simulated annealing','Classical warm start') else 'ideal-statevector',
        backend='NumPy CPU',readout_noise=[dict(rate=rate,**summarize(p,readout_noise(probs,p['n'],rate),shots,seed+10000)) for rate in (0,.01,.03)],
        circuit=dict(initial_state='uniform' if model=='QAOA-X' else 'RY product' if model=='VQE' else 'one-hot block states + hedge',
            layers=depth,mixer='X' if model=='QAOA-X' else 'RY + CNOT' if model=='VQE' else 'ring XY + hedge X',
            cost='diagonal QUBO phase',bit_order='little-endian; highest bit is hedge'))
    if model in ('Simulated annealing','Classical warm start'):
        result['circuit']=dict(initial_state='Classical distribution',layers=0,mixer='Not applicable',cost='Classical QUBO evaluation; no quantum circuit executed',bit_order='little-endian; highest bit is hedge')
    return result

def serial_problem(p):
    c,l,q=qubo(p)
    return {k:p[k] for k in ('seed','preset','carbon_weight','workloads','n','choices')} | {'qubo':{'constant':c,'linear':l.tolist(),'quadratic':[[i,j,v] for (i,j),v in q.items()]}}
