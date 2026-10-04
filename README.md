# Carbon Ledger — Carbon & Treasury Controller

A 20-region carbon-aware workload simulator with an ONNX controller, classical optimization, Qiskit QAOA, and a reproducible experiment workspace.

## Start on Windows

1. Install **Node.js 22.13 or newer** (Node 24 LTS recommended).
2. Unzip the project into a fresh folder.
3. Double-click **start.bat**.
4. Choose **2** to run the dashboard and experiments without Python, or **1** for the full Qiskit simulator setup (Python 3.12 recommended).
5. Open `http://localhost:3000` (landing page), click **Launch dashboard** (`/dashboard`), then **Open experiment workspace** (`/experiments`).

No API keys are needed for the demo, historical CSV imports, scheduling, replay, reports, classical/ONNX benchmarks, local storage or local Qiskit simulation. Option 1 installs Python dependencies and can take several minutes on the first launch. Option 3 is the optional Vercel local emulator and may require Vercel setup.

### Manual setup

```bash
npm ci --onnxruntime-node-install=skip
npm run dev
```

The skip option avoids downloading optional acceleration libraries. The bundled native CPU ONNX runtime is still used. A lockfile is included. Do not use files from an old `node_modules` or `.next` directory.

For a local Qiskit runtime on macOS/Linux:

```bash
python3 -m venv qiskit_train/.venv
qiskit_train/.venv/bin/python -m pip install -r requirements.txt
npm run dev
```

On Windows, `start-local.bat` sets `QUANTUM_PYTHON_PATH` automatically. Otherwise the bridge checks `qiskit_train/.venv/Scripts/python.exe` on Windows and `qiskit_train/.venv/bin/python` elsewhere. `QUANTUM_PYTHON_PATH` can override that path. The local bridge launches a Python process per request; no background helper port is required.

## Ten additions in the experiment workspace

| Feature | Where | Behavior |
|---|---|---|
| Baseline savings dashboard | Overview | Same workloads and horizon; energy, carbon charge, transfers and downtime included. Savings are withheld if either plan leaves jobs unserved. |
| Realistic scheduling | Workloads | Duration, CPU/GPU capacity, dependencies, earliest start, completion deadline, latency and India-only constraints. |
| Migration break-even | Decisions | Transfer charges/energy/emissions, bandwidth, startup and downtime; move/wait/stay and break-even runtime. |
| Historical replay | Replay | Non-overlapping windows, past-only training, realized costs and emissions, actual outage/SLA violation counts, timeline playback. |
| Explainable decisions | Decisions | Cost breakdown, best feasible alternative per region, rejected-region reasons, optional Groq narrative grounded in calculations. |
| Fair engine benchmark | Benchmarks | Exact enumeration, GLPK, ONNX and the Qiskit simulator on the same six candidates and placement cost objective. |
| Forecast accuracy | Forecasts | Seasonal historical mean with persistence fallback, walk-forward MAE, empirically calibrated residual bands and measured coverage. |
| Treasury stress tests | Treasury | Seeded correlated energy/carbon shocks, hedge premium and exposure, liquidity reserve, cost percentiles and tail mean, CSV export. |
| Saved experiments and PDF | Experiments / header | IndexedDB persistence, portable complete JSON snapshots, validated imports, PDF with assumptions, scheduling, replay, accuracy, audit and benchmark snapshot. |
| Approval and execution | Execution | Draft → approval → dry-run execution → rollback; input edits invalidate approval; suspended Kubernetes Job and rollback exports. |

## Reproducibility and data

The initial dataset is **168 hours of deterministic synthetic telemetry**, seeded with 42. It is visibly labelled. It is not a live market or historical measurement dataset.

- Export the CSV template from Overview, replace its values with your own hourly observations, and import it.
- Columns: `timestamp,region,carbon_ci,energy_price,latency_ms,egress_cost_gb,available,source`.
- Each timestamp must be a unique UTC hour with all 20 catalog region codes. Hours must be contiguous. Maximum: 744 hourly snapshots (31 days).
- Units: carbon `gCO2/kWh`, energy `USD/MWh`, latency `ms`, egress `USD/GB`.
- `source` is `mock`, `electricity-maps`, or `stale`; `available` is `true` or `false`.
- Importing history sets the forecast origin to the hour after the latest observation. Set a different UTC origin in Overview to inspect other windows.
- JSON experiment exports contain complete history, jobs, capacities, controls, seed, version, calculated results, treasury settings, benchmark snapshot and local audit.
- Loading/importing recalculates scheduling and resets approval. Treasury settings are restored when present. Saved benchmark snapshots can be inspected in JSON; run the benchmark again for fresh runtime measurements.
- IndexedDB is local to the browser and origin. It is not account/cloud sync. Keep JSON backups for portability. Audit records are not tamper-proof.

The existing Electricity Maps adapter supplies carbon intensity only when configured. It does not make energy prices, latency, egress costs or capacities live. The experiment workspace labels each metric's provenance. A dashboard snapshot may be captured only when it fits the imported dataset's contiguous hourly timeline.

## Scheduling and accounting

The new workspace uses a deterministic **deadline-first greedy scheduler**, not a globally optimal job-shop solver. Dependencies are resolved first; each ready job chooses its least-cost feasible region/start window after accounting for earlier reservations.

