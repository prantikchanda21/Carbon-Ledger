# v131 independent four-batch quantum-inspired engine

## Changes from v130
- Process-local pool of four 7-qubit CPU statevector workers instead of four new worker threads on every request.
- Three rounds (`p=3`) per batch: digitized transverse-field annealing, hypercube quantum walk, Grover threshold inversion, sampled minimum-finding heuristic.
- Pool has 250ms idle shutdown to let Node test runners and serverless instances exit.
- Caps, normalized weights and infeasibility checks preserved; exponential candidate weights now clamped to avoid overflow for extreme scores.
- Independent mode does **not** invoke GLPK, though it does compare against a classical analytical solution of the simplified separable convex allocation objective. This exact classical candidate currently determines the winner in the example benchmark. Never present this as measured quantum advantage.

## Measured sample / limitations
`QUAD-WARM-BENCHMARK.json` contains 31 sequential calls on one 20-region deterministic synthetic scenario in this container. Excluding the cold call, median was about 1.61 ms and p95 about 6.54 ms, measured around `quadQuantumAllocation` (not end-to-end HTTP, UI rendering, data retrieval or cloud cold starts). Cold call was about 59.76 ms. These are **not** a guarantee of <15 ms across cases or in Vercel; repeat benchmarks on deployment hardware with production traffic and real scenarios.

This engine is computationally quantum-inspired with exact classical CPU statevector simulation; it is not quantum hardware execution and does not demonstrate a proven speedup over GLPK. The simplified objective excludes potential richer routing constraints in the full GLPK production problem. A strict cross-engine objective/constraint comparison requires a shared benchmark harness.

## Commands
`node --experimental-strip-types --no-warnings --test tests/quad-engine.test.ts`

`node --experimental-strip-types --no-warnings scripts/benchmark-quad-warm.mjs`

A successful typecheck/build was NOT obtained in the provided environment: the `node_modules` tree lacks multiple @types declarations (e.g. `@types/node`, `@types/react`, despite placeholder directories). Install dependencies with `npm ci` in a clean environment, then run `npm run typecheck && npm run build` before deployment. Verify serverless worker support in the production runtime.
