# Carbon Ledger v138 — Quantum Oracle Research Benchmark

**32 synthetic 20-region cases.** Quantum simulation on CPU; this is not quantum hardware. Classical cost-aware candidate generation, energy ranking for threshold oracle, objective scoring, and final sampled-candidate selection remain in use. No GLPK, LP or analytical optimizer contributes an allocation candidate. Thus the full method is **hybrid quantum-classical**, not pure quantum or proof of quantum advantage.

The LP reference is **SciPy HiGHS, not GLPK**. This comparison has a different computational budget; LP timings include SciPy solver-call overhead, while quantum timings measure one warm in-process engine call. Neither reflects deployed API latency. The candidate objective is linear regional cost plus L1 deviation penalty; it omits any other production constraints not represented in this benchmark.

## Results

| Metric | v138 quantum oracle | SciPy HiGHS reference |
|---|---:|---:|
| Mean objective gap | 3.679% | 0% |
| Worst objective gap | 7.344% | 0% |
| Median solver time | 0.848 ms | 1.278 ms |
| P95 solver time | 1.750 ms | 2.560 ms |
| Normalized carbon | 0.290169 | 0.301492 |
| Normalized operating cost | 0.253195 | 0.248293 |
| Normalized latency | 0.130891 | 0.129892 |
| Normalized risk | 0.092624 | 0.095870 |
| Treasury APY | 7.038% | 6.980% |
| Feasibility | 32/32 | 32/32 |
| Mean allocation L1 difference | 0.3319 | 0 |

The runtime and solution-quality improvements cannot be attributed solely to quantum operations: the v138 candidate preparation uses cost-aware classical sorting. The final selected allocation does depend on quantum statevector measurement, without a classical optimal fallback.

Run `node --experimental-strip-types scripts/benchmark-oracle-v136.mjs > results.json` from project root to collect simulated oracle outputs; SciPy HiGHS comparison is in `scripts/report-v138.py` (expects `/mnt/data/v138/oracle-v138-raw.json` from this run in the current benchmark environment). The packaged JSON contains complete recorded results.
