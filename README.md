<div align="center">
  <img src="public/brand/carbon-ledger-logo-original.png" alt="Carbon Ledger logo" width="105" />

# Carbon Ledger
### Carbon-Aware Cloud Optimization × Quantum Computing Research

**20 Cloud Regions · 5 Live Engines · Risk-Aware Scheduling · IBM Quantum Experiments**

**Next.js 15 · React 19 · TypeScript · GLPK · Quantum Simulation · Qiskit**

[**Live Demo**](https://carbon-ledger-global.vercel.app/) · [**GitHub**](https://github.com/prantikchanda21/Carbon-Ledger) · [Features](#key-features) · [Results](#experimental-results) · [Quick Start](#quick-start)
</div>

---

## The Problem

Cloud infrastructure must balance **cost, carbon footprint, latency, capacity, and operational risk**. Optimizing one metric can worsen another: a low-cost region may have higher modeled emissions or latency. Carbon Ledger explores these trade-offs by distributing simulated workloads across **20 cloud regions**, comparing classical optimization with quantum-inspired and CPU-simulated quantum approaches.

**The goal:** make optimization decisions explainable, interactive, measurable, and testable—not claim that quantum computing already beats classical solvers.

### Design Principles

**Design goals**

1. Retain a transparent **classical GLPK reference** rather than hiding the baseline.
2. Make simulated quantum research methods produce inspectable placement proposals.
3. Keep **20 regions** fixed for the current application workflow.
4. Recalculate meaningful metrics when engine, scenario, policy, schedule, or modeled weather changes.
5. Preserve feasibility rules and report when the requested risk target is **not met**.
6. Distinguish source data, assumptions, simulation, hardware observations, and claims.
7. Present experiments in a form that hackathon reviewers can reproduce and challenge.

## Key Features

| Module | What it does |
| --- | --- |
| **Main Dashboard** | Compare five optimization engines, inspect fractional region allocations, and measure carbon, cost, and latency trade-offs. |
| **Quantum Lab** | Explore quantum-inspired optimization methods and model comparisons. |
| **Quantum Risk Intelligence** | Compare an exact synthetic-risk reference, Monte Carlo, and ideal Grover-readout amplitude estimation; use an estimated upper risk bound to evaluate allocation policies. |
| **Quantum Scheduler** | Plan workloads across 24 hourly slots using deadlines, demand, and region constraints; inspect proposed versus actually applied dashboard shifts. |
| **Weather Optimizer** | Use Open-Meteo forecasts to model weather-sensitive energy costs across 20 regions and explore placement changes. |
| **Financial Impact** | Examine modeled operating costs, carbon outcomes, offsets, and illustrative treasury APY. |
| **IBM Hardware Testing** | Review saved real-QPU amplitude-estimation results alongside ideal CPU studies and historical hardware research. |
| **Research & Reports / Engine History** | Inspect benchmark evidence, provenance, and earlier engine designs. |

> **Scope:** This is an interactive **research prototype**, not a production cloud orchestrator. Regional inputs, risk scenarios, and financial outputs can be modeled rather than live provider measurements. The site does not migrate real workloads or execute IBM QPU jobs for each dashboard update.

## How It Works

```text
              User controls + 20-region scenario
                            |
             +--------------+--------------+
             |                             |
     Quantum Scheduler               Weather Optimizer
     (job constraints)               (price sensitivity)
             |                             |
             +--------------+--------------+
                            |
                 Optimization Engine
           GLPK / CPU quantum-style methods
                            |
                  Candidate Allocation
                            |
                 Synthetic Risk Model
         Exact risk | Monte Carlo | Ideal QAE
                            |
         Risk-aware feasible reallocation policy
                            |
                    Final Allocation
                            |
             Carbon | Cost | Latency | Finance
                            |
                         Dashboard

   Separate research workflow:
   Kaggle / Qiskit -> IBM Quantum hardware -> saved evidence
```

### Allocation Pipeline

### Core data flow

1. Controls and region telemetry define the optimization scenario.
2. An active engine generates or selects regional allocation weights.
3. Weather/scheduler adjustments may propose modified weights; the dashboard enforces feasibility and can reduce the magnitude of an invalid scheduling adjustment.
4. The synthetic risk model evaluates the current candidate; an IQAE-style upper bound determines whether the configured risk threshold is exceeded.
5. If necessary, a **classical bounded search** proposes new feasible weights. It evaluates candidates with the **exact synthetic model** and applies IQAE-style statistics to a shortlist.
6. The final allocation determines displayed environmental and financial metrics.
7. Independently stored benchmark evidence is rendered in the research interface.

### Optimization Model

Each region receives a fractional workload share `w[i]` subject to basic feasibility requirements:

```text
w[i] >= 0
sum(w[i]) = 1
w[i] <= available_capacity[i]
w[i] = 0 when region i is ineligible

Blended carbon intensity = sum(w[i] * carbon_intensity[i])
Weighted latency         = sum(w[i] * latency[i])
Weighted unit cost       = sum(w[i] * unit_cost[i])
```

The GLPK reference solves a constrained linear optimization model. Quantum-style engines propose alternatives; shared SLA, capacity, scheduler, and risk constraints may adjust their final allocations. **A different engine label does not guarantee a better objective or a different final allocation.**

## Optimization Engines

The current dashboard engine registry (`lib/quantumEngineModes.ts`) exposes **five selectable modes**:

| Engine | Approach | Execution |
| --- | --- | --- |
| **GLPK** | Linear-programming baseline | Classical |
| **Quantum Oracle — Grover 7q, p=3** | Grover-inspired candidate exploration | CPU simulation / classical support |
| **Curvilinear Quantum Fusion — 10q, p=3** | Curved optimization schedule and geometry-aware mixing | CPU simulation / hybrid |
| **Adaptive Grover — 10q, p=3** | Grover-inspired encoded candidate search | CPU simulation / hybrid |
| **Geometry-Aware XY Walk — 10q, p=3** | XY-mixer / walk-inspired exploration | CPU simulation / hybrid |

The [Engine History](https://carbon-ledger-global.vercel.app/history) documents further research, including **Standard, Fluid, Gaseous, and Cooperative QAOA**, ensemble, annealing-inspired, and other experimental configurations. Historical engines should not be confused with the five currently selectable modes. The qubit labels describe research encodings, not physical QPU execution on every website request.

### Quantum Search and Mixing Concepts

### Grover-style marked candidate search

For a modeled candidate `z` and threshold `tau`, the oracle conceptually flips the phase of marked choices; diffusion amplifies their probability in an ideal simulation:

```text
Oracle_tau |z> = (-1)^[objective(z) <= tau] |z>
Diffusion = 2|s><s| - I
```

Some variants apply objective-aware **classical** preparation, sorting, or postselection. This is hybrid research and must not be presented as a fully quantum optimizer.

### Curvilinear / XY research

The historical engine catalog records a curved time schedule and alternating cost/mixer steps:

```text
s(t) = 10*t^3 - 15*t^4 + 6*t^5
U ~ product_over_layers [ exp(-i*gamma[layer]*H_cost)
                          * exp(-i*beta[layer]*H_XY) ]
```

`H_cost` describes the encoded objective and `H_XY` a mixing operator. The physical realizability, circuit depth, classical optimization overhead, and measured quality of a model must be assessed separately.

### Independent allocations and post-processing

Each mode can propose its own weights, but shared policies may subsequently alter or normalize them. Identical final allocations across two modes would therefore require an investigation of **both** the engine and any common reallocation/post-processing path; differences cannot be inferred solely from different engine labels.

### Historical engine labels are not live services

Archived configurations include Standard QAOA + GLPK, Fluid XY-QAOA + GLPK, Gaseous QAOA + GLPK, four-technique ensembles, annealing-inspired variants, and additional geometry research. Their formulas, prior reports, and evaluation context are retained in `lib/engineCatalog.ts` and associated experiment scripts. Do not infer that all archived engines run concurrently on the live site.

## Quantum Risk Intelligence

A risk model evaluates synthetic shock scenarios for a candidate placement. The app distinguishes three approaches:

1. **Exact reference:** enumerate the `2^8 = 256` possible modeled eight-shock states.
2. **Monte Carlo:** estimate risk by randomized classical sampling.
3. **Ideal amplitude-estimation proxy:** sample simulated measurement counts from algebraically computed Grover success probabilities, then fit a likelihood estimate.

Its risk policy checks an **estimated upper confidence bound**. If the allocation fails the selected tolerance, a **bounded classical search** looks for feasible alternatives and the panel reports whether it was **Accepted**, **Reallocated**, or the **Target remains unmet**. A 5% tolerance is a policy target, not a guarantee of 5% risk.

**Terminology note:** the dashboard calls the third approach “IQAE,” but its current implementation is an **ideal fixed-schedule, maximum-likelihood Grover-readout proxy**, not certified adaptive IQAE or live quantum-circuit execution. Monte Carlo is displayed as a comparison; it is not the live allocation decision gate.

### Risk Model Internals

`lib/quantumRiskIqae.ts` defines eight illustrative independent stress factors and a base risk influenced by regional workload concentration, latency relative to SLA, and carbon intensity. Each binary shock contributes a severity increment to the modeled event probability.

```text
concentration = sum_i (normalized_weight[i]^2)

base = clamp(
   0.018
 + 0.32 * concentration
 + 0.12 * max(0, latency_ms / max(1, sla_ms) - 0.65)
 + 0.06 * max(0, carbon_intensity / 600 - 0.5),
 0.005, 0.48
)

exact_risk = sum_over_256_states [ P(state) * clamp(base + shock_severity(state), 0, 1) ]
```

The probabilities and severities are **illustrative model parameters**, not calibrated forecasts or measurements from a named cloud provider.

### Grover amplification and likelihood estimation

Given a true model probability `a`, the source computes an *ideal* success probability after `k` Grover rounds:

```text
theta = asin(sqrt(a))
p_success(k) = sin((2*k + 1) * theta)^2
```

It uses the fixed powers `k = [0, 1, 2, 4, 8, 16]`, with 128 simulated measurement draws per power. Counts are fitted on a grid of candidate values by maximizing a Bernoulli/binomial log likelihood.

```text
logL(a) = sum_k [ hits[k] * log(p_success(k; a))
                 + (shots - hits[k]) * log(1 - p_success(k; a)) ]

QAE_estimate = argmax_a logL(a)
```

The confidence interval is an **approximate profile-likelihood interval** using a likelihood-ratio cutoff. It is neither a formal hardware noise-corrected confidence interval nor a universal guarantee of coverage.

### Query accounting

A Grover round schedule is often assigned a query proxy of `2*k + 1` per shot. In the current source:

```text
powers = [0, 1, 2, 4, 8, 16]
shots_per_power = 128
query_weight_sum = 1 + 3 + 5 + 9 + 17 + 33 = 68
ideal_QAE_oracle_applications = 128 * 68 = 8704
MC_samples = 8704
```

This matches a **query-count proxy**, **not** physical gate cost, state-preparation cost, total CPU runtime, or QPU wall time. The ideal success probability is calculated from the **exact value `a`** on the CPU, which matters when interpreting claimed performance advantages.

### Feasible Search and Threshold Behavior

### Candidate search in v169

The v169 search combines:

- **Five** blending strengths: `0.15, 0.35, 0.55, 0.75, 1`.
- **Seven** penalty/ranking strengths: `0, 0.5, 1, 2, 4, 8, 16`.
- **Six** carbon/latency/cost preference profiles.

```text
5 blend values * 7 rank values * 6 profiles = 210 attempted combinations
```

After normalization, duplicate removal, eligibility/capacity/SLA filtering, fewer than 210 may be evaluated as valid distinct candidates. The code also shortlists up to 32 lowest-exact-risk candidates and includes up to eight low-cost alternatives for IQAE-style review.

### Key limitations of the search

- The search is **bounded, deterministic and classical**.
- The number reported as the *lowest risk found* is the best observed among attempted feasible candidates, **not a mathematically proven global minimum**.
- The exact synthetic risk probability participates in candidate ranking; the IQAE-style upper bound participates in policy acceptance.
- The MC estimate remains a diagnostic comparator and does **not** choose the winning placement.
- A stricter threshold can legitimately remain unsatisfied even when the algorithm reduces risk substantially.
- A scenario's modeled base risk may prevent it from reaching very low percentages through redistribution alone.

## Experimental Results

### 1. Ideal CPU amplitude-estimation study

The archived v166 study runs **30 synthetic scenarios per problem size** under a matched **8,704-query counting proxy**. Results are mean absolute estimation error (lower is better):

| Shock variables | Ideal QAE proxy | Standard Monte Carlo | Importance sampling |
| ---: | ---: | ---: | ---: |
| 3 | 0.000331 | 0.000311 | **0.000231** |
| 6 | 0.000531 | 0.000728 | **0.000364** |
| 10 | 0.000837 | 0.001086 | **0.000765** |
| 14 | **0.000934** | 0.001664 | 0.001641 |

**Finding:** ideal QAE had lower error than standard Monte Carlo for **3 of 4** tested sizes. At 14 variables the error reduction was approximately **43.8%** versus standard Monte Carlo. Importance sampling performed better at 3, 6, and 10 variables.

The query proxy **does not include full quantum state preparation, physical gate costs, or QPU runtime**. These data demonstrate favorable results in some *idealized simulations*, **not a proven practical quantum speedup**.

### 2. Real IBM Quantum hardware study

A separate fixed-schedule **MLAE** experiment was executed on the `ibm_marrakesh` QPU using three synthetic shock variables, Grover powers `[0, 1, 2]`, **128 shots per circuit**, and **8 QPU repetitions**.

| Measure | Mean absolute error |
| --- | ---: |
| **IBM QPU MLAE** | **0.034384** |
| Classical Monte Carlo | 0.007375 |
| Classical importance sampling | 0.003988 |

**Interpretation:** physical circuit execution was demonstrated, but **both classical comparators achieved lower error** in this experiment. This hardware study is **not** the deployed 20-region optimization engine and is not directly equivalent to the ideal CPU benchmark.

**Evidence:** [`public/data/iqae-fair-benchmark-v166.json`](public/data/iqae-fair-benchmark-v166.json), [`public/data/iqae-hardware/`](public/data/iqae-hardware/), and [`public/evidence/ibm-2026/`](public/evidence/ibm-2026/). IBM job ID: `dbi2m3ghoj4c73b5fj8g`.

## Scheduler, Weather, and Financial Logic

### Scheduler Integration

### Scheduler impact behavior in v169

The dashboard can try progressively smaller blend factors rather than rejecting the entire scheduling proposal immediately. The impact panel distinguishes:

1. The original engine allocation.
2. The scheduler's proposed allocation.
3. The proportion of that proposal actually applied under latency SLA constraints.
4. Whether the IQAE-style risk postprocessor subsequently changed the result.
5. The largest region-level percentage-point differences.

**Important:** A valid schedule does not guarantee a changed final allocation. If no compliant adjustment exists, or the risk postprocessor overrides the proposal, the final weights may remain unchanged or reflect different priorities. This is why the panel reports *applied* versus *proposed* effects explicitly.

### Operational constraints

The scheduler computes multiple hourly optimizations; its 24-hour view may require many backend or model evaluations. Vercel/serverless limits, rate limits, failed data calls, and scheduling feasibility may affect latency and results. Review the displayed failure/rejection status rather than inferring success from a visible weather or scheduler label alone.

### Weather-Driven Sensitivity

### Weather is not grid carbon intensity

Open-Meteo supplies weather observations/forecasts; it does **not**, by itself, measure electricity-grid carbon intensity, utility dispatch, or live carbon emissions. The integration deliberately treats weather as a **price-sensitivity input**, avoiding fabricated "real-time grid intensity" claims.

In `lib/weatherDashboardSync.ts`, weather multipliers are constrained to a moderate sensitivity band and alter the electricity-price component of a region's modeled unit cost. Carbon and other KPIs are then recalculated according to resulting allocations and the model.

```text
weather_factor = clamp(forecast_based_factor, 0.88, 1.12)

adjusted_energy_price = modeled_energy_price * weather_factor

adjusted_unit_cost = original_unit_cost
                   + change_in_energy_price / 1000
```

Exact downstream responses depend on the latest completed dashboard snapshot, controls, regional eligibility, and selection engine. Weather can affect allocations or operating prices **without** implying independently measured real-world emission reductions.

### Financial Metric Interpretation

Carbon Ledger models environmental and monetary trade-offs, with **treasury APY distinct from cloud operating profitability**.

| Metric | Interpretation |
| --- | --- |
| Blended carbon intensity | Allocation-weighted modeled intensity, typically displayed as gCO2/kWh |
| Net footprint | Modeled emissions after the application's offset logic |
| Weighted latency | Allocation-weighted modeled network latency in milliseconds |
| Operating cost | Modeled cloud-related costs; may include regional energy and other terms |
| Treasury APY | Illustrative financial yield computation tied to modeled inputs |
| Annual treasury capital | Financial scenario control; **not** a strict physical cloud-spend cap |

These indicators may move in different directions: lowering modeled risk can increase operating cost, or a cheaper allocation might have worse carbon and latency scores. The interface should show this trade-off, not a universal "best" region.

### Interpreting Scientific Evidence

### Why CPU and QPU results differ

| Ideal CPU experiment | IBM hardware experiment |
| --- | --- |
| Simulates ideal success probabilities algebraically | Executes physical quantum circuits |
| Grover powers `[0,1,2,4,8,16]` | Powers `[0,1,2]` |
| Assumes noise-free amplification | Exposed to physical noise and compilation costs |
| Matched budget of 8,704 oracle-query proxy | Per-replicate proxy of 1,152 |
| Studies multiple synthetic variable counts | Focuses on 3-shock risk event |
| Offers algorithmic simulation evidence | Offers physical execution evidence |

The studies are informative but not directly comparable as identical workloads. Do **not** say "IQAE beats Monte Carlo on IBM"; the data show the opposite.

### What would be required to make a stronger quantum-advantage claim?

1. Fully specify state preparation and risk-oracle circuits for the relevant workload distribution.
2. Count full logical and transpiled physical resources, including repeated circuit preparation.
3. Match classical and quantum budgets under a defensible cost model.
4. Compare robust MC, importance sampling, quasi-Monte Carlo, exact techniques where feasible, and task-specific analytical methods.
5. Run enough independently repeated physical trials for uncertainty intervals.
6. Test unseen distributions and report failures and invalid/infeasible results.

## Technology Stack

| Area | Tools |
| --- | --- |
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS |
| Charts / visuals | Recharts, Framer Motion, Three.js ecosystem |
| Optimization | `glpk.js`, custom CPU quantum simulation / hybrid logic |
| Research / hardware | Python, Qiskit, IBM Quantum, exported CSV/JSON |
| External services | Open-Meteo forecasts, optional Groq AI text |
| Deployment | GitHub + Vercel |

Weather forecasts influence **modeled energy-price sensitivity**; they are not measurements of live electricity-grid carbon intensity.

## Quick Start

**Requirements:** Node.js **22.x**, npm, and Git.

```bash
git clone https://github.com/prantikchanda21/Carbon-Ledger.git
cd Carbon-Ledger
npm ci
npm run dev
```

Open **http://localhost:3000**.

Optional integrations use server-side environment variables from [`.env.example`](.env.example):

```bash
# macOS / Linux
cp .env.example .env.local

# Windows PowerShell
# Copy-Item .env.example .env.local
```

| Optional variable | Purpose |
| --- | --- |
| `GROQ_API_KEY`, `GROQ_API_KEY_2` | Ask AI integration / fallback |
| `GROQ_REPORT_API_KEY`, `GROQ_REPORT_MODEL` | AI report narratives |
| `QUANTUM_MAX_CANDIDATES`, `QUANTUM_PARAMETER_GRID`, `QUANTUM_SHOTS` | Research runtime controls |

Never commit tokens, `.env.local`, or IBM Quantum credentials. **Browsing imported IBM evidence does not require an IBM API key.**

### Validate and Deploy

```bash
npm run typecheck
npm run test
npm run build
```

For Vercel, import the GitHub repository with **Next.js** as the framework, set the root to `./`, and configure optional server-side environment variables in project settings. The repository includes `vercel.json` and asset-tracing configuration for its runtime dependencies. **Verify a successful build and all API-driven pages after deploying**; a clean deployment is not asserted solely by this README.

### Deployment Notes

### GitHub-to-Vercel procedure

1. Extract the clean project ZIP, or push the project root to the GitHub repository.
2. Verify `package.json`, `package-lock.json`, `app/`, `components/`, `lib/`, and `public/` are at the **repository root**, not nested in an additional release directory.
3. Commit the source while excluding `.env.local`, `node_modules/`, `.next/`, and private files.
4. Visit [Vercel](https://vercel.com/new) and import the repository.
5. Select the Next.js framework and root directory `./`.
6. Configure required **server-side** AI keys if those features are desired.
7. Deploy and inspect both the build log and the running routes.

### Build configuration

`vercel.json` specifies the Next.js framework, a build command (`npm run build`), and an install command that invokes `npm ci` while skipping the ONNX runtime install script. It also declares the `bom1` deployment region. Do not silently replace these settings without evaluating whether your GLPK WebAssembly and ONNX assets still deploy correctly.

`next.config.ts` configures explicit output-file tracing for relevant server API paths. This is especially important for native runtime and WASM assets, which may otherwise be omitted from serverless bundles.

### Build and Route Verification

### Build verification checklist

```bash
npm ci
npm run deploy:preflight:installed
npm run typecheck
npm run test
npm run build
```

Or use the bundled script:

```bash
npm run verify:deploy
```

The most recently reported Vercel error was a TypeScript inference mismatch in `components/ControllerDashboard.tsx` around scheduler allocation handling. The v169 **TypeFix** release explicitly types the interim result as `OptimizationResult`. This addresses that particular source mismatch; **a fresh full production build and actual Vercel redeployment are still necessary to verify the fix in the deployment environment**.

### After deployment

Check the landing page, Overview, Quantum Lab, Financial Impact, Quantum Scheduler, Weather Optimizer, IBM Hardware Testing, Research & Reports, and Engine History. Exercise at least one API-dependent operation and inspect Vercel function logs rather than trusting static page rendering alone.

## Repository Guide

```text
app/                  Next.js pages and API routes
components/           Dashboard, risk, scheduler, and weather UI
lib/                  Optimization engines and allocation logic
  quantumEngineModes.ts     Five active engine definitions
  optimizer.ts              Classical placement logic
  quantumRiskIqae.ts        Synthetic risk + ideal estimator
  riskAwareAllocation.ts    Risk-policy candidate search
  schedulePlanner.ts        Scheduler logic
  weatherDashboardSync.ts   Forecast-to-dashboard adjustments
public/data/          CPU benchmarks and IBM QPU results
public/evidence/      Archived hardware experiments
research/             Experimental code and historical studies
scripts/              Benchmarks, verification, deployment checks
tests/                Automated tests
```

## Reviewer and Reproducibility Guide

### Most useful source files for a reviewer

| Question | Start with |
| --- | --- |
| What engines are selectable? | `lib/quantumEngineModes.ts` |
| What does an engine return? | `lib/types.ts`, `lib/optimizer.ts` |
| How is risk modeled? | `lib/quantumRiskIqae.ts` |
| Does Monte Carlo pick allocations? | `lib/riskAwareAllocation.ts` |
| Why do thresholds change allocations? | `lib/riskAwareAllocation.ts`, `components/QuantumRiskPanel.tsx` |
| Does the scheduler influence the dashboard? | `components/ControllerDashboard.tsx`, `components/QuantumScheduler.tsx` |
| What does weather actually change? | `lib/weatherDashboardSync.ts` |
| Where are the CPU and QPU numbers? | `public/data/iqae-fair-benchmark-v166.json`, `public/data/iqae-hardware/` |
| What are the historical engines? | `lib/engineCatalog.ts` |
| What does Vercel bundle? | `next.config.ts`, `vercel.json` |

### Available developer scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Local Next.js development server |
| `npm run typecheck` | TypeScript type validation |
| `npm run lint` | Repository ESLint pass |
| `npm run test` | Node-based TypeScript tests |
| `npm run build` | Production Next.js compilation |
| `npm run deploy:preflight` | Deployment preflight, without installed-package checks |
| `npm run deploy:preflight:installed` | Preflight after dependency installation |
| `npm run verify:deploy` | Installed preflight, typecheck, tests, and build |
| `npm run benchmark:engines` | Historical engine benchmark script |
| `npm run benchmark:latency` | Latency benchmark script |
| `npm run smoke` | Submission smoke test |

### Benchmark reproduction expectations

A reproducible study should pin the source commit, environment, pseudo-random seed, scenario set, baseline methods, execution mode, resource counting, and output files. Report the number of attempts, successful and failed runs, and aggregation method; keep individual trial data when feasible.

The CPU fair-benchmark dataset lives under `public/data/`. The original evaluation script is `scripts/benchmark-iqae-fair.py`; check its options and requirements rather than assuming it has the same execution path as the dashboard's live risk function.

### Live demo checks

- Switch engines with identical scenario inputs; verify results and detect hidden fallbacks.
- Change risk tolerance across below/near/above modeled risk; verify decision statuses.
- Change scheduler demand or deadline and compare **proposed vs applied** weights.
- Change weather settings and verify whether cost sensitivity produces changed allocations or only KPIs.
- Check data loading, API errors, empty states, and mobile layout.
- Verify AI assistant/report routes only when their keys are configured.
- Ensure IBM QPU charts are explicitly tagged as archived evidence, not live calls.

### Input Data Provenance

## API and data provenance

| Source | Used for | Caution |
| --- | --- | --- |
| In-app regional models | 20-region cost/carbon/latency constraints | Can be synthetic, illustrative, or approximated |
| Open-Meteo | Weather / forecast input | Weather is not actual grid electricity carbon intensity |
| Groq | Optional AI text features | Generated interpretations require validation |
| GLPK (`glpk.js`) | Classical allocation optimization | Compare with equal constraints and scenarios |
| ONNX model | Optional on-device/server inference paths | Model outputs are not verified physical measurements |
| IBM QPU evidence files | Historical hardware experiments | Not identical to the active browser quantum engines |
| CSV/JSON benchmark archives | Reproducible comparisons and charts | Scope, seed, version, and provenance matter |

No external grid-carbon API is implied merely by displaying region-level carbon values. Do not represent modeled carbon-intensity assumptions as real-time supplier emissions data.

## Suggested 2-Minute Judge Demo

1. **Dashboard:** select GLPK, then a quantum-style engine; compare cost, carbon, latency, and region splits under identical controls.
2. **Risk:** change risk tolerance and show the estimated upper bound, decision status, and any feasible reallocation.
3. **Scheduler / Weather:** adjust workload demand or forecast sensitivity; inspect the proposed vs applied shift and resulting dashboard values.
4. **Research / IBM:** show the ideal-CPU benchmark alongside the physical-QPU outcome, explaining both the promising simulation evidence and the hardware gap.

### Practical Caveats for Judges

### Future Research Priorities

### Proposed research directions

- Connect authenticated, permissioned real region price/latency/grid data with timestamps and audit trails.
- Design reversible risk-oracle circuits and quantify state-preparation costs rather than assuming ideal access to exact probabilities.
- Implement a documented **certified adaptive IQAE** procedure, separate from the current fixed-schedule MLAE approximation.
- Compare error versus **actual** oracle calls, gate depth, QPU time, queue time, end-to-end runtime, and energy/computation expenditure.
- Add hardware-noise experiments, calibration checks, confidence-interval coverage tests, and repeated executions on multiple backend conditions.
- Expand scheduling feasibility coverage with persisted before/after snapshots and automated regression cases.
- Add verified cloud integrations behind explicit human approval rather than silently applying simulated decisions to production systems.

## Limitations and Next Steps

- **Current:** modeled region economics/emissions, small synthetic shock models, CPU-based quantum proxies, bounded classical risk search, and archived (not continuously running) IBM jobs. Neither guaranteed savings nor physical quantum advantage has been demonstrated.
- **Next:** connect audited cloud/grid telemetry, implement fully specified reversible quantum risk oracles and adaptive IQAE, compare end-to-end resources with stronger classical estimators, expand QPU testing, and validate larger real scheduling instances.

---

<div align="center">

**Carbon Ledger — exploring when quantum methods can add value to explainable, carbon-aware cloud decisions.**

[Live Application](https://carbon-ledger-global.vercel.app/) · [Source Code](https://github.com/prantikchanda21/Carbon-Ledger) · [IBM Quantum](https://quantum.cloud.ibm.com/) · [Open-Meteo](https://open-meteo.com/)

**MIT License** · © 2026

</div>
