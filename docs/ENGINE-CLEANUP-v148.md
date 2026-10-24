# v148 — streamlined production engine selection

**Active engines (4):** `glpk`, `fluid`, `geometry-grover`, `geometry-curved`.

**Retired from active dashboard/API:** `standard`, `gaseous`, `oracle`, `adiabatic`, `quad`, `geometry`, and `geometry-xy`. A retired value stored in localStorage automatically falls back to the fluid default instead of leaving the dropdown inconsistent.

**Why:** historical 7q Adiabatic/Oracle show large gaps; original 7q A* and geometry/XY-only are superseded or redundant; Standard and Gaseous QAOA + GLPK often reproduce GLPK allocations without demonstrated independent quantum advantage. Fluid remains because of separate IBM hardware microcircuit evidence. Experimental research utilities/old historical reports remain for audit but are not dispatchable.

**Previous synthetic benchmarks, not freshly rerun with GLPK:** Adaptive Grover 10q 1.38% mean gap (32-case holdout); Curvilinear Fusion ~1.43% on 48 held-out or 1.48% on 48 prospective scenarios; classical LP exact optimum 0%. Figures are from earlier SciPy HiGHS comparisons and do not prove quantum advantage.

**Validation:** check active mode whitelist, dashboard selector, lab/scenario selectors, and independent engines’ allocation feasibility. Full Next.js deployment verification requires installing all dependencies.

## Verification status (2026-10-23)

- Focused active 10-qubit engine and wiring tests: **11/11 passed**.
- Broad Node.js test suite: **97/103 passed**. Six GLPK/ONNX integration tests could not run because `glpk.js` and `onnxruntime-node` were not installed in the offline validation container. These are missing dependencies, not demonstrated engine regressions.
- TypeScript source parsing: no remaining JSX syntax diagnostics after dropdown update, but complete typecheck/Next.js production build unavailable without project dependencies.
- Quantum performance metrics are historical measured synthetic experiments, not new runs against GLPK; removal did not change retained engine numeric algorithms.
- To verify locally: `npm ci`, `npm test`, `npm run typecheck`, `npm run build`. To benchmark GLPK: `npm run benchmark:curved:glpk`.
