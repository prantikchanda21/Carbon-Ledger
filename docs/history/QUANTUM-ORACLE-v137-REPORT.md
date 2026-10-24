# Carbon Ledger v137 — Quantum Oracle Research Benchmark

**32 synthetic 20-region cases.** Quantum simulation on CPU; this is not quantum hardware. Classical cost-aware candidate generation, energy ranking for threshold oracle, objective scoring, and final sampled-candidate selection remain in use. No GLPK, LP or analytical optimizer contributes an allocation candidate. Thus the full method is **hybrid quantum-classical**, not pure quantum or proof of quantum advantage.

The LP reference is **SciPy HiGHS, not GLPK**. This comparison has a different computational budget; LP timings include SciPy solver-call overhead, while quantum timings measure one warm in-process engine call. Neither reflects deployed API latency. The candidate objective is linear regional cost plus L1 deviation penalty; it omits any other production constraints not represented in this benchmark.

## Results

| Metric | v137 quantum oracle | SciPy HiGHS reference |
|---|---:|---:|
| Mean objective gap | 3.841% | 0% |
| Worst objective gap | 8.411% | 0% |
| Median solver time | 1.066 ms | 1.368 ms |
| P95 solver time | 1.789 ms | 1.886 ms |
| Normalized carbon | 0.287488 | 0.301492 |
| Normalized operating cost | 0.254947 | 0.248293 |
| Normalized latency | 0.130217 | 0.129892 |
| Normalized risk | 0.092561 | 0.095870 |
| Treasury APY | 7.025% | 6.980% |
| Feasibility | 32/32 | 32/32 |
| Mean allocation L1 difference | 0.3358 | 0 |

The runtime and solution-quality improvements cannot be attributed solely to quantum operations: the v137 candidate preparation uses cost-aware classical sorting. The final selected allocation does depend on quantum statevector measurement, without a classical optimal fallback.

Run `node --experimental-strip-types scripts/benchmark-oracle-v136.mjs > results.json` from project root to collect simulated oracle outputs; SciPy HiGHS comparison is in `scripts/report-v137.py` (expects `/mnt/data/v137-raw.json` from this run in the current benchmark environment). The packaged JSON contains complete recorded results.
