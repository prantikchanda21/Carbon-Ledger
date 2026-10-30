"""Carbon Ledger v90 research benchmark. Honest CPU simulation; not hardware quantum advantage.

Run: python scripts/benchmark_coupled_v90.py --scenarios 20 --seed 42
Requires numpy and scipy. Independent experiment; existing live dashboard stays unchanged.
"""
import argparse, csv, json, math, time
from pathlib import Path
import numpy as np
from scipy.optimize import milp, Bounds, LinearConstraint
from scipy.linalg import expm

N_REGIONS = 20
N_WORKLOADS = 12
CHOICES = 5


def make_instance(seed):
    rng = np.random.default_rng(seed)
    demand = rng.integers(2, 7, size=N_WORKLOADS)
    caps = rng.integers(6, 17, size=N_REGIONS)
    latency = rng.uniform(12, 95, (N_WORKLOADS, N_REGIONS))
    sla = rng.uniform(54, 86, N_WORKLOADS)
    carbon = rng.uniform(160, 530, N_REGIONS)
    energy = rng.uniform(.08, .35, N_REGIONS)
    cost = np.full((N_WORKLOADS, N_REGIONS), 1e4)
    allowed = np.zeros_like(cost, dtype=bool)
    # Allow 5 candidate regions per workload, sampled from its SLA-compatible choices.
    for w in range(N_WORKLOADS):
        compatible = np.flatnonzero(latency[w] <= sla[w])
        if len(compatible) < CHOICES:  # keep reproducible feasibility-friendly scenarios
            compatible = np.argsort(latency[w])[:CHOICES]
            sla[w] = max(sla[w], latency[w, compatible].max() + 1)
        chosen = rng.choice(compatible, CHOICES, replace=False)
        allowed[w, chosen] = True
        cost[w, chosen] = demand[w] * (energy[chosen] + carbon[chosen] / 2500) + latency[w, chosen] / 500
    # An explicit pairwise communication penalty makes assignments coupled.
    traffic = np.zeros((N_WORKLOADS, N_WORKLOADS))
    for w in range(N_WORKLOADS - 1):
        traffic[w, w + 1] = rng.uniform(.04, .24)
    # Budget is a hard constraint on the energy component (slack to avoid infeasibility).
    budget = sum(float(demand[w] * max(energy[allowed[w]])) for w in range(N_WORKLOADS)) * 1.02
    return dict(demand=demand, caps=caps, latency=latency, sla=sla, carbon=carbon, energy=energy,
                cost=cost, allowed=allowed, traffic=traffic, budget=budget)


def build_problem(p):
    # Sparse pair variables z[w,r,v,s] linearize adjacency communication penalties.
    W, R = p['cost'].shape
    choices = [(w, int(r)) for w in range(W) for r in np.flatnonzero(p['allowed'][w])]
    n = len(choices)
    pairs = []
    for w in range(W - 1):
        if p['traffic'][w, w + 1] <= 0: continue
        for ia, (ww, r) in enumerate(choices):
            if ww != w: continue
            for ib, (vv, s) in enumerate(choices):
                if vv == w + 1 and r != s: pairs.append((ia, ib, w))
    m = n + len(pairs)
    c = np.zeros(m)
    for i, (w, r) in enumerate(choices): c[i] = p['cost'][w, r]
    for j, (_, _, w) in enumerate(pairs): c[n+j] = p['traffic'][w, w+1]
    constraints = []; lower = []; upper = []
    def add(items, lb, ub):
        row = np.zeros(m)
        for idx, value in items: row[idx] += value
        constraints.append(row); lower.append(lb); upper.append(ub)
    for w in range(W): add(((i, 1) for i, (ww, r) in enumerate(choices) if ww == w), 1, 1)
    for r in range(R): add(((i, p['demand'][w]) for i, (w, rr) in enumerate(choices) if rr == r), -np.inf, p['caps'][r])
    add(((i, p['demand'][w] * p['energy'][r]) for i, (w, r) in enumerate(choices)), -np.inf, p['budget'])
    for j, (ia, ib, _) in enumerate(pairs):
        # z >= x_i + x_j - 1; optimal non-negative z handles pair penalty
        add([(ia, 1), (ib, 1), (n+j, -1)], -np.inf, 1)
    return dict(c=c, A=np.array(constraints), lb=np.array(lower), ub=np.array(upper),
                choices=choices, n=n, m=m, pairs=pairs)


