# Carbon Ledger v157 — Weather Optimizer / Dashboard synchronization

## Correct comparison

1. Visit **Overview**. Select one of the five active engines and adjust carbon penalty, max latency, India residency, and enterprise treasury capital.
2. Wait for **the selected engine to complete**. Its final allocation, 20 regional telemetry entries, constraints, selected engine and exact displayed KPI baseline are saved to this browser's same-origin local storage.
3. Visit **Weather Optimizer** on the **same browser origin/profile**. It reads the completed dashboard snapshot. The baseline percentages now match the final main dashboard allocation **region by region**. The baseline KPI values match the completed dashboard values.
4. Select forecast hour/cooling sensitivity. Weather changes **regional modeled energy prices only** (not electricity-grid carbon emissions). The weather scenario reruns `/api/cooperative-allocation` with the **same engine, regional carbon, latency, capacity/eligibility, residency and controls**.
5. The 20-row table shows original baseline vs adjusted allocation. The KPI comparison uses the dashboard's exact baseline and the modeled delta from the revised allocation and weather-adjusted regional electricity prices.
6. If you refresh or change engine settings on Overview, Weather Optimizer uses the latest **completed** result. In separate browser tabs, changes are synchronized through the storage event.

## Important limitations

- If there is no completed dashboard result, Weather Optimizer will not generate a fabricated independent baseline. Return to Overview and complete a run first.
- After a manual allocation override, the baseline shows those manual weights. The forecast scenario runs the optimizer normally, so differences reflect both the manual override and weather sensitivity; the UI warns about this.
- Forecast input comes from Open-Meteo; region-specific carbon intensity, costs, capacities and workloads remain modeled unless the dashboard uses a separate verified feed. Cooling-price factors are sensitivity estimates, not validated data-center electricity forecasts.
- Gross treasury allocation policy remains unchanged. Differences in net APY are modeled adjustment deltas, not observed investment yields.
- A direct live browser E2E or full Vercel build could not be performed here because `glpk.js`, `onnxruntime-node`, and other npm dependencies are unavailable. No claims of production quantum advantage are made.

## Verification

```cmd
npm ci --include=optional
npm run typecheck
npm test
npm run build
npm run deploy:smoke -- https://YOUR-SITE.vercel.app --onnx
```

The sync-specific tests run without external dependencies:

```cmd
node --experimental-strip-types --no-warnings --test tests/weather-dashboard-sync-v157.test.ts
```
