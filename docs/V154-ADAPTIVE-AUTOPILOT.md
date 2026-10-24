# v154 — Continuous condition-aware Autopilot

Autopilot is now a **continuous monitored simulation** rather than a one-off control ramp.

- Every four seconds it reads the 20-region telemetry, derives target SLA and carbon penalty from regional latency and carbon conditions, and adjusts modeled USD treasury capital within a tight range of the budget when Autopilot was enabled.
- It moves controls in bounded steps to prevent oscillation/restart storms and **keeps running until Stop**, even after targets are reached. Changing a control manually stops it.
- Material changes in carbon intensity, energy prices, network latency, or availability cause a new frozen scenario snapshot and reoptimization. Each engine recomputes allocations; carbon intensity, footprint, treasury APY, and latency KPI cards refresh after each completed result.
- Previous completed KPI cards remain visible and clearly labeled during solver requests. Old in-flight results are aborted/ignored; the correct engine/result identity is verified by evaluation keys.
- The data may be **modeled**, not necessarily live, as displayed on the dashboard. The money values are hypothetical capital-policy settings, **not automatic trading or real capital transfers**.
- Residency constraints remain exactly as the operator set them. Autopilot never relaxes DPDP residency. It does not use GLPK to generate quantum-engine allocations.

Controls may stabilize when the input conditions stop changing. That is correct; the monitoring loop remains active and responds to later changes rather than fabricating volatility. Telemetry and engine cycles are throttled to avoid overloading a deployment.

Validation: `node --experimental-strip-types --no-warnings --test tests/autopilot-v154-adaptive.test.ts tests/autopilot-v152.test.ts tests/dashboard-kpis-v153.test.ts`.

## Repro steps

1. Run `npm ci && npm run dev` in a Node.js 22 environment.
2. Choose any of the five engines, click **Start adaptive Autopilot**, and keep the Controls/KPI area open.
3. Watch three controls adjust in bounded steps and the active engine recalculate. A previous completed KPI remains labeled until the new allocation is finished.
4. Use the event injector or advance the simulation time to change modeled conditions. The policy reacts within a 4-second check and then refreshes allocations.
5. Click Stop or move a control manually; the latest controls remain selected and Autopilot stops.

## Caveats

The displayed feedback is only as live as the telemetry feed. Without an external telemetry provider, regional values are simulated or modeled, and the resulting KPI changes are scenario results, not observed infrastructure performance. No financial actions are performed.
