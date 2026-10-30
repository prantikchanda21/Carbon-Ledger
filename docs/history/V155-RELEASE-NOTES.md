# Carbon Ledger v155 — All-region weather and hourly quantum scheduling

Based on v154 with the existing five engines, adaptive Autopilot, enterprise USD capital, and top-four KPI cards unchanged.

## Changes
- Weather Optimizer displays **all 20** regions in an expandable, scrollable allocation-difference table, sorted by absolute change. The underlying 20-region weather and engine calculations are preserved.
- Weather Optimizer and Quantum Scheduler now use the same annual enterprise treasury budget as the dashboard ($5M–$100M, default $30M). Scheduler edits are saved to the dashboard control key and can be seen when navigating back to Overview; changes in another tab sync via browser storage events and window focus.
- Quantum Scheduler now runs the selected engine **24 times**, once at each forecast hour +0 to +23, rather than at four 6-hour intervals. Job placement evaluates the engine region preference, modeled carbon, price, latency, eligibility, and weather across every hour of a candidate job's duration.
- Up to **3 optimization HTTP requests concurrently** to limit resource pressure. Progress is shown as N/24. A failed hour makes the schedule fail visibly rather than inventing or silently interpolating a result.
- Prevented double-applying the modeled weather cooling multiplier to scheduler operating costs: the API already uses weather-adjusted prices.
- Kept the modeled scheduling constraints (illustrative per-region capacity 100 units/hour, deadlines, region residency); no actual cloud workloads run.

## Runtime expectations and verification
The full 24-hour run makes **24 real API optimization requests**, rather than 4. This is more computationally expensive, especially for 10-qubit CPU simulations, and may exceed serverless request budgets or take noticeably longer. Forecasts require 24 complete hours for 20 regions. These are research/model simulations, not a live cloud scheduler or hardware quantum advantage.

Run `npm ci`, `npm run test`, `npm run build` before deployment. The original source environment may lack `glpk.js` and `onnxruntime-node`; do not claim production build passes until verified on your deployment machine.