def solve_milp(model, fixed=None, time_limit=10):
    n, m = model['n'], model['m']; lo = np.zeros(m); hi = np.ones(m)
    if fixed:
        for i, (w, r) in enumerate(model['choices']):
            if w in fixed:
                lo[i] = hi[i] = 1 if fixed[w] == r else 0
    t0 = time.perf_counter()
    out = milp(model['c'], integrality=np.r_[np.ones(n), np.zeros(m-n)],
               bounds=Bounds(lo, hi), constraints=LinearConstraint(model['A'],model['lb'],model['ub']),
               options={'time_limit': time_limit, 'mip_rel_gap': 1e-8})
    elapsed = (time.perf_counter()-t0)*1000
    if out.x is None: return None, elapsed, str(out.message)
    allocation = {}
    for i,(w,r) in enumerate(model['choices']):
        if out.x[i] > .5: allocation[w] = r
    if len(allocation) != N_WORKLOADS: return None, elapsed, 'incomplete assignment'
    return (allocation, float(out.fun), out.status == 0), elapsed, str(out.message)


def actual_cost(p, allocation):
    if allocation is None or len(allocation) != N_WORKLOADS: return None
    load = np.zeros(N_REGIONS)
    total=0.; budget=0.
    for w,r in allocation.items():
        if not p['allowed'][w,r] or p['latency'][w,r] > p['sla'][w] + 1e-8: return None
        load[r] += p['demand'][w]
        total += p['cost'][w,r]
        budget += p['demand'][w] * p['energy'][r]
    if np.any(load > p['caps'] + 1e-7) or budget > p['budget'] + 1e-7: return None
    for w in range(N_WORKLOADS - 1):
        if allocation[w] != allocation[w+1]: total += p['traffic'][w,w+1]
    return float(total)


def quantum_neighborhood(p, model, rng, max_evals=20):
    # Two neighboring workloads x five allowed regions = ten physical one-hot qubits.
    # Simulate their constrained 25-dimensional subspace exactly using XY swaps.
    # This is a genuine unitary XY mixer in that subspace, not a literal fluid.
    pair = int(rng.integers(0, N_WORKLOADS - 1)); w1, w2 = pair, pair+1
    ra = np.flatnonzero(p['allowed'][w1]); rb = np.flatnonzero(p['allowed'][w2]);
    states = [(int(a),int(b)) for a in ra for b in rb]
    energy = np.array([p['cost'][w1,a] + p['cost'][w2,b] + (a!=b)*p['traffic'][w1,w2] for a,b in states])
    energy = (energy-energy.mean()) / max(energy.std(), 1e-8)
    adjacency = np.zeros((25,25),dtype=complex)
    # XY exchange connects all one-hot slots in each 5-node assignment block.
    for i,(a,b) in enumerate(states):
        for j,(aa,bb) in enumerate(states):
            if i != j and ((a == aa) != (b == bb)):
                adjacency[i,j] = 1
    # eigendecomposition reused for all betas
    eig, vectors = np.linalg.eigh(adjacency)
    initial = np.ones(25,dtype=complex)/5
    def probabilities(gamma,beta):
        phase = np.exp(-1j*gamma*energy)*initial
        state = vectors @ (np.exp(-1j*beta*eig)*(vectors.conj().T@phase))
        return np.abs(state)**2
    # Deterministic bounded search; choose parameters minimizing expected energy.
    best=None; chosen_params=None; trials=0
    for gamma in np.linspace(.2, 2.6, 4):
        for beta in np.linspace(.15, 1.35, 5):
            probs=probabilities(gamma,beta)
            score = float(probs@energy)
            trials+=1
            if best is None or score < best: best=score;chosen_params=(gamma,beta)
            if trials>=max_evals: break
        if trials>=max_evals:break
    probs=probabilities(*chosen_params)
    order=np.argsort(-probs)
    # Try top-three quantum states as candidate partial assignments.
    return [({w1:states[int(i)][0],w2:states[int(i)][1]}, float(probs[i])) for i in order[:3]], trials, (w1,w2)


