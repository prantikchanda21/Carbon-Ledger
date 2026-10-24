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
