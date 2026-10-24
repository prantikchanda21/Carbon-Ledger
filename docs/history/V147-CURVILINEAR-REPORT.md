# Carbon Ledger v147 — Curvilinear Quantum Fusion (10 qubits, p=3)

## Scientific description

This release adds `geometry-curved` as an independent research allocation option in the main dashboard. The original v146 `geometry`, `geometry-xy`, and `geometry-grover` modes remain available. The new mode executes **4 parallel worker threads × 2 independent 10-qubit, depth-3 circuits per worker** (8 simulations total, **not** an entangled 80-qubit system). Each circuit uses 252 Hamming-weight-five basis states within a 1024-amplitude space. The two searches are:

- **Curvilinear XY + Grover**: quintic smoothstep evolution, nonlinear cost-phase gates, Hamming-weight-preserving XY exchange, adaptive Grover marking, revised capacity-feasible candidate encoding and objective-independent regional pairing permutations.
- **Adaptive Grover-only**: original 10-qubit depth-3 cost-phase and amplitude-amplification search as an independent, complementary candidate source.

The selected result is the minimum objective among the **measured quantum-simulation candidates**, with classical validation and no GLPK- or LP-generated allocation fallback. A classical cost-aware candidate decoder prepares the bitstring-to-allocation mapping and computes all objective oracles. This is a **hybrid CPU simulation**. The XY gate only preserves Hamming weight; region capacity and total workload are satisfied by the classical decoder. It is not a QPU or proof of quantum advantage.

## Measured optimization outcomes

| Dataset | Cases | Original geometry gap | Adaptive Grover gap | Curved-only gap | v147 fused gap | Fused feasible |
|---|---:|---:|---:|---:|---:|---:|
| train | 32 | 1.3277% | 1.2884% | 1.2619% | **1.1502%** | 32/32 |
| holdout | 32 | 1.4124% | 1.3850% | 1.3710% | **1.2967%** | 32/32 |
| unseen | 48 | 1.5822% | 1.5222% | 1.5527% | **1.4268%** | 48/48 |
| prospective | 48 | 1.6631% | 1.5825% | 1.5960% | **1.4815%** | 48/48 |

`train` (32) was used for candidate encoding tuning; `holdout` (32) and `unseen` (48) were explored during development, so their results are not a blind final test. **Prospective** (48) was generated with a new seed after the fusion architecture was selected and is the preferred independent evaluation. Each problem uses 20 regions with the same combined convex objective and capacity constraints, solved independently by SciPy HiGHS to a proven LP optimum. GLPK was **not** run here.

### Prospective set (48 new cases)

| Metric | Original 10q geometry | v147 fusion | Exact LP (SciPy HiGHS) |
|---|---:|---:|---:|
| Mean objective gap ↓ | 1.6631% | 1.4815% | 0.0000% |
| Worst objective gap ↓ | 3.0717% | 2.7314% | 0.0000% |
| Carbon score ↓ | 0.298660 | 0.298431 | 0.305230 |
| Operating cost score ↓ | 0.252734 | 0.252849 | 0.251415 |
| Network latency score ↓ | 0.130414 | 0.130186 | 0.131434 |
| Risk score ↓ | 0.096678 | 0.097042 | 0.097157 |
| Regional treasury yield ↑ | 6.875% | 6.857% | 6.918% |

Scores are normalized synthetic quantities; treasury is an illustrative input yield, not actual portfolio APY. Metrics trade off. A lower combined-objective gap does not guarantee improved cost, latency, risk and yield simultaneously.

### Local runtimes (prospective set)

| Metric | Original geometry | Fusion v147 |
|---|---:|---:|
| medianLocalRuntimeMs | 2.551 ms | 5.035 ms |
| p95LocalRuntimeMs | 4.514 ms | 8.649 ms |

Times are from Node worker execution, including candidate preparation, statevector steps and classical selection, excluding HTTP/network/UI. Concurrent worker interference and CPU scheduling cause variability. Fusion's P95 does **not** consistently meet the earlier 8ms target. No direct GLPK runtime comparison was possible.

## Contribution and limits

In the prospective set, v147 mean gap to the LP optimum was 1.4815% versus 1.6631% for original geometry. The fused engine beat original geometry on a majority of cases, but runs two simulated circuits per worker, approximately doubling median compute time. Best-of-two selection itself is classical and cannot establish quantum advantage.

An equal-**output-shot** uniform classical sampling ablation is recorded as `meanUniformSamplingGapPct` in the summary. It does not equalize **oracle work**: preparing the simulated quantum phase oracle requires computing all 252 energies per register. Therefore any output-shot advantage alone does **not** prove computational or quantum advantage. Additional controlled query/runtime/hardware comparisons would be necessary.

## Verification and execution

- **13 focused tests passed**, including 4×2 circuit execution, feasibility, input response, normalized statevector, deterministic replay, no analytical fallback, and dashboard wiring.
- Full Next.js build and deployment have **not** been verified. The working container lacks the app's Next.js and Node type dependencies; a direct TypeScript build is blocked by missing packages.
- Direct GLPK execution is unavailable here; **SciPy HiGHS is a reference optimum, not GLPK runtime**. `V147-DIRECT-GLPK-RESULTS.json` records unavailable status. A GLPK.js runner exists at `scripts/benchmark-curved-v147-glpk.mjs`.

```bash
npm ci
npm test -- --test-name-pattern='geometry|fusion'   # optional
node --experimental-strip-types --no-warnings scripts/benchmark-curved-v147.mjs
python3 scripts/score-curved-v147.py
node --experimental-strip-types --no-warnings scripts/benchmark-curved-v147-glpk.mjs
npm run build
```

Use `geometry-curved` in the main dashboard's engine dropdown to obtain distinct independently sampled 20-region weights; the existing dashboard recalculates cost, carbon, latency, risk, and net-treasury outcomes from the allocation. Gross treasury APY remains policy dependent.
