# Carbon Ledger v134: independent quantum-guided graph search

## Changes
- Cost-spread-normalized candidate encoding and four independent search temperatures (2, 3.5, 5, 7), enabling differentiated parallel basis-state allocation proposals.
- Float64Array amplitude buffers for the 7-qubit statevector.
- Quantum-probability-aware graph frontier capped at 18 expansions, down from 32.
- Fixed a stale `idleTimer` reference in persistent worker.
- **No analytical allocation optimizer or GLPK in quantum solution selection.** The A*-inspired frontier is classical; quantum walks, cost phases, Grover reflection, and digitized transverse-field annealing are CPU statevector operations. The claimed quantum minimum-finding component remains heuristic selection among sampled candidates, not a rigorous implementation of Dürr–Høyer minimum finding. Do not claim quantum computational advantage.

## Benchmark design
- 32 fixed-seed synthetic cases, 20 regions, 7 qubits x 4 persistent worker simulations, p=3, 32 measurements per round.
- Reference is SciPy HiGHS linear programming (exact convex L1 linearization). **Not a direct GLPK benchmark**; installing GLPK in the app does not establish runtime/quality of an actual comparison.
- Warm-run timings include IPC and four worker runtimes; the first case includes worker startup. Same machine comparisons, sequential solver calls, no CPU isolation.
- Only carbon, operating cost, latency, risk, treasury metrics for synthetic input arrays. No real emissions, cloud invoices or realized yields.

## Limitations
- Candidate generation is classically cost-biased, so the results do not isolate contribution from quantum circuits. A matched candidate pool and classical-only ablation are still necessary.
- The objective only covers a simplified separable convex capacity placement problem, not all Carbon Ledger production constraints.
- Scores are dimensionless except treasury APY.
- Performance under Vercel serverless deployments, Next.js build, API integration and full app not verified.

## Measured summary
- count: 32.00000
- meanGapPct: 1.62242
- worstGapPct: 3.59583
- ensembleMedianMs: 1.86679
- ensembleP95Ms: 13.22343
- referenceMedianMs: 1.67517
- meanAllocationL1: 0.18139

## Outcome averages

|Metric|Ensemble|SciPy HiGHS LP|
|---|---:|---:|
|carbon|0.296725|0.301492|
|operatingCost|0.249731|0.248293|
|latency|0.130224|0.129892|
|risk|0.094769|0.095870|
|treasuryApy|0.069832|0.069798|
