<div align="center">
<img src="public/brand/carbon-ledger-logo-original.png" alt="Carbon Ledger" width="115">

# Carbon Ledger
### Quantum-enhanced Carbon & Financial Impact Research
**Next.js 15 · React 19 · TypeScript · 20 cloud regions · 5 optimization engines**

[Overview](#overview) · [Features](#features) · [Engine comparison](#optimization-engines) · [Start](#quick-start) · [Vercel](#deploy-to-vercel) · [AI reports](#groq-reports) · [Tests](#validation--benchmarks) · [Repository](#repository-structure)
</div>

> **Release v160 — GitHub cleanup of v159.** The product remains a research and demonstration platform. Most regional carbon, price, risk, treasury, and workload inputs are **modeled**. Quantum circuits are simulated on classical CPUs, not executed on physical quantum hardware. No quantum speedup or investment return is guaranteed. Archived benchmark findings must not be described as live GLPK results unless GLPK was actually used.

## Overview
Carbon Ledger explores how an enterprise could distribute computing workloads across **20 cloud regions** while evaluating carbon intensity, workload capacity, geographic constraints, network latency, operating cost, and financial trade-offs. Interactive simulations allow separate algorithms to generate independent regional allocations. Weather forecasts can adjust modeled energy costs. This project does **not** deploy cloud resources, execute investment trades, or provide investment advice.

## Features

| Workspace | Role |
|---|---|
| **Overview** | Choose solver; view carbon intensity, footprint, latency and modeled treasury APY; adjust workloads, enterprise capital and regional allocations; run adaptive Autopilot |
| **Quantum Lab** | Compare algorithm behavior and selected allocations; inspect research metrics and circuit information |
| **Financial Impact** | Compare selected engine against a **same-input GLPK** reference when GLPK completes; model cloud OPEX, offsets and annual savings separately from treasury yield |
| **Quantum Scheduler** | Simulate a 24-hour schedule using hourly allocation preferences, modeled constraints and Open-Meteo data; no real cloud job dispatch |
| **Weather Optimizer** | Reuse completed dashboard allocation as baseline; calculate forecast-adjusted allocation across **all 20 regions** |
| **Research & Reports** | Show five-engine benchmark evidence and export a structured PDF/Word report with optional detailed Groq narratives |
| **Engine History** | Archived algorithms, equations, historical benchmarks and reasons modes were retired |

The dashboard's completed allocation is reused when other tabs need a baseline. APY is an investment/offset model; it is distinct from the annual cloud operating surplus or deficit. The annual USD capital control ($5M–$100M) is **not a hard cloud-spending cap**.

## Optimization engines

| ID | Display engine | Quantum role | Important limitation |
|---|---|---|---|
| `glpk` | **GLPK classical LP** | Exact classical reference using the same constraints | All claims of optimality depend on actual solver status |
| `oracle` | **Quantum Oracle (4 × 7 qubits; p=3)** | Grover-style amplitude amplification over a classically prepared candidate pool | Cost-aware classical preparation; earlier near-GLPK scores require careful audit |
| `geometry-grover` | **Adaptive Grover (4 × 10 qubits; p=3)** | Simulated adaptive Grover candidate search | Simulated on CPU; not hardware quantum advantage |
| `geometry` | **Geometry-Aware Quantum Walk (4 × 10 qubits; p=3)** | Cost-phase evolution and XY-exchange mixing | Classical candidate encoding and decoding |
| `geometry-curved` | **Curvilinear Quantum Fusion (4 × 10 qubits; p=3)** | Nonlinear Hamiltonian evolution, XY mixing and adaptive Grover | Two simulation passes; higher computation cost |

Retired variants and historical test artifacts are kept under `research/` and `docs/history/`, not in the main dashboard selectors. The source of an engine's allocation can be inspected through `/api/cooperative-allocation` or `/api/quantum-lab-live`. Independent engines do not deliberately copy GLPK allocations, but similarity does not establish a quantum advantage.

### Optimization formulation
Let \(w_i\) denote regional workload fraction, \(c_i\) the weighted regional cost, \(p_i\) preferred allocation and \(u_i\) its allowed capacity. The core experimental objective includes a placement penalty:

\[
\min_w \sum_{i=1}^{20} c_i w_i + \lambda\sum_{i=1}^{20}|w_i-p_i|,\quad \sum_i w_i=1,\quad 0\le w_i\le u_i.
\]

Modeled \(c_i\) combines carbon, cost, latency and risk terms under the current control settings. The same constraints must be used for fair engine comparisons. Historical results made with SciPy HiGHS must **not** be labeled direct GLPK timing evidence.

## Quick start

Prerequisites: **Node.js 22**, npm, reliable network during initial installation. From the extracted folder containing `package.json`:

```bash
npm ci --include=optional
npm run deploy:preflight:installed
npm run typecheck
npm run lint
npm test
npm run build
npm run dev
```

Open `http://localhost:3000` after the development server starts. Run commands in order. A failed typecheck, install or build is a real blocker; do not skip it when preparing a Vercel deployment. On Windows CMD, these commands are identical.

## Deploy to Vercel

1. Create a GitHub repository and upload the **contents** of this extracted project directory, including `package-lock.json`, `.github`, `public/models/quantum_controller.onnx`, and `vercel.json`.
2. Import that repository in Vercel. Choose **Next.js** and use the repo root as Root Directory.
3. Use **Node.js 22**, install command `npm ci --include=optional`, and build command `npm run build` (already declared in `vercel.json`).
4. In **Settings → Environment Variables**, add optional Groq keys below. Open-Meteo does not need an API key for these calls; Ember was removed and no Ember key is needed.
5. Deploy only after the build succeeds. Check `/api/health`, then run the post-deploy smoke test:

```bash
npm run deploy:smoke -- https://YOUR-DOMAIN.vercel.app --onnx
```

This smoke script exercises the GLPK and four independent research modes plus native ONNX inference. The API responses should contain 20 normalized allocations with no unintended GLPK fallbacks. The function traces GLPK WASM, ONNX binary libraries and the local ONNX model; see `next.config.ts`.

**Important:** Production build and Vercel deployment have not been verified in the offline artifact-authoring environment. Its npm registry was unreachable (`EAI_AGAIN`). GitHub CI (`.github/workflows/ci.yml`) runs installation and build checks on a networked runner. **A green CI build and a live Vercel smoke test are required** before claiming that deployment is error-free.

## Groq reports

Add **one** of these server-only environment variables in Vercel (avoid `NEXT_PUBLIC_` prefixes):

```dotenv
GROQ_REPORT_API_KEY=YOUR_SECRET
GROQ_REPORT_MODEL=openai/gpt-oss-120b
# Optional fallback if you use the Ask AI feature:
GROQ_API_KEY=
GROQ_API_KEY_2=
```

In **Research & Reports**, generate a report with the Full, Financial, Quantum, Sustainability or Operations emphasis. Generated output includes a structured executive summary, beginner explanation, technical analysis, numeric tables, uncertainty/provenance, and prioritized recommendations. PDF and Word exports preserve original numeric source tables. When no key exists or the provider fails, the app identifies its source-only fallback. Do not commit actual credentials.

The report API uses real external Groq calls only when configured; an API request can fail due to provider availability, rate limits, model permissions or timeout. Public deployments should use appropriate access restrictions and spending limits because unauthenticated report generation could consume API credits.

## Validation & benchmarks

| Verification | Status for this cleaned release |
|---|---|
| Repository integrity and deployment preflight | Checked locally |
| `npm` lockfile/package metadata | Matched |
| Source syntax and test suite | Checked; see final release message for exact counts |
| `npm ci`, complete TypeScript typecheck and Next.js production build | **Not executable in this offline environment** |
| Direct live Vercel engine checks | **Not yet verified** |
| Model asset | `public/models/quantum_controller.onnx` retained |
| Quantum computational advantage | **Not demonstrated** |

Earlier research results and formula descriptions are available in [historical research](docs/history/) and [archived benchmarks](research/benchmarks/archived/). The Research & Reports tab uses its shipped curated benchmark data. Comparisons across differently generated synthetic scenarios are not directly interchangeable.

## Repository structure

```text
Carbon-Ledger/
├── app/                     Next.js pages and server API routes
├── components/              Dashboard, optimizer, lab, research, reporting
├── lib/                     GLPK, quantum simulators, scenario policy, export logic
├── public/
│   ├── brand/               UI assets
│   ├── data/                Curated research datasets
│   └── models/              Bundled ONNX model
├── scripts/                 Reproducible tests, benchmarks and deploy tools
├── tests/                   Node and Python checks
├── research/                Older research implementations and benchmark archive
├── docs/                    Formula, feature and historic release notes
├── .github/workflows/       CI pipeline
├── .env.example             Example server-only variables (no secrets)
├── next.config.ts           Next.js build and native runtime tracing
├── vercel.json              Vercel deployment configuration
├── package.json             Scripts and package list
└── package-lock.json        Exact dependency graph
```

## Reproducibility and scientific limits

- GLPK and simulated quantum algorithms must receive the **same allocation objectives and constraints** for valid comparisons.
- Quantum CPU simulation can perform quantum operations without demonstrating quantum hardware advantage. Classical preprocessing and decoding must be disclosed.
- Regional carbon and financial metrics are scenario models. Live weather may be fetched, but it does not imply live regional energy market or grid-carbon measurements.
- A lower carbon footprint, higher APY, or lower cloud bill for one allocation does not mean better combined objective. Those are trade-offs.
- The Financial Impact page estimates impacts; no actual expenditure, offset purchase, asset management or cloud resource scheduling occurs.

## License

See [`LICENSE`](LICENSE). Avoid sharing `.env.local`, API keys, native `node_modules`, `.next` outputs, private data or benchmark outputs generated from confidential customer workloads.

## v162 Quantum Risk Intelligence (IQAE research)

The main dashboard evaluates the completed allocation of **every currently selectable engine** using a shared 3-shock risk model (regional outages, demand surges, carbon grid stress). The selector in this source version exposes **five** engines (`glpk`, `oracle`, `geometry-curved`, `geometry-grover`, `geometry`), not six. No sixth engine is fabricated. The chosen engine's allocation weights enter the risk model, and the risk panel recalculates with the selected-engine scenario. Risk review is advisory; the optimizer is **not** silently overridden.

The UI contrasts a classical Monte Carlo estimator against *ideal IQAE/Grover-amplification measurement statistics simulated on CPU*. This is a legitimate algorithmic research visualization but **not** a quantum hardware execution or quantum advantage demonstration. A Qiskit-based circuit implementation lives in `quantum_lab/iqae_cloud_risk.py` for independent research execution (`qiskit`, `qiskit-aer`, `qiskit-algorithms` required). Its fixed baseline is a controlled validation case rather than a live dashboard call. Query-complexity comparisons do not imply runtime advantages; the 8-state stress distribution can be summed exactly and is preferable to either algorithm for this tiny model.

Run `node --experimental-strip-types scripts/benchmark-iqae.mjs` to reproduce 100 seeded ideal-query-simulation versus Monte Carlo accuracy comparisons. These are research simulations with no physical quantum runtime measurements, and query costs differ. Do not advertise them as measured quantum speedups. For a production implementation, connect an authenticated Qiskit execution service, provide calibrated correlation-aware distributions and report hardware metrics.

## v163 — Expanded risk validation (research build)

The Main Dashboard risk widget now models **8 illustrative independent shocks (256 states)** instead of 3 (8 states). Its ideal-amplitude measurement readout continues to be a **CPU simulation**; it is not an on-demand quantum backend. All currently selectable dashboard engines remain supported. Production allocations are not silently replaced.

For large models and fairer comparisons, run `python scripts/benchmark-iqae-fair.py`. This creates reproducible exact-enumeration reference probabilities and 120-scenario error comparisons for ideal QAE, standard Monte Carlo, and defensive importance sampling at the same **nominal 8704-query budget**. See `quantum_lab/results/README.md` for important cost and interpretation limits. For **genuine Qiskit gate-level circuits**, install Qiskit and run `python -m quantum_lab.iqae_multishock_qiskit --bits 3` or `--bits 6`. The Qiskit backend is local simulation unless configured otherwise, and its exponential basis-state oracle is not claimed to be scalable.

**Validation note:** The Qiskit dependencies were unavailable in the package environment used to create this archive, so no real circuit execution, IBM hardware benchmark, or quantum-advantage claim is included.

## v164 — Risk-aware allocation feedback loop

The main dashboard now enables automatic risk-aware reassignment for every selectable live engine (`glpk`, `oracle`, `geometry-curved`, `geometry-grover`, `geometry`). After an engine returns its allocation, `riskAwareAllocation` computes the baseline ideal IQAE simulation, then (when its upper profile-likelihood bound is above the configured risk threshold) evaluates bounded, capacity-normalized candidate redistributions. It rejects ineligible or SLA-infeasible candidates, favors lower exact *synthetic-model* risk while penalizing increased cost, and evaluates the best candidate with simulated IQAE. It applies this new allocation to the same `OptimizationResult` used to derive nodes, cost, carbon and latency, so displayed metrics are recomputed rather than cosmetic.

The user can adjust tolerance (1–20%) and disable automatic feedback. The UI reports original and resulting risk, percentage cost change, number of search candidates, whether an allocation actually changed, and warns if the risk criterion remains unresolved. **Caution:** candidate generation and exact-model scoring are classical; IQAE measurements are simulated on a CPU. This is an illustrative hybrid policy, not a proof of quantum computational advantage, not calibrated production reliability risk, and not hardware IQAE. Existing Qiskit scripts remain separate research artifacts and are not used to optimize the live dashboard. The risk estimate should not be used as a production reliability guarantee.

**Verification limitations:** Full Next.js production build was not completed in this environment. The source was inspected, and no new TypeScript diagnostics referring to the modified dashboard/risk files were observed in a partial typecheck, but this does not constitute a clean compile.


## v165 — Live IQAE Verification Monitor

Main Dashboard > Quantum Risk Intelligence now contains an automatically updating six-check PASS/FAIL monitor: allocation sensitivity, stress sensitivity, threshold enforcement, allocation feedback consistency, agreement with an exact synthetic probability reference, and seeded reproducibility. It automatically recalculates on engine/scenario/allocation/policy changes and includes a manual recheck button. Each check displays observed values and acceptance criteria, not just badges. All checks are for a CPU-based **ideal amplitude-estimation statistics simulation**; none certifies physical quantum circuits, hardware advantage, model calibration, or production cloud safety. A statistical interval check can sometimes fail under random sampling.

Developer note: Full Next.js dependency installation and production build were not available in this packaging environment.

### v168 — Risk tolerance / bounded-search clarification
- Broader deterministic feasible allocation search across dispersion, carbon, price and latency profiles (up to 210 raw combinations, with duplicates and invalid allocations excluded).
- Reports requested risk tolerance, **lowest exact synthetic-model risk found**, applied IQAE-style upper interval bound, cost change and valid candidate count.
- Reports **Target unmet** when the selected allocation fails the IQAE upper-bound gate. The lowest exact risk is only the best among tested allocations, not a proven global lower bound.
- Continues using the ideal CPU-simulated IQAE statistics as the policy gate and independent Monte Carlo strictly as a comparison. No implied real QPU execution or quantum advantage.
- The expanded search evaluates ideal risk estimates for a shortlist of the most promising feasible candidates to bound dashboard computation cost.


## GitHub to Vercel deployment (v169 clean release)

This archive contains the **Next.js application source**, the production assets in `public/`, reproducibility code and tests. Archived benchmark dumps, training outputs, and machine-generated logs have been omitted. The CPU IQAE benchmark and IBM QPU measurement evidence used in the UI remain in `public/data/`.

1. Extract the ZIP and upload the **contents** to the root of a GitHub repository (not the ZIP itself).
2. In Vercel choose **Add New → Project → Import Git Repository**; use the repository root and let Vercel detect **Next.js**.
3. Set Node.js **22.x** and keep the existing `package-lock.json`; install via `npm ci`.
4. Add the server-side environment variables you actually use; use `.env.example` as a reference. **Never commit real API keys**. Groq features require their corresponding GROQ keys; weather data via Open-Meteo does not require an API key.
5. Deploy, then smoke-test Main Dashboard, Scheduler Impact, Weather Optimizer, IBM Hardware Testing, and all configured engines.

### Local verification

```bash
npm ci
npm run deploy:preflight:installed
npm run typecheck
npm test
npm run build
```

**Validation scope:** This clean ZIP has been structurally audited and the source-only deployment preflight run. A successful production build requires dependency installation and must still be checked in Vercel or a local Node 22 environment. The IBM QPU comparison is archived evidence, not live QPU execution by the website.
