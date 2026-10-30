# Carbon Ledger v145 — A*-Guided Ensemble Dashboard Integration

## Engine and benchmark
The existing v134 four-worker ensemble in the latest v144 project was retained without altering its optimization algorithm. The original `lib/quadQuantum.ts` and `lib/quadQuantumWorker.ts` are byte-for-byte identical between the v134 and updated project. Its dashboard option is explicitly named **A*-Guided Quantum Ensemble** (mode `quad`).

This engine uses four 7-qubit simulated quantum-statevector workers, 3 rounds of amplitude/phase evolution, cost-biased classical feasible candidate generation and an A*-inspired graph frontier. It does not use GLPK or a separate analytical optimizer to choose its final allocation. Quantum minimum finding is a heuristic, not a complete Dürr–Høyer implementation. This is hybrid research on classical CPU hardware.

## New test results
Fresh local 32-case 20-region synthetic benchmark using `scripts/benchmark-graph-search-v133.mjs` and `scripts/evaluate-astar-v145.py`:

- Mean objective gap to **SciPy HiGHS LP**, NOT GLPK: **1.62242%**
- Worst gap: **3.59583%**
- Engine median runtime: **1.22146 ms**
- Engine P95: **9.86946 ms**
- Reference LP median: **1.12814 ms**
- Feasible: **32/32**

These times use different Node.js and Python invocation interfaces and cannot establish a fair speed victory. The benchmark measures a simplified convex capacity-allocation problem with modeled inputs, not the full discrete real-world cloud deployment problem.

| Modeled metric | Ensemble | SciPy HiGHS LP | Interpretation |
|---|---:|---:|---|
| Carbon score (lower) | 0.296725 | 0.301492 | Ensemble lower |
| Operating cost score (lower) | 0.249731 | 0.248293 | LP lower |
| Latency score (lower) | 0.130224 | 0.129892 | LP lower |
| Risk score (lower) | 0.094769 | 0.095870 | Ensemble lower |
| Treasury yield input composite (higher) | 6.9832% | 6.9798% | Ensemble slightly higher |

The treasury score above is a *synthetic weighted regional input*, NOT the dashboard's gross investment APY. Dashboard gross investment APY is based on treasury strategy and modeled assumptions. **Net APY** is allocation-sensitive through modeled cloud operating costs.

## Integration validation
- v134 source compared with original ZIP: byte-for-byte identical engine worker and interface.
- `tests/quad-engine.test.ts` and `tests/strongest-engine-wiring.test.ts`: **5/5 passed**.
- Main dashboard has named option and `/api/cooperative-allocation` `quad` branch uses `quadQuantumAllocation` outputs.
- The same output weights are passed to `applyOverride` for carbon emissions, cloud operating cost and network latency, with cost-adjusted net APY derived from the new operating cost.
- Stale previous-engine allocation is no longer accepted as active for the selected engine/scenario.
- Full Next.js production build and deployed Vercel integration **have not been verified in this environment** (external dependencies absent).
- This does **not** demonstrate quantum advantage or a direct win against GLPK.
