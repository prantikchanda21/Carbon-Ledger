# Carbon Ledger v90: coupled-assignment research sandbox

This is an **additive, standalone research benchmark**. The production dashboard and the four existing v89 engines are unchanged. No quantum advantage is claimed or manufactured.

## Run

From `Carbon-Ledger/` with Python 3.10+ and `numpy` + `scipy` installed:

```powershell
python -m pip install numpy scipy
python scripts/benchmark_coupled_v90.py --scenarios 20 --seed 42 --time-limit 0.05
```

Results: `artifacts/coupled-evidence/results.csv`, `summary.json`, `methodology.json`, `failures.json`.

## What is being solved?

* 12 individually assigned workloads, 20 cloud regions (five SLA-feasible candidates per workload).
* Binary assignments, each workload exactly once.
* Hard regional capacities, per-workload SLA and energy-spend budget.
* Pairwise communication penalties between adjacent workloads.
* A 10-qubit, one-hot-preserving XY mixer explores alternatives for **two workloads with five choices each**. Twenty-five states are simulated in the excitation-conserving subspace using unitary matrices on the CPU.
* Three quantum-ranked candidates are passed as fixed assignments to residual mixed-integer optimization; a classical local-ranking heuristic gets the **same three candidate-refinement opportunities**.

**Important:** This research script currently uses SciPy's HiGHS mixed-integer solver, **not GLPK**. It is a separate reproducible experiment to investigate whether structured QAOA candidate exploration changes outcomes on a more realistic problem. Do not label its numbers as GLPK measurements. The production v89 JavaScript benchmark still uses `glpk.js`.

## Interpreting results honestly

- Full HiGHS reference is the optimum only when `reference_proven_optimal=true`. Otherwise it is the best known feasible solution.
- The time-limited HiGHS result has one solve; hybrid approaches use multiple residual solves plus quantum or classical ranking. These are **not equal total compute budgets**. Compare absolute wall-clock times and solution quality; no quantum speedup inference follows.
- This does not execute your v89 standard or gaseous engines, which remain in the unchanged main project. It only investigates a constrained Fluid-QAOA-style neighborhood versus a classical candidate ranking, under a tougher assignment model.
- If all engines tie, this is an informative negative finding, not a reason to change benchmarks until they look favorable.
- The XY mixer is an actual unitary exchange evolution in the one-hot subspace, but it is not a 50-qubit simulation, physical quantum hardware, or evidence of quantum advantage.

For valid comparisons against GLPK specifically, a subsequent implementation must use the **same coupled integer model, constraint matrix, time limit, thread count, tolerances, and machine** in `glpk.js` or native GLPK, and also track total hybrid runtime including all solver calls.
