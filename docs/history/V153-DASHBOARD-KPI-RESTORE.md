# Carbon Ledger v153 — KPI placement and snapshot continuity

## Changes

- Restored the four primary KPI cards immediately beneath the optimization-engine dropdown and before the Controls + Allocation Editor section: **Carbon intensity, Treasury APY (after offsets), Net footprint, Network latency**.
- The four cards are always mounted, including before the initial optimization finishes and during solver recalculation.
- Last successfully completed KPI values are held in local React state when an optimization request temporarily has no current result. A prior engine's result is **explicitly labeled** as such when switching engines; it is never passed off as the newly selected engine's result.
- The cached summary stores formatted-source metric scalars and trends rather than optimizer previews; the snapshot comes only from a completed engine allocation.
- Autopilot's existing behavior is untouched: controls continue moving without unmounting and trigger recalculation at completion/Stop. During the ramp, the KPI cards show the last completed engine result.
- All treasury formulas are preserved. APY after offset expenses remains separate from cloud operating cost.

## Verification

- 11/11 targeted KPI and Autopilot tests passed.
- Full suite: **118/124 passed**; six failures come from absent `glpk.js` / `onnxruntime-node` installation in this environment, not this UI change.
- TypeScript/JSX syntax transpilation passed for the modified dashboard, KPI helper, and MetricCard.
- Full Next.js production build and live Vercel/visual browser test were **not** performed without dependencies.

## Validate locally

```bash
npm ci
npm run dev
```

Navigate to `/dashboard`. The four KPI cards should appear right below the engine selector, above Controls and Allocation Editor. Select another engine: previous values should remain visible and labeled with their previous engine until the new engine finishes. Click Autopilot and confirm the cards do not disappear.

Run focused checks:

```bash
node --experimental-strip-types --no-warnings --test tests/dashboard-kpis-v153.test.ts tests/autopilot-v152.test.ts
```