- Baseline stays in the current region and starts at the first feasible time.
- Optimized mode may move location, defer the job, or stay.
- Job energy is spread evenly across whole-hour runtime slots.
- Migration time is data size / bandwidth + startup time; its reservation is rounded up to whole hours before runtime. Destination resources are conservatively reserved during this period.
- Transfers use source egress prices and the mean source/destination energy and carbon intensities. Outgoing source network capacity is not modelled.
- Carbon charge = kg CO2 × user-selected USD per tonne / 1000.
- Total cost = runtime energy + transfer/transfer-energy cost + downtime + carbon charge.
- Compute rental, storage rental, monetary penalties for missed service and embodied emissions are excluded. Jobs are never silently dropped from comparison accounting.
- India-only is an explicit placement constraint, not a claim of legal certification.
- The original dashboard's legacy lightweight scheduler, simulated charts and treasury model remain available; the v5 workspace is the detailed experiment model.

## Forecasting and replay

A forecast uses only snapshots strictly before its origin. It averages up to seven preceding observations of the same UTC hour, falling back to the last six observations when necessary. Current availability/latency are carried from the last available snapshot. Future outages are not known in advance.

Accuracy uses one-hour walk-forward evaluation. Interval radius is the empirical 90th percentile of preceding absolute errors; 12 residual observations are required before scoring coverage. The nominal coverage is not guaranteed. A future multi-hour band's coverage has not been independently calibrated per lead time.

Replay requires at least 48 training hours plus one complete horizon. It plans with past-only forecasts, then evaluates the fixed plan against actual rows. Each window reuses the same workload set. It counts actual job-hours with an outage/SLA breach; it does not automatically retry failed jobs. Missing/unserved workloads invalidate that window's savings comparison.

## Quantum and classical comparisons

The v5 benchmark isolates expected placement cost:

`energy_price / 1000 + carbon_tax * 0.25 * carbon_ci / 1000 + egress_cost_gb * 0.05`

It selects up to six strictly eligible candidates, uses sum(weights)=1 and cap=1, and compares GLPK, exact enumeration, projected ONNX probabilities and conditional feasible QAOA sample probabilities. The treasury hedge is disabled in benchmark circuits. The benchmark's 0–1 carbon control follows the controller formula; the scheduling workspace uses a separately labelled explicit USD/tCO2 setting.

The QAOA circuit's **penalized energy is not a USD cost**. v5 reports placement cost separately and corrects the original mismatch. Classical and quantum use the same carbon/egress coefficients. QAOA uses a small p=1 parameter search; no quantum advantage is claimed. End-to-end latency is reported separately from compute time. 

The ONNX surrogate is the existing 84–128–128–64–21 network distilled from the encoded QAOA reference teacher. v5 repairs its missing named graph output without changing trained weights. The exporter is fixed to produce a valid output on rebuild. Native inference was exercised in validation. ONNX training and model calibration were not rerun.

Keep `QUANTUM_MAX_CANDIDATES=6` for the six-candidate benchmark; mismatched candidate sets are flagged as infeasible comparisons.

## Optional services

Copy `.env.example` to `.env.local` and fill only the services you use:

- `GROQ_API_KEY` (+ optional `GROQ_API_KEY_2`): optional natural-language commands, the dashboard "Explain what's happening" summary and calculated-decision explanations. With two keys the backup is used automatically if the primary fails; set `GROQ_STRATEGY=balance` to alternate them. Deterministic explanations remain available without it.
- `ELECTRICITY_MAPS_API_KEY`: optional live carbon intensity.

Keys stay server-side. No real keys are included in this archive.

## Execution integration

Execution in this release is **dry-run only**. Kubernetes exports contain suspended Jobs with placeholder container images, regional node selectors and CPU/GPU resource requests. Review them and replace images/labels before use. Do not assume the exported timestamps schedule Kubernetes automatically. An external orchestrator must handle dependencies, transfers and timed unsuspension. No cluster connection or automatic deployment is included.

A rollback export creates new suspended jobs in the original regions; it does not undo completed work or reverse external side effects. Changing scenario inputs invalidates the approval fingerprint.

## Validation

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

See `VALIDATION.md` for checks run on this version and the boundaries of validation. Third-party credentials, provider quotas, hardware availability and every possible deployment environment cannot be guaranteed by a local test run.

## Layout

- `app/page.tsx`: browser-safe dashboard entry.
- `components/ControllerDashboard.tsx`: original dashboard and link to experiments.
- `app/experiments/page.tsx`: nine-tab v5 workspace.
- `lib/lab/`: scheduling, forecasting, replay, stress tests, persistence, reports and exports.
- `app/api/benchmark/`: fair classical/ONNX benchmark.
- `app/api/explain/`: optional Groq explanation with deterministic fallback.
- `python_quantum/`: local Qiskit simulator QAOA path.
- `qiskit_train/`: training pipeline, reference labels and model manifest.
- `components/`: original dashboard panels plus benchmark interface.
- `tests/`: controller, UI contract and v5 calculation regression tests.

## Vercel

The original `vercel.json` retains Next.js and Python quantum function routing. Add environment variables through Vercel project settings. Vercel deployment and authenticated provider calls were not performed in this task. If your hosting plan restricts Python bundles or function duration, run the Python backend separately and adapt the quantum endpoints. The ordinary experiment workspace is client-side except for optional explanations and engine benchmarks.
