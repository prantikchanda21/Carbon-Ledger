# Carbon Ledger v146 — 10-qubit, depth-3 geometry-aware research engines

## Summary

This release adds three engine choices to the **main dashboard** without replacing the older engines:

1. `geometry` — **Geometry-Aware Quantum Ensemble**, four independent 10-qubit CPU statevector worker threads, **p=3**; nonlinear smoothstep cost-phase evolution, weight-conserving XY exchange mixer, adaptive Grover marking and diffusion.
2. `geometry-xy` — identical decoding and three cost-phase layers with XY-exchange mixing only, an ablation of the Grover operator.
3. `geometry-grover` — identical decoding and three cost-phase layers with adaptive Grover search only, an ablation of the XY mixer.

A register has **1024 Hilbert-space amplitudes**, but is initialized and evolved on the **252 bitstrings of Hamming weight five**. Four separate 10-qubit registers are **not** a 40-qubit entangled computer. The implementation performs CPU simulations of unitary operations, while objective oracle computation, capacity-feasible candidate encoding, measurement sampling and final feasible-selection logic remain classical. The XY mixer preserves five excitations, *not* general cloud capacity constraints; the classical decoder guarantees region capacity and total workload conservation.

The output allocation is generated independently, and the existing dashboard calculates its carbon, operational-cost, risk, latency and net-treasury statistics from those weights. Gross treasury APY may remain policy-dependent. There is **no GLPK optimum / LP-generated allocation fallback** in these new research modes.

## Measured quality: 32 tuning and 32 untouched holdout cases

Identical 20-region fractional allocation instances, with capacity bounds, sum of weights = 1, cost coefficients and an L1 penalty to preferred weights. Objective:

`min sum_i(cost_i * w_i) + lambda * sum_i(abs(w_i - preferred_i))`

**Important: the exact optimum reference here was SciPy HiGHS, not GLPK**. The LP included auxiliary variables for the exact L1 linearization. All features are synthetic normalized inputs; APY is an illustrative allocation-weighted regional yield, not real treasury income.

| Solver | Tuning mean gap | Holdout mean gap | Holdout worst gap | Holdout feasibility |
|---|---:|---:|---:|---:|
| Original A*-Guided 7-qubit p=3 | 1.6224% | 1.6265% | 3.2809% | 32/32 |
| **Geometry-Aware 10-qubit p=3** | **1.3277%** | **1.4124%** | 2.4605% | 32/32 |
| 10-qubit curvilinear XY only | 1.5541% | 1.5491% | 2.7461% | 32/32 |
| **10-qubit adaptive Grover only** | **1.2884%** | **1.3850%** | **2.4223%** | 32/32 |
| SciPy HiGHS | 0% | 0% | 0% | 32/32 |

The combined geometry engine beat the original ensemble on 25 of 32 holdout cases; Grover-only beat it on 26 of 32. The Grover-only mode had a slightly lower gap than the combined geometry mode. Thus the present evidence does **not** show a benefit from adding the XY mixer on these problems.

### Held-out operational outcomes (mean normalized synthetic scores)

| Metric | Original 7q | Geometry 10q | Grover-only 10q | SciPy HiGHS |
|---|---:|---:|---:|---:|
| Carbon score ↓ | 0.290808 | 0.290776 | 0.290352 | 0.297055 |
| Operating-cost score ↓ | 0.256617 | 0.255997 | 0.255528 | **0.255902** |
| Network latency score ↓ | **0.121243** | 0.121634 | 0.121494 | 0.121494 |
| Risk score ↓ | 0.102448 | **0.102231** | 0.102436 | 0.103251 |
| Weighted gross regional APY ↑ | 6.9689% | 6.9796% | 6.9608% | 6.9515% |

Different metrics trade off under the single combined objective. Lower carbon score does **not** imply a better combined objective. Values are scenario averages, not production energy or actual financial returns.

### Isolated warm engine times (32 unseen cases; local CPU)

| Variant | Median | P95 |
|---|---:|---:|
| Geometry-Aware combined | 4.85 ms | 12.12 ms |
| Curvilinear XY only | 3.80 ms | 8.67 ms |
| Adaptive Grover only | **2.62 ms** | **5.86 ms** |

Measured by Node.js `performance.now()` around the independent four-worker call. Excludes network, page rendering and GLPK execution. Warm-up was excluded; workstation scheduling and worker contention still introduce variance. **Do not claim a GLPK speed win** from this table.

### Why 10 qubits did not automatically win everywhere

10 qubits expand each register to 1024 computational basis states (252 used by the Dicke encoding), but oracle preparation and simulation also cost more. The improvement from 7 to 10 qubits is confounded with changes to the classical decoder and candidate diversity. These results cannot be attributed solely to qubit count or demonstrate quantum advantage. A rigorous quantum contribution test also requires matching objective queries and comparing sampling-only baselines, CPU total cost and real QPU execution where available.

## Real GLPK benchmark: blocked on this machine

**GLPK was not installed**, and package repositories were unavailable. `V146-DIRECT-GLPK-RESULTS.json` therefore contains `glpkExecuted: false` rather than fabricated figures. A genuine GLPK runner is included:

```bash
npm ci
node --experimental-strip-types --no-warnings scripts/benchmark-geometry-v146-glpk.mjs
```

It reruns GLPK.js and the geometry ensemble on the *same holdout LPs* with the same objective and constraints; compares normalized carbon, cost, latency, risk, treasury, feasibility, objective gap, regional weights and end-to-end local engine execution times. It writes `V146-DIRECT-GLPK-RESULTS.json` only if GLPK actually runs.

## Reproduction

```bash
node --experimental-strip-types --no-warnings --test tests/geometry-10q.test.ts tests/geometry-wiring.test.ts tests/quad-engine.test.ts
node --experimental-strip-types --no-warnings scripts/benchmark-geometry-v146.mjs 32 12789 V146
python scripts/score-geometry-v146.py V146
node --experimental-strip-types --no-warnings scripts/benchmark-geometry-v146.mjs 32 623819 V146-HOLDOUT
python scripts/score-geometry-v146.py V146-HOLDOUT
node --experimental-strip-types --no-warnings scripts/benchmark-geometry-latency-v146.mjs
```

All eight focused tests passed (four new engine, one wiring, three old engine). Full Next.js build/typecheck could not be verified because frontend dependencies / Node typings were absent in this offline environment. Vercel deployment was not tested.

## Scientific interpretation

This is a **hybrid quantum-classical CPU statevector simulation**. It demonstrates a promising near-optimal allocation *heuristic* in the tested synthetic 20-region LP, not a proof of hardware quantum advantage, theoretical asymptotic speedup, or superiority over GLPK. The classical optimum cannot be beaten on the same exact objective and feasible set.
