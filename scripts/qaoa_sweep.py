"""Reproducible OFFLINE synthetic QAOA sweep; never claims quantum advantage.
Examples: python scripts/qaoa_sweep.py --scenarios 5 --sizes 6 --depths 1 2
"""
from __future__ import annotations
import argparse
import datetime as dt
import json
import os
from pathlib import Path
import platform
import subprocess
import sys
import time
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
# This numerical reference runner deliberately does not require Qiskit.
# It uses the same diagonal/bit-order convention as the live service.
PENALTY = 8.0
def cost_diagonal(costs, hedge_cost):
    basis=np.arange(1 << (len(costs)+1),dtype=np.uint32)
    selected=np.zeros(len(basis),dtype=np.int16)
    diag=np.zeros(len(basis),dtype=float)
    for i,cost in enumerate(costs):
        bit=((basis >> i)&1).astype(np.int16)
        selected+=bit; diag+=cost*bit
    diag+=hedge_cost*((basis >> len(costs))&1)
    return diag+PENALTY*(selected-1)**2

def qaoa_state(diagonal,gammas,betas,n):
    psi=np.full(1 << n,1/np.sqrt(1 << n),dtype=np.complex128)
    for gamma,beta in zip(gammas,betas):
        psi*=np.exp(-1j*gamma*diagonal)
        c,s=np.cos(beta),-1j*np.sin(beta)
        for q in range(n):
            shaped=psi.reshape(-1,2,1 << q)
            a,b=shaped[:,0,:],shaped[:,1,:]
            psi=np.stack((c*a+s*b,s*a+c*b),axis=1).reshape(-1)
    return psi

def evaluate(costs, depth, seed):
    from scipy.optimize import minimize
    diag = cost_diagonal(costs, 0.0)
    n = len(costs) + 1
    region_mask = (1 << len(costs)) - 1
    indices = np.arange(len(diag), dtype=np.uint32)
    valid = np.fromiter((int(i & region_mask).bit_count() == 1 for i in indices), dtype=bool)
    eligible_costs = diag[valid]
    exact = min(costs)
    mean_feasible = float(eligible_costs.mean())
    rng = np.random.default_rng(seed)
    initial = np.concatenate([rng.uniform(.05,.7,depth),rng.uniform(.05,2,depth)])
    evaluations = 0
    def objective(x):
        nonlocal evaluations
        evaluations += 1
        probabilities = np.abs(qaoa_state(diag, x[depth:].tolist(), x[:depth].tolist(), n)) ** 2
        return float(np.dot(probabilities, diag))
    start = time.perf_counter()
    fitted = minimize(objective, initial, method='COBYLA', options={'maxiter': 40 if n > 10 else 90})
    parameters = fitted.x if fitted.fun <= objective(initial) else initial
    probs = np.abs(qaoa_state(diag, parameters[depth:].tolist(), parameters[:depth].tolist(), n)) ** 2
    mass = float(probs[valid].sum())
    conditional = float(np.dot(probs[valid], eligible_costs) / mass) if mass > 1e-12 else None
    denominator = mean_feasible - exact
    normalized_gap = (conditional - exact) / denominator if conditional is not None and denominator > 1e-12 else None
    optimal_region = int(np.argmin(costs))
    optimal_bits = 1 << optimal_region
    optimum_probability = float(probs[optimal_bits] + probs[optimal_bits | (1 << len(costs))])
    return {'normalized_gap':normalized_gap, 'optimum_probability':optimum_probability, 'feasible_probability':mass,
            'wall_ms':round((time.perf_counter()-start)*1000,3), 'optimizer_evals':evaluations}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--scenarios', type=int, default=50)
    parser.add_argument('--seed', type=int, default=20261013)
    parser.add_argument('--sizes',type=int,nargs='+',default=[6,10,20])
    parser.add_argument('--depths',type=int,nargs='+',default=[1,2,3,4])
    parser.add_argument('--output',default='public/data/qaoa_sweep.json')
    args=parser.parse_args()
    if not (1 <= args.scenarios <= 500) or any(s<2 or s>20 for s in args.sizes) or any(p<1 or p>4 for p in args.depths):
        parser.error('scenarios 1-500; sizes 2-20; depths 1-4')
    rng=np.random.default_rng(args.seed)
    observations=[]
    for scenario in range(args.scenarios):
        sampled=rng.uniform(.05,.4,max(args.sizes)).tolist()
        for size in args.sizes:
            for depth in args.depths:
                result=evaluate(sampled[:size],depth,args.seed+scenario*100+size*10+depth)
                observations.append({'scenario':scenario,'size':size,'p':depth,**result})
    aggregates=[]
    for size in args.sizes:
        for depth in args.depths:
            selected=[x for x in observations if x['size']==size and x['p']==depth]
            row={'size':size,'p':depth}
            for key in ['normalized_gap','optimum_probability','feasible_probability','wall_ms']:
                vals=np.asarray([x[key] for x in selected if x[key] is not None],dtype=float)
                row[key]={'mean':float(np.mean(vals)), 'p10':float(np.percentile(vals,10)), 'p90':float(np.percentile(vals,90))} if len(vals) else None
            aggregates.append(row)
    try: commit=subprocess.check_output(['git','rev-parse','--short','HEAD'],cwd=ROOT,stderr=subprocess.DEVNULL,text=True).strip()
    except Exception: commit=None
    try: import qiskit; qiskit_version=qiskit.__version__
    except ImportError: qiskit_version='not installed (NumPy simulation)'
    result={'metadata':{'synthetic':True,'claim':'No quantum advantage claimed. Classical exact optimum is the baseline.',
        'definition':'normalized gap = (E[cost | feasible] - exact optimal cost) / (mean feasible cost - exact optimal cost)',
        'seed':args.seed,'scenarios':args.scenarios,'numpy':np.__version__,'qiskit':qiskit_version,'python':platform.python_version(),
        'timestamp':dt.datetime.now(dt.timezone.utc).isoformat(),'git_commit':commit,'command':' '.join(sys.argv),
        'note':'Offline synthetic simulation; hedge is not included in comparative placement cost.'},'summary':aggregates,'runs':observations}
    dest=ROOT/args.output;dest.parent.mkdir(parents=True,exist_ok=True)
    dest.write_text(json.dumps(result,indent=2)+'\n')
    print(f'Wrote {len(observations)} trials to {dest}')
if __name__=='__main__':main()
