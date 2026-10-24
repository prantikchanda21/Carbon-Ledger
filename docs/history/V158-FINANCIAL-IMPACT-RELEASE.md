# Carbon Ledger v158 — Financial Impact (replaces Treasury tab)

## What changed

- Sidebar `Treasury` is renamed to **Financial Impact** at the existing `/tools/treasury` URL.
- The new view reads the **actual completed main-dashboard snapshot** (`carbon-dashboard-completed-weather-v157`), including chosen engine, 20-region allocations, telemetry, controls, residency and modeled budget.
- It sends those **same inputs** to `POST /api/cooperative-allocation` with `engine: "glpk"` to obtain a *fresh reference allocation*. It never reuses a historic benchmark as the reference and never substitutes a fake GLPK run when the API fails.
- It compares operating expenditure/day/year, carbon-offset expenditure, total operating+offset annual savings, modeled carbon intensity/footprint, network latency, and all 20 allocation percentages.
- It shows projected gross and after-offset investment APY **separately** from cloud expenditure, plus a distinctly labeled combined annual business result. Net APY does not deduct cloud spend.
- Reports can be exported to CSV for an apples-to-apples comparison with a common budget and portfolio assumption.
- Keeps the original advanced `Treasury` stress-testing workbench available by optional link `/tools/treasury-risk` rather than losing it.
- The navigation and in-app AI descriptions now refer to Financial Impact.

## Conditions for a fair comparison

1. Open Overview. Choose one of the five active engines and let its allocation finish.
2. Open Financial Impact. It checks that the selected engine and budget/control settings still match the completed dashboard snapshot.
3. If the settings have changed, return to Overview and wait for the engine. If GLPK cannot run, the view displays an error — **not fabricated results**.
4. All financial metrics are *modeled*, based on 20 region-level coefficients and shared financial assumptions; this is not real cloud billing or trading.
5. Sign convention: `Annual savings = annual GLPK cloud+offset cost - selected engine annual cloud+offset cost`. Positive savings mean the selected engine is cheaper; negative savings mean GLPK is cheaper.
6. GLPK's full weighted optimization objective can be better while another engine is better on one cost or carbon component. Individual improvements do **not** demonstrate quantum advantage.

## Verification and deployment

Run `npm ci --include=optional && npm run typecheck && npm run build` on a machine with npm registry access. The sandbox cannot fetch missing dependencies, so a complete Next.js build and deployed browser test have not been independently verified here.

New unit tests: `node --experimental-strip-types --no-warnings --test tests/financial-impact-v158.test.ts`.
