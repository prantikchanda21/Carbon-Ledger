# Carbon Ledger v136 — Quantum Oracle Search

## Executive outcome
- 32 synthetic 20-region cases: mean gap **11.041%**, worst gap **20.465%** against SciPy HiGHS LP.
- Warm median **2.055 ms**, p95 **3.133 ms**; LP median **1.038 ms**.
- Feasible **32/32**. Statevector norm max error 3.4e-15.

## Algorithm

Four distinct 7-qubit 128-state encoded allocation registers; objective-threshold phase oracle, inversion-about-mean diffusion, three iterations, one deterministic pseudorandom sample per register. The lowest-objective of four measured candidates is selected. Objective thresholds are computed classically when compiling the oracle. There is no GLPK, analytical LP solution, or LP-produced candidate in the engine. Feasibility encoding is classical. Four registers run sequentially on one CPU in this implementation, not four physical parallel processors.

## Limitations

This is quantum-circuit statevector simulation on classical CPU. It is not a physically pure quantum engine, a reversible gate-level implementation of the objective oracle, a quantum hardware result, or quantum advantage. Only four sampled candidates are used to select a solution, and the oracle is compiled using classical enumeration of 128 energies per register. The 20-region problem is restricted to encoded candidates. Real Vercel production benchmarks and project-wide TypeScript build are not validated here.

## Benchmark methodology

32 deterministic seeded synthetic cases; each warmed twice; `node --experimental-strip-types --no-warnings scripts/benchmark-oracle-v136.mjs > benchmark-oracle-v136-raw.json`. Compare with SciPy linprog(method="highs") including the same capacities and absolute-deviation penalty. There is no GLPK binary available, hence no GLPK-specific speed claim. All carbon/cost/risk/latency values synthetic normalized scores, and treasury APY is scenario weighted.

## Average performance

| Measure | Quantum Oracle v136 | HiGHS LP |
|---|---:|---:|
| Objective gap | 11.041% | 0% |
| Median runtime | 2.055 ms | 1.038 ms |
| P95 runtime | 3.133 ms | 1.248 ms |
| Feasibility | 32/32 | 32/32 |
| Carbon score | 0.361718 | 0.301492 |
| Operating cost score | 0.269641 | 0.248293 |
| Latency score | 0.130353 | 0.129892 |
| Risk score | 0.098102 | 0.095870 |
| Treasury APY | 0.068512 | 0.069798 |

## Dashboard integration

Select **Quantum Oracle Search** from main dashboard Optimization engine dropdown. API mode `oracle` uses its own selected weights. Existing dashboard metrics recompute from returned weights; there is no fallback to GLPK on this branch.
