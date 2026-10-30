# Carbon Ledger v132 — Graph-search-guided quantum-inspired ensemble

## Implementation
The independent 7-qubit × four parallel batches, p=3 CPU statevector engine now includes a bounded (32 expanded nodes per batch) best-first search on a 128-state 7-bit hypercube, using objective energy and quantum-derived measurement probabilities for the frontier ordering. This is **A*-inspired**, not a formal shortest-path solution: it does not have a provably admissible path-cost heuristic. It is not a real quantum device, nor Grover's provable quadratic speedup. The original classical analytical fallback is retained.

## Benchmark design
`node --experimental-strip-types --no-warnings scripts/benchmark-graph-search-v132.mjs > GRAPH-BENCHMARK-RAW-v132.json`

32 deterministic synthetic 20-region scenarios. Capacity bounds and sum-to-one constraint, objective linear weighted cost + L1 regularization. LP comparator: **SciPy HiGHS** on mathematically identical constraints and objective, NOT GLPK. Run detailed Python postprocessing with SciPy linprog to reproduce LP results. The current environment has empty `node_modules/glpk.js` and no `glpsol`, with registry network unavailable, so no actual GLPK claim is possible.

## Actual measured results
- Ensemble median 2.7967 ms; P95 8.6311 ms; maximum 69.0192 ms (first cold call included).
- SciPy HiGHS median 1.1154 ms; P95 1.6262 ms.
- Mean objective gap versus LP reference essentially zero at floating-point tolerance.
- All 32 scenarios feasible; all 32 used the **classical exact analytical candidate** in final selection.
- Mean normalized carbon 0.3014916702; operating cost 0.2482933316; latency 0.1298920371; risk 0.0958699624; treasury APY 0.0697977573, same as LP to numerical precision.
- Allocation L1 distance approximately 3.27e-16.

**No quantum advantage has been demonstrated.** These benchmarks do not cover the full production engine's coupled compliance, migration, or other cross-region constraints; they do not constitute a real GLPK head-to-head. The comparative running times are different-language implementations (Node workers vs native SciPy/HiGHS) and not hardware-equivalent quantum algorithmic comparisons.

## Verification
`node --experimental-strip-types --no-warnings --test tests/quad-engine.test.ts` (2 tests pass)
`node --experimental-strip-types --no-warnings scripts/benchmark-quad-warm.mjs` (warm median ~3.25ms, warm P95 ~7.08ms in one measured 20-region case).

## Deployment warning
The code uses Node worker_threads and should not be run in an Edge runtime. Full Vercel deployment / Next.js build is unverified because dependencies are incomplete in the working environment. The objective does not represent production units for carbon/cost, and APY is a weighted synthetic rate, not a financial return prediction.
