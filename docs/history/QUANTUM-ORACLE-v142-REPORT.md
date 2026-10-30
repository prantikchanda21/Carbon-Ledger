# Carbon Ledger v142 — Quantum Oracle measurement refinement

The v138 quantum-oracle backend was modified to perform 32 Born-rule samples per register after 3 Grover rounds, retaining 4 independent 7-qubit CPU-simulated registers. The best **sampled** allocation is selected. No GLPK/LP/analytical optimal solution is injected into the engine. The objective-aware candidate encoding remains a **classical heuristic** and accounts for much of the performance; this is a hybrid quantum-classical simulation, NOT quantum hardware advantage.

32 repeatable synthetic 20-region scenarios, checked against a SciPy HiGHS linear-programming solution to the same weighted L1-regularized continuous allocation objective:

| Metric | Oracle v142 | Classical LP |
|---|---:|---:|
| Mean objective gap | 3.44% | 0% |
| Worst objective gap | 5.84% | 0% |
| Median warm local engine call | 0.97 ms | Not measured comparably |
| P95 local engine call | 3.48 ms | Not measured comparably |
| Feasible | 32/32 | 32/32 |
| Carbon score | 0.29715 | 0.30149 |
| Operating score | 0.25531 | 0.24829 |
| Latency score | 0.13065 | 0.12989 |
| Risk score | 0.09370 | 0.09587 |
| Illustrative treasury APY | 7.014% | 6.980% |

Results are from a single synthetic dataset and CPU host; optimizer quality cannot be inferred to general workloads. Individual improvements do not imply better combined objective. No direct GLPK benchmark, full production build, or hardware quantum advantage has been verified. The previous v138 mean gap was reported as 3.68% on its synthetic benchmark, but independent reruns are needed for statistically reliable version-to-version comparisons.

Run engine tests: `node --experimental-strip-types --no-warnings --test tests/quantum-oracle-v136.test.mjs`.
Run raw engine benchmark: `node --experimental-strip-types --no-warnings scripts/benchmark-oracle-v136.mjs > v142-raw.json`.
See `v142-comparison.json` for raw inputs, per-case allocations, and the matching SciPy HiGHS reference solutions.
