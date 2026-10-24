# v83 validation

- Clean install using the Vercel install command: passed.
- TypeScript check: passed.
- ESLint: passed without warnings.
- Automated tests: 90 passed, 0 failed, including native CPU ONNX and GLPK.
- Next.js production build: passed; worker circular chunk warning removed.
- Production HTTP responses: /, /dashboard, /tools/benchmarks, /tools/scenarios, /quantum-lab all 200.
- ONNX controller and cooperative allocation API: 200; feasible normalized allocation.
- Invalid JSON: rejected with 400.
- Traced API bundle sizes: cooperative ~1.2 MiB; ONNX controller and health ~45.5 MiB each.
- Visual browser QA was unavailable: Chromium download failed in this environment.
- Tested locally on Node v24.19.0; Vercel configuration uses Node 22.x. A hosted Vercel deployment was not performed.

## Recorded warm solver timings

| Statistic | GLPK | QAOA + GLPK |
|---|---:|---:|
| Mean | 1.021 ms | 4.293 ms |
| P95 | 2.646 ms | 7.958 ms |
| Maximum | 6.085 ms | 40.078 ms |
| Runs at or below 5 ms | 498/500 | 404/500 |
| Feasible | 500/500 | 500/500 |

This is CPU solver latency, not HTTP/network latency. Warm-up and timing boundaries are documented in DEPLOY_VERCEL.md and the raw evidence. Samples vary with host contention. The 5 ms target was not met for every case.

## Fixes

- Typed GLPK bounds correctly to fix production TypeScript failure.
- Shared GLPK initialization across ordinary and residual solves.
- Reused the feasible optimal baseline when the quantum lower bound is already met; kept residual solving for binding commitments.
- Reduced QAOA mixer traversal without changing depth, shots or fixed-angle search.
- Split worker-safe simulation core from the browser Worker launcher.
- Included deviation regularization in hybrid objective reporting.
- Preserved unchanged allocations when reapplied as an override.
- Updated obsolete tests for the current per-region capacity policy; added hybrid fast-path regression tests.
- Avoided optional ONNX binary downloads during Vercel installation while retaining bundled CPU binaries.
- Added measured latency UI, raw evidence download, and repeatable benchmark runner.
