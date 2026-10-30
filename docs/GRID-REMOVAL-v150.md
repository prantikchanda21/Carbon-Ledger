# v150 — Ember and grid-panel removal

- Removed both Grid Intelligence and Grid Allocation Impact UI panels, including their dashboard, Weather Optimizer and Quantum Scheduler placements.
- Removed the Ember API request and authentication key, the unused grid provider module, and `/api/grid-data`.
- Removed optional grid override from `/api/quantum-lab-live`; the route continues to generate modeled regional carbon intensities from `lib/mockData.ts` and applies carbon scenario multipliers. Weather continues to model cooling-cost changes through Open-Meteo.
- Retained all five v149 engine modes, existing allocations, carbon-aware optimization, KPIs, Research & Reports, and History.
- Removing Ember does not make the modeled carbon baseline live; it remains explicitly synthetic.
- Configure only API keys for integrations you actually use. `EMBER_API_KEY` is no longer required or read.
- Test with `npm run smoke` and `npm run test` on Node.js 22 with project dependencies installed.
