# Carbon Ledger v145 — v134 A*-Guided Ensemble Featured

## Implementation
- Based on complete v144 project package. The **existing `quad` source is identical to v134**, the version with the strongest reported objective gap across the tested independent ensemble candidates. It has been clearly surfaced as **A*-Guided Quantum Ensemble** in the main dashboard dropdown and landing page.
- Preserve the four 7-qubit persistent CPU workers, depth/rounds 3, and cost-aware quantum-candidate generation. No GLPK or exact analytical optimizer supplies `quad` final allocation.
- Fixed misleading dashboard and API text that described an *exact analytical fallback*, absent from the current v134 worker code.
- Prevent stale responses from different engine/scenario runs from being displayed while the new choice runs.
- Regional weights are sent through `applyOverride`, recomputing carbon, operating costs, and latency. Dashboard net treasury APY changes through operating cloud cost; **gross investment APY is intentionally policy-determined** and need not change with placement.
- Added landing-page overview, project abstract, and source-oriented integration tests.

## Historical benchmark and fresh rerun (not GLPK)
- v134 mean objective gap confirmed on fresh rerun: 1.62242% against SciPy HiGHS LP, 32 synthetic 20-region cases.
- Historical warm ensemble median: 1.86679 ms; P95: 13.22343 ms. Fresh case-run median: 1.22146 ms; P95: 9.86946 ms (separate process and environment).
- 32/32 feasible in the historical test.
- Benchmark objective is a *simplified* separable convex continuous allocation model, not all discrete cloud scheduling constraints.

## Scientific accuracy
- CPU statevector simulations are quantum-algorithm simulations, **not physical quantum hardware**.
- Classical cost-aware candidate generation, A*-inspired frontier and classical comparison remain. This is a hybrid quantum-classical research engine, not pure quantum.
- Quantum advantage and superiority to GLPK have **not been established**.
- v144 discrete-scheduler research was **not promoted**.

Reproduce the benchmark with `node --experimental-strip-types --no-warnings scripts/benchmark-graph-search-v133.mjs > V145-GRAPH-SEARCH-RAW.json` followed by `python scripts/evaluate-astar-v145.py` (requires SciPy and NumPy).
