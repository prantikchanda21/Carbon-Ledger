# Carbon Ledger v149 — Top Five Engines + Engine History

## Active engines (main dashboard, Quantum Lab, Weather, Digital Twin and scheduler)

1. GLPK (baseline)
2. Quantum Oracle, 4×7-qubit CPU statevectors, p=3
3. Curvilinear Quantum Fusion, 4×10-qubit CPU statevectors, p=3, two circuits per register
4. Adaptive Grover, 4×10 qubits, p=3
5. Geometry-Aware Quantum Walk, 4×10 qubits, p=3

Selection follows the recorded 200-scenario GLPK comparison's four independent quantum modes with the lowest reported objective gaps. Standard, Fluid and Gaseous QAOA produced GLPK fallback in **200/200** cases, so their zero gaps were excluded from the independent ranking. Their algorithms and recorded hardware microcircuit evidence remain in Engine History.

## What changed

- Main dashboard selector and server whitelist now offer only five engines. No retired solver can be selected by API.
- Independent quantum options use their own feasible weights to feed dashboard allocations and impact statistics; GLPK is not silently used as an allocation fallback.
- Research & Reports now shows **only five active engines**, a 200-scenario summary table, objective/runtime bar comparisons, scientific methods/formulas, and impacts on carbon/cost/latency/risk/treasury. Existing live report export retained.
- New sidebar **Engine History** at `/history`, documenting six retired modes from the 200-case run, with formula, CPU time, gap, fallback count, and carbon/cost/latency/risk/treasury metrics. Additional older studies are clearly separated as different benchmarks.
- `public/data/top-five-benchmark-v149.json` is the download-ready static evidence snapshot transcribed from the user's CLI screenshot; it is NOT a newly run GLPK benchmark, and raw per-scenario data were not supplied.

## Important benchmark caveats

The local 200-case benchmark screenshot showed Oracle matching GLPK's rounded values with *zero reported fallbacks*. This is a **warning requiring per-region allocation and objective audit**, not proof of Grover advantage. The Oracle uses classical cost-aware candidate encoding. All quantum solvers are executed as classical-CPU statevector simulations.

The 200-case numbers and earlier 32/48-case SciPy HiGHS gaps (e.g. 1.62% for v134) are different studies and are not directly comparable. User's raw `results.json` remains necessary to audit scenario-level objective, allocations, feasibility and timing distribution.

## Run

```cmd
npm ci
npm run dev
```

Open `/dashboard`, `/research`, `/history`, `/quantum-lab`. Run `npm run test:engines:v149` for focused engine selection, method and UI consistency checks.

Focused tests: 10/10 passed. Broader suite: 100/106 passed; 6 blocked by missing glpk.js/onnxruntime-node dependencies. Full Next.js production build not verified in this environment because npm dependencies are unavailable.
