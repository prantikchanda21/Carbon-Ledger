# Carbon Ledger v152 — Autopilot lifecycle fix

## Root cause

The Autopilot interval and `auto` state lived inside `ControlPanel.tsx`. That component was mounted only when `cooperativeActive` was true. Any changed setting invalidated the active solver result, which unmounted the panel, reset its state, and disposed the interval. The solver could also be repeatedly cancelled by the 750 ms Autopilot updates. The old stepping algorithm could stall when integer values were rounded near the target.

## Changes

- Store `autopilotActive` and the starting control values in the shared Zustand store, so rerendering or remounting the panel does not reset the session.
- Run Autopilot in the stable dashboard parent, once per 750 ms while active; **Stop autopilot** and manual preset/slider changes stop it.
- Render the Controls and Allocation editor outside the `cooperativeActive` block, keeping Autopilot accessible even before the first allocation or while the solver is busy.
- Keep `appliedControls` frozen during Autopilot; the optimization API and scenario key read that snapshot, not the moving UI controls. Recompute with the latest settings when Autopilot finishes or is stopped. This prevents solver request storms and the resulting transient engine resets.
- Correct integer/decimal stepping and the displayed progress percentage; Autopilot now reaches its target rather than stalling.

## Validation

Run `node --experimental-strip-types --no-warnings --test tests/autopilot-v152.test.ts`.

Six focused tests pass: four numerical convergence scenarios, persistent Controls placement and stable solver-input wiring. Full regression suite: 113/119 passed; six pre-existing cases fail because GLPK/ONNX dependencies are absent from this environment. A full Next.js production build and browser E2E run were not possible locally because the complete npm dependencies were unavailable.

## Manual browser check

1. Start the application: `npm ci` then `npm run dev`.
2. On Dashboard, select one of the five engines and start Autopilot.
3. Verify the button remains `Stop autopilot`, progress increases smoothly, and sliders change without the panel disappearing.
4. Verify the engine remains on its last completed allocation during the ramp and recalculates at the end.
5. Confirm pressing Stop or moving a slider manually stops Autopilot and applies the latest settings once.
