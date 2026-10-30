# Carbon Ledger v144 — Discrete Quantum Scheduler Research Gate

**Decision: REJECT / NOT PROMOTED to the main dashboard.**

A 20-region, 3-time-slot *binary mixed-integer* workload-placement problem was constructed, with 12 or 20 workloads; eligibility, demand-weighted region/slot capacities, migration penalties and pairwise co-location affinity penalties. Carbon, operating cost, latency, risk and regional treasury APY all affect the common optimization objective.

A hybrid quantum-guided scheduler searches feasible discrete placements using four 7-qubit **CPU-simulated** registers with 3 Grover amplification rounds. Two registers additionally use unitary cost-phase evolution and X-mixer walks. All stage-to-stage beam selection, oracle energy computation, capacity checking, classical input preparation and post-measurement ranking are **classical**. The quantum-guided algorithm receives no MIP/LP optimizer allocations and no analytical optimum as input.

## Honest environment limitations

- **GLPK was not executed.** Neither `glpsol` nor the `glpk.js` runtime is installed in the available environment; network package access is unavailable. `--glpk` was explicitly requested in the reproducible test, and all GLPK attempts were reported unavailable. **No direct GLPK victory or speed claim is possible.**
- Instead, `scipy.optimize.milp` (HiGHS backend) solved **the same mixed-integer model** and proved optimality in **32/32 scenarios**.
- Engine timings are local Python execution times, not quantum-hardware times and not network/browser latency. HiGHS timing starts after constructing the constraint matrix, so its numbers are not strictly end-to-end comparable.
- All carbon/cost/latency/risk metrics are synthetic weighted scores, not field-measured units. APY is synthetic annual yield, not earned treasury return.
- Comparison to a classical greedy candidate selector uses the **same feasible candidate states and beam width**; this is a quantum-contribution ablation, not a claim of equal quantum query complexity.

## Measured results — 24 scenarios, 12 workloads

| Metric | Quantum-guided | Classical greedy (same pool) | HiGHS certified MIP optimum |
|:--|--:|--:|--:|
| Mean objective gap | 1.667% | 1.667% | 0.000% |
| Worst objective gap | 4.441% | 4.441% | 0.000% |
| Median execution | 58.661 ms | 3.277 ms | 14.853 ms |
| P95 execution | 62.608 ms | 3.579 ms | 77.399 ms |
| Carbon score ↓ | 0.310388 | 0.310388 | 0.309387 |
| Operating-cost score ↓ | 0.532216 | 0.532216 | 0.528817 |
| Latency score ↓ | 0.298147 | 0.298147 | 0.298894 |
| Risk score ↓ | 0.292851 | 0.292851 | 0.290237 |
| Treasury APY ↑ | 7.9758% | 7.9758% | 7.97397% |
| Feasible | 24/24 | 24/24 | 24/24 |

## Measured results — 8 scenarios, 20 workloads

| Metric | Quantum-guided | Classical greedy (same pool) | HiGHS certified MIP optimum |
|:--|--:|--:|--:|
| Mean objective gap | 2.591% | 2.591% | 0.000% |
| Median execution | 103.669 ms | 5.968 ms | 168.389 ms |
| P95 execution | 112.759 ms | 6.934 ms | 728.293 ms |
| Carbon score ↓ | 0.310028 | 0.310028 | 0.301394 |
| Operating-cost score ↓ | 0.543313 | 0.543313 | 0.550449 |
| Latency score ↓ | 0.317315 | 0.317315 | 0.318856 |
| Risk score ↓ | 0.336668 | 0.336668 | 0.329484 |
| Treasury APY ↑ | 7.8120% | 7.8120% | 7.7794% |
| Feasible | 8/8 | 8/8 | 8/8 |

**Interpretation.** The quantum-guided prototype is faster than the HiGHS MIP solver on the harder 20-job instances *in this Python local measurement*, but its objective is worse, and a classical greedy solver obtains exactly the same objective and allocations in all tested cases while running about 17× faster. As a result, this does **not** show quantum algorithmic or hardware advantage. GLPK itself remains untested. A certified MIP optimum cannot be beaten on the **same combined objective and constraints**, only tied; multiobjective metrics also conflict, making strict dominance in every metric generally infeasible.

## Reproduction

Requires Python 3.11+ with NumPy and SciPy. From this directory:

```sh
python -m unittest -v test_scheduler.py
python experiment.py --cases 24 --jobs 12 --seed 20261022 --limit 1.5 --beam 5 --shots 12 --glpk
cp benchmark-summary.json benchmark-summary-12jobs.json
python experiment.py --cases 8 --jobs 20 --seed 20261022 --limit 2.5 --beam 5 --shots 12 --glpk
```

If `glpsol` is installed on your machine, `--glpk` invokes its *real mixed-integer optimizer* on exactly the same instance. Results appear in `benchmark-results.json`, including `glpk` runs and timings. The script doesn't substitute a different solver for GLPK. The GLPK runner uses `--lp` and a binary MILP formulation; HiGHS results remain separately labeled.

**Important:** Both sets of experiments use the same seed schedule with different workload sizes; none are live telemetry. Do not claim a quantum advantage or a GLPK victory from this report. This experimental source is deliberately *not* integrated into the production dashboard, honoring the promotion condition.
