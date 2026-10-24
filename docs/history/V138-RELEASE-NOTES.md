# Carbon Ledger v138 — Quantum Oracle final tuning

- Independently sampled four 7-qubit statevectors with three Grover iterations per batch.
- Improved classically cost-aware candidate preparation, reduced perturbation magnitude and diversified phase marking thresholds.
- No GLPK/LP allocation candidate or analytical fallback in the Quantum Oracle selector.
- Full outputs for dashboard allocation, carbon/cost/risk/latency and treasury follow the selected allocation through existing application logic.
- 32 synthetic 20-region benchmark cases: mean gap 3.6786%; worst 7.3440%; median local engine call 0.8477 ms; P95 1.7503 ms.
- SciPy HiGHS is the LP reference, NOT GLPK. Neither full Next.js production build nor Vercel deployment was validated.
- This is a classical CPU simulation of Grover-like quantum search with substantial classical candidate preparation, not a pure quantum processor or demonstrated quantum advantage.

Run: `node --experimental-strip-types --no-warnings scripts/benchmark-oracle-v136.mjs > oracle-results.json`

Run focused tests: `node --experimental-strip-types --test tests/quantum-oracle-v136.test.mjs`
