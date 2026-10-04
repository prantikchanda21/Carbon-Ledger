# v5 validation record

Checked with Node 24.19, Next.js 15.5.27, Python 3.12 and Qiskit 2.5.2.

- 63 Node tests pass, including real native ONNX inference and the GLPK WASM solver.
- 2 Python quantum tests pass with a real Qiskit Statevector run.
- TypeScript type checking passes.
- ESLint passes; only Next-generated type declarations are excluded from standalone lint.
- Production build completes successfully.
- Production API checks returned HTTP 200 for `/`, `/experiments`, the ONNX controller, benchmark API, deterministic explanation fallback and local quantum optimization.
- The report PDF was parsed with pypdf and rendered for inspection. It contains searchable text and automatic pagination.

## Browser checks

Production Chromium checks passed with no page errors or error-level console messages after the hydration fix:

- All nine experiment sections open.
- IndexedDB saving survives a reload.
- Approval, dry-run execution and rollback transition correctly.
- PDF and JSON download buttons produce files.
- Explanation fallback renders without a Groq key.
- GLPK, exact enumeration, ONNX and actual Qiskit simulator results render in the benchmark table.
- At a 390px mobile viewport the document width is 390px (no page-level horizontal overflow).
- The original dashboard opens and links to the workspace.

## Fixes discovered through validation

- The original ONNX graph advertised an output tensor that did not exist. Added an Identity output without changing weights, updated its checksum and corrected the exporter.
- Replaced untyped Sankey callbacks that prevented a production lint/build from succeeding.
- Separated penalized QAOA circuit energy from actual placement cost; aligned classical/quantum cost coefficients.
- Changed the coarse QAOA parameter grid to avoid only beta values at integer multiples of pi.
- Prevented dashboard server/client clock differences from causing React hydration errors by initializing the live dashboard on the client.
- Cleaned up SSE reconnect timers and handled disabled/full browser decision storage.
- Handled missing local Python process stdin errors without an unhandled stream error.
- Included a dependency lockfile, CPU-only ONNX install option and improved launchers.

## Boundaries

- Authenticated Groq and Electricity Maps requests, Vercel hosting, and Windows launcher execution were not exercised using real accounts/devices.
- The deployment workflow is a local dry run plus suspended Kubernetes manifests; no live cluster was connected.
- Forecast data in the default demo is synthetic. No claim of live market performance, regulatory compliance or quantum advantage is made.
- Passing checks is evidence for tested paths, not a guarantee against all future input, provider or deployment failures.
