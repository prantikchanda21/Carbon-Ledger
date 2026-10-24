# Carbon Ledger v133 — independent no-fallback ensemble

## What changed
The old exact classical analytical solution hard-coded at basis state 0 and the post-search analytical winner override were removed from the standalone `quadQuantumWorker.ts`. All 128 basis states now decode into bounded feasible candidates. Graph best-first exploration and the four 7-qubit CPU statevector simulations still run, with 3 simulation rounds per batch. No GLPK or SciPy solver participates in the ensemble's final candidate selection. A classical search controller, feasibility repair and objective evaluation still participate; this is a hybrid quantum-inspired CPU simulation, **not exclusively quantum computation**.

The code implements discrete quantum walks, Grover-type reflection, sample-and-minimize (not a formal Dürr–Høyer minimum-finding speedup), and transverse-field-annealing-inspired phase/walk updates. Its frontier priority formula is A*-inspired but is not admissible A*, and no optimality guarantee applies.

## Reproducibility
- `node --experimental-strip-types --no-warnings --test tests/quad-engine.test.ts`
- `node --experimental-strip-types --no-warnings scripts/benchmark-graph-search-v133.mjs > GRAPH-BENCHMARK-RAW-v133.json`
- LP comparison from `GRAPH-BENCHMARK-COMPARISON-v133.json` and `GRAPH-BENCHMARK-SUMMARY-v133.json`; reference SciPy 1.17.0 `linprog(method='highs')` with identical L1-linearized constraints and objective.
- 32 deterministic synthetic scenarios, 20 regions. Node worker runtimes and Python LP runtimes were recorded in separate processes; not controlled microbenchmarks for speed superiority.

## Results
- Feasible: 32/32. Classical fallback selected: 0/32.
- Mean objective gap from LP optimum: 8.157%; median 7.867%; p95 13.619%; maximum 16.312%.
- Ensemble median runtime 1.198 ms, p95 9.731 ms (max 64.573 ms including cold start).
- HiGHS median runtime 1.168 ms, p95 1.707 ms.
- Mean allocation L1 distance to LP allocation 0.43057.
- Normalized carbon ensemble 0.351530 vs LP 0.301492; operating 0.264048 vs 0.248293; latency 0.130099 vs 0.129892; risk 0.095052 vs 0.095870; synthetic treasury APY 6.95063% vs 6.97978%.

## Limitations
GLPK unavailable in the environment; cannot claim a GLPK comparison. Optimization case is a simplified separable convex allocation with capacity bounds, simplex and L1-to-preferred objective. This is not a test of all production constraints, no quantum speedup is demonstrated, and Next.js/Vercel production build has not been validated.