def run_case(seed, glpk_limit, trials):
    p=make_instance(seed); m=build_problem(p); output=[]
    exact, exact_ms, msg=solve_milp(m,time_limit=15)
    if exact is None: return None, f'HiGHS reference not solved: {msg}'
    optimum = actual_cost(p, exact[0]);
    # Reference may be best known, not a proven optimum if GLPK timed out.
    output.append(dict(engine='highs_full_reference',runtime_ms=exact_ms,objective=optimum,feasible=optimum is not None,proven_optimal=exact[2],candidate_accepted=False))
    limited, limited_ms, msg=solve_milp(m,time_limit=glpk_limit)
    limited_score=actual_cost(p,limited[0]) if limited else None
    output.append(dict(engine='highs_time_limited',runtime_ms=limited_ms,objective=limited_score,feasible=limited_score is not None,proven_optimal=bool(limited and limited[2]),candidate_accepted=False))
    # Both heuristic approaches solve the same residual HiGHS with fixed assignments.
    rng=np.random.default_rng(seed+500003)
    qstart=time.perf_counter(); candidates, evals, pair=quantum_neighborhood(p,m,rng,trials)
    best_q=None; quantum_refinement_ms=0.; used=0
    for fixed,prob in candidates:
        solved, ms, _=solve_milp(m,fixed,time_limit=glpk_limit)
        quantum_refinement_ms += ms;used+=1
        if solved:
            score=actual_cost(p,solved[0]);
            if score is not None and (best_q is None or score<best_q):best_q=score
    qms=(time.perf_counter()-qstart)*1000
    output.append(dict(engine='fluid_xy_qaoa_highs',runtime_ms=qms,objective=best_q,feasible=best_q is not None,proven_optimal=False,candidate_accepted=best_q is not None,quantum_evals=evals,refinement_ms=quantum_refinement_ms,candidates=used))
    cstart=time.perf_counter(); w1,w2=pair
    # Classical equal-neighborhood-cost heuristic: rank all 25 pairs by partial objective.
    options=[(float(p['cost'][w1,a]+p['cost'][w2,b]+(a!=b)*p['traffic'][w1,w2]), {w1:int(a),w2:int(b)}) for a in np.flatnonzero(p['allowed'][w1]) for b in np.flatnonzero(p['allowed'][w2])]
    best_classic=None;classic_ms=0.
    for _, fixed in sorted(options,key=lambda x:x[0])[:3]:
        solved,ms,_=solve_milp(m,fixed,time_limit=glpk_limit);classic_ms+=ms
        if solved:
            score=actual_cost(p,solved[0]);
            if score is not None and (best_classic is None or score<best_classic):best_classic=score
    cms=(time.perf_counter()-cstart)*1000
    output.append(dict(engine='classical_neighborhood_highs',runtime_ms=cms,objective=best_classic,feasible=best_classic is not None,proven_optimal=False,candidate_accepted=best_classic is not None,refinement_ms=classic_ms,candidates=3))
    for item in output:
        item.update(seed=seed,objective_gap_pct=(100*(item['objective']-optimum)/max(abs(optimum),1e-9) if item['objective'] is not None else None),reference_proven_optimal=exact[2],workloads=N_WORKLOADS,regions=N_REGIONS,budget_hard_enforced=True,capacity_hard_enforced=True,per_workload_sla_hard_enforced=True)
    return output,None


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--scenarios',type=int,default=5)
    parser.add_argument('--seed',type=int,default=42)
    parser.add_argument('--time-limit',type=float,default=.05,help='seconds per HiGHS solve, not total hybrid budget')
    parser.add_argument('--angle-evals',type=int,default=20)
    parser.add_argument('--out',default='artifacts/coupled-evidence')
    args=parser.parse_args()
    if not 1<=args.scenarios<=500 or args.time_limit<=0:parser.error('Invalid benchmark settings')
    out=Path(args.out);out.mkdir(parents=True,exist_ok=True)
    data=[];errors=[]
    for i in range(args.scenarios):
        entries,error=run_case(args.seed+i*7919,args.time_limit,args.angle_evals)
        if error: errors.append({'scenario':i,'error':error}); print('FAILED',i,error)
        else: data.extend(entries); print(f'{i+1}/{args.scenarios}: '+', '.join(f"{x['engine']}={x['objective']:.4f}" if x['objective'] is not None else x['engine']+'=invalid' for x in entries))
    if data:
        columns=sorted(set().union(*(d.keys() for d in data)))
        with (out/'results.csv').open('w',newline='') as f:
            wr=csv.DictWriter(f,columns);wr.writeheader();wr.writerows(data)
        summary=[]
        for engine in sorted({d['engine'] for d in data}):
            selected=[d for d in data if d['engine']==engine];valid=[d for d in selected if d['feasible']]
            summary.append(dict(engine=engine,runs=len(selected),feasible=len(valid),mean_ms=float(np.mean([d['runtime_ms'] for d in selected])),mean_gap_pct=float(np.mean([d['objective_gap_pct'] for d in valid])) if valid else None,reference_proven_count=sum(x['reference_proven_optimal'] for x in selected)))
        (out/'summary.json').write_text(json.dumps(summary,indent=2))
        print(json.dumps(summary,indent=2))
    (out/'failures.json').write_text(json.dumps(errors,indent=2))
    (out/'methodology.json').write_text(json.dumps({'qubits':10,'effective_quantum_states':25,'mixer':'unitary XY exchange in one-hot assignment subspace','simulation':'CPU NumPy, not real quantum hardware','constraints':'binary assignments, regional capacity, energy-budget, per-workload SLA, adjacent-workload traffic penalty','limitations':['The experiment is independent of the live v89 website API','Hybrid methods have up to three residual HiGHS calls; their total runtime is NOT equal to one time-limited HiGHS budget','Unproven references are best-known, not global optima','Circuits use one XY-mixing layer and bounded angle search, not deep variational QAOA','No guaranteed speed or objective improvement']},indent=2))

if __name__=='__main__':main()
