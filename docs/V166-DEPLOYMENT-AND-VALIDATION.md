# v166 — Dynamic risk, weather and scheduler feedback

## Deploy

Import the extracted repository root (the directory containing package.json) into Vercel, select Next.js and Node.js 22. Use the committed vercel.json install/build commands. The CPU ONNX runtime is bundled in the npm package; optional CUDA binary download is skipped. Keep your existing optional AI-service environment variables. Weather needs outbound Open-Meteo access, not an API key.

## What changed

- Risk-aware allocation evaluates 16 bounded mixtures of the selected engine's weights and diversified candidates. Ideal IQAE-style profile bounds gate acceptance; exact synthetic risk also prevents accepting a genuinely worse candidate. A feasible candidate that meets the limit is preferred, with the least allocation movement among the sampled candidates. Otherwise it reports unresolved risk and selects an improving candidate if available.
- Default risk tolerance is 15%; the illustrative shock model has a risk floor above 5%. Choosing 5% is allowed but cannot be presented as compliant. The tolerance and automatic-mode switch persist between pages.
- Live Monte Carlo now uses 8,704 samples, matching 8,704 ideal oracle applications. The estimator is fixed-schedule Grover-readout maximum likelihood on CPU, not a quantum hardware execution or rigorous adaptive IQAE implementation.
- Weather calculations send successful cooling factors back to Overview. Those factors change solver telemetry and recomputed allocation/KPIs. Stored snapshots track prior factors, so returning to Weather does not compound cooling costs. Changes need not move allocations when the same constrained solution remains best.
- Completed scheduler plans publish demand × duration region shares. Overview mixes these with its selected engine weights (50% each), projects through current eligibility/capacity constraints, checks SLA, then applies the risk policy. This is a planning preference, not execution of cloud jobs or an exact replay of the hourly plan. Infeasible jobs remain unscheduled. Failed/pending schedules clear their prior scheduler contribution.
- Overview displays active weather/scheduler inputs and a clear button. Manual overrides remain explicit and take precedence over the scheduler preference. Risk processing can still modify manual weights when enabled.
- Full-precision allocation weights prevent sum/cap failures caused by four-decimal rounding.
- Research & Reports includes the supplied 120-row matched-budget comparison, summary JSON and raw CSV downloads. Supplied data are ideal simulation, not IBM hardware results. Importance sampling and exact enumeration limitations are retained.
- Fixed existing archived-test imports and incomplete TypeScript fixtures that prevented a clean build.

## Check after deployment

1. Open Overview and wait for a completed engine result. Compare automatic risk mode OFF and ON at a strict tolerance; inspect before/after risk, allocation percentages and unresolved status. At a sufficiently loose tolerance, the engine result is retained.
2. Open Weather × Quantum, change forecast hour/cooling sensitivity, wait for a successful calculation, then return to Overview. The active weather input appears and the engine reruns. Weather can affect cost even when allocations remain optimal.
3. Open Quantum Scheduler, change jobs/deadlines/demand/residency and wait for all 24 hourly calculations. Return to Overview to see the scheduler preference. Clear inputs to return to the selected engine plus risk policy.
4. Open Research & Reports and download the benchmark CSV. Every row contains 8,704 queries for both matched methods.
5. Run `npm run deploy:smoke -- https://YOUR-SITE.vercel.app --onnx` to check the deployed functions.

The two tool settings are stored in this browser, shared across tabs. They are not an account-wide backend scheduler. If Open-Meteo fails, the UI reports failure rather than inventing a live forecast. Main-dashboard allocations still respect their own current constraints and may differ from the tools' research previews.

## Validation completed

- Next.js production build: passed (37 static pages).
- TypeScript: passed.
- Tests: 157 passed, zero failures.
- ESLint: zero errors; 21 existing warnings.
- Installed deployment preflight: passed.
- Built-server smoke: native ONNX inference and all five allocation engines passed, with 20 weights and no fallback.
- Dashboard, weather, scheduler, research and both benchmark downloads returned HTTP 200.
- Benchmark CSV: all 120 rows match supplied summary means and matched query counts.
- Validation ran under Node 24 in this workspace; deployment remains pinned to Node 22. No live Vercel deployment or browser end-to-end automation was performed.
