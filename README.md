<div align="center">
  <img src="public/brand/carbon-ledger-logo-original.png" alt="Carbon Ledger logo" width="110" />

# Carbon Ledger

### Carbon-aware cloud placement, hybrid optimization, and quantum risk research

**Next.js 15 | React 19 | TypeScript | GLPK | CPU quantum simulations | IBM Quantum research | 20 regions**

[Live application](https://carbon-ledger-global-three.vercel.app/) | [Source repository](https://github.com/prantikchanda21/Carbon-Ledger) | [Quick start](#quick-start) | [Architecture](#system-architecture) | [Scientific results](#experimental-results) | [Vercel deployment](#vercel-deployment)

</div>

> **Research transparency.** Carbon Ledger is an interactive prototype and research environment, **not** a cloud orchestrator, certified emissions accounting system, or automated treasury trading service. Its optimization, weather sensitivity, risk, and APY outputs contain modeled or synthetic assumptions. The browser's "IQAE" feature uses **ideal Grover-readout probabilities calculated on a classical CPU**; the integrated risk model does not run a Qiskit circuit. Separate experiments executed related amplitude-estimation circuits on an IBM QPU. Some CPU benchmark comparisons favor ideal quantum amplitude estimation over ordinary Monte Carlo; **no practical or physical quantum advantage has been established.**

> **Release context:** This README describes the **v169 GitHub/Vercel TypeFix** source snapshot, including the expanded risk-policy search and scheduler impact diagnostics. It supersedes the outdated v160 release wording in the former README. Production-build success is **not** asserted: the most recent supplied Vercel log identified a TypeScript issue which was patched, but a subsequent complete deployment has not been observed here.

---

## Table of contents

1. [Project overview](#project-overview)
2. [Problem and design goals](#problem-and-design-goals)
3. [Capabilities and page guide](#capabilities-and-page-guide)
4. [System architecture](#system-architecture)
5. [Technology stack](#technology-stack)
6. [Optimization and mathematical model](#optimization-and-mathematical-model)
7. [Live optimization engines](#live-optimization-engines)
8. [Quantum risk intelligence](#quantum-risk-intelligence)
9. [Risk-aware reallocation and risk thresholds](#risk-aware-reallocation-and-risk-thresholds)
10. [Quantum Scheduler](#quantum-scheduler)
11. [Weather Optimizer](#weather-optimizer)
12. [Financial impact and treasury](#financial-impact-and-treasury)
13. [Experimental results](#experimental-results)
14. [IBM hardware testing and interpretation](#ibm-hardware-testing-and-interpretation)
15. [Historical engine research](#historical-engine-research)
16. [Quick start](#quick-start)
17. [Environment configuration](#environment-configuration)
18. [Vercel deployment](#vercel-deployment)
19. [Repository structure](#repository-structure)
20. [Testing and reproducibility](#testing-and-reproducibility)
21. [API and data provenance](#api-and-data-provenance)
22. [Troubleshooting](#troubleshooting)
23. [Limitations, ethics, and research roadmap](#limitations-ethics-and-research-roadmap)
24. [FAQ and glossary](#faq-and-glossary)

---

## Project overview

Carbon Ledger investigates how a hypothetical enterprise can distribute compute workloads across **20 cloud regions** while balancing operational and environmental constraints. Instead of minimizing one variable in isolation, it gives users a way to examine the trade-offs between **carbon intensity, operating cost, network latency, geographic eligibility, allocation capacity, modeled risk, and financial outcomes**.

The application has three related but distinct areas:

- **Placement and operations:** classical GLPK and CPU-simulated quantum/hybrid research engines propose fractional regional allocations; a scheduler and weather sensitivity module can influence a dashboard allocation.
- **Risk intelligence:** a synthetic shock model produces an exact reference probability, ordinary Monte Carlo estimate, and an *ideal quantum amplitude-estimation statistical simulation*. An IQAE-style confidence-bound rule informs allocation acceptance or a bounded classical search for alternatives.
- **Scientific evidence:** saved benchmark datasets distinguish ideal CPU quantum statistics from physical IBM hardware measurements, with limitations and reproducibility artifacts visible in the interface.

### What this project can and cannot do

| Capability | Implementation scope |
| --- | --- |
| Compare workload placements over 20 modeled regions | Supported in the application |
| Compute fractional region weights and blended KPIs | Supported |
| Switch among five currently selectable optimization engines | Supported in the v169 engine catalog |
| Use ideal quantum risk-estimation statistics to influence candidate acceptance | Supported, CPU-side statistical simulation |
| Compare IQAE-style estimates, standard Monte Carlo, and exact modeled risk | Supported |
| Create 24-hour scheduling proposals and apply eligible preferences | Supported, with runtime and feasibility caveats |
| Apply forecast-based price sensitivity | Supported, weather is **not** a measured grid-carbon feed |
| Display IBM quantum experiment results | Supported as imported research evidence |
| Submit live IBM jobs from the browser dashboard | **Not claimed** |
| Provision/migrate actual cloud instances | **Not implemented** |
| Guarantee lower emissions, SLA compliance, positive APY, or quantum advantage | **Not claimed** |

## Problem and design goals

Cloud workload placement is multi-objective. The cheapest region need not be the cleanest or fastest, and the best placement can change with operating conditions. A useful research prototype must therefore do more than report a single aggregate score.

**Design goals**

1. Retain a transparent **classical GLPK reference** rather than hiding the baseline.
2. Make simulated quantum research methods produce inspectable placement proposals.
3. Keep **20 regions** fixed for the current application workflow.
4. Recalculate meaningful metrics when engine, scenario, policy, schedule, or modeled weather changes.
5. Preserve feasibility rules and report when the requested risk target is **not met**.
6. Distinguish source data, assumptions, simulation, hardware observations, and claims.
7. Present experiments in a form that hackathon reviewers can reproduce and challenge.

## Capabilities and page guide

The workspace navigation has several primary pages; supplemental routes also exist in the codebase for research and legacy tools.

| Workspace | User-visible purpose | Important behavior / limitation |
| --- | --- | --- |
| **Overview** (`/dashboard`) | Engine selection, allocation, carbon and cost KPIs, latency, risk, and treasury snapshots | Scheduler inputs can be blended into the allocation, then risk-aware post-processing can modify the result |
| **Quantum Lab** (`/quantum-lab`) | Inspect optimization methods, model behavior, and research metrics | Browser quantum-style engines are principally CPU simulation / hybrid algorithms |
| **Financial Impact** (`/tools/treasury`) | Modeled cloud operating cost, offsets, and treasury consequences | Treasury APY is **not** a verified real-market return |
| **Quantum Scheduler** (`/quantum-scheduler`) | Time-windowed job scheduling and region preferences | Generates schedules and modeled allocation input; does not dispatch real cloud jobs |
| **Weather Optimizer** (`/weather-optimizer`) | Weather-informed energy-price sensitivity across 20 regions | Does not imply that weather equals live grid carbon intensity |
| **IBM Hardware Testing** (`/ibm-hardware`) | Archived IBM evidence, CPU-versus-MC data, physical QPU tests | Imported experiment exports, not continuous live IBM execution |
| **Research & Reports** (`/research`) | Benchmark inspection, provenance, and exports | Archived results must not be mislabeled as live engine telemetry |
| **Engine History** (`/history`) | Historical designs and experimental comparisons | Historical modes are not necessarily available in the active engine dropdown |

### Recommended interactive demonstration

1. Open the dashboard, choose **GLPK**, and record its allocation and KPIs.
2. Select another active engine, observing how weights and KPIs respond.
3. In the risk panel, enable automatic risk-aware allocations and compare policies such as 20%, 15%, and 5%.
4. Observe whether the outcome is **Accepted**, **Reallocated**, or **Target unmet**. Check the reported lowest risk found; a failed threshold is not a software error.
5. Change a job deadline or demand in Quantum Scheduler and inspect **Scheduler impact on dashboard** for the proposed shift, applied shift, SLA effect, and subsequent risk adjustments.
6. Open IBM Hardware Testing and toggle between **ideal CPU simulation** and **IBM QPU**. Explain why they have different results.

---

## System architecture

The diagram intentionally separates optimization, risk estimation, post-processing, UI, and archived hardware evidence. Arrows indicate logical data flow rather than independently deployed microservices.

```text
                          USER / BROWSER
                                |
                Next.js + React + TypeScript UI
                                |
         +----------------------+----------------------+
         |                      |                      |
   Dashboard controls    Scheduler / Weather    Research & Reports
         |                      |                      |
         v                      v                      v
   20-region scenario     Hourly job / forecast    Saved CSV / JSON
   + SLA + constraints    preference proposals    / IBM experiment
         |                      |                      |
         +------------+---------+                      |
                      v                                |
              OPTIMIZATION LAYER                       |
         +------------+-------------------+            |
         | GLPK / LP  | CPU quantum modes |            |
         +------------+-------------------+            |
                      |                                |
                      v                                |
              Candidate allocation                     |
                      |                                |
                      v                                |
              Risk model + estimators                  |
              - exact enumeration                      |
              - ordinary Monte Carlo                   |
              - ideal Grover-readout MLE                |
                      |                                |
                      v                                |
          Bounded feasible candidate search            |
          + IQAE-style upper-bound policy              |
                      |                                |
                      v                                |
              FINAL ALLOCATION                         |
                      |                                |
                      v                                v
         Carbon / cost / latency / modeled APY     Evidence charts
                      |
                      v
                  Dashboard

  Separately: Kaggle + Qiskit Runtime -> IBM QPU -> exported evidence
              (not the live browser optimization runtime)
```

### Core data flow

1. Controls and region telemetry define the optimization scenario.
2. An active engine generates or selects regional allocation weights.
3. Weather/scheduler adjustments may propose modified weights; the dashboard enforces feasibility and can reduce the magnitude of an invalid scheduling adjustment.
4. The synthetic risk model evaluates the current candidate; an IQAE-style upper bound determines whether the configured risk threshold is exceeded.
5. If necessary, a **classical bounded search** proposes new feasible weights. It evaluates candidates with the **exact synthetic model** and applies IQAE-style statistics to a shortlist.
6. The final allocation determines displayed environmental and financial metrics.
7. Independently stored benchmark evidence is rendered in the research interface.

### Rendering-safe mathematical notation

This README uses **ASCII / plain-text equations within fenced `text` blocks** instead of LaTeX delimiters, MathJax, or HTML math. That avoids the GitHub rendering issues caused by unsupported equation macros. Symbols below are defined next to each equation. Equations describe the conceptual or source-derived model; where a section is simplified, it says so.

---

## Technology stack

| Layer | Technology | Role |
| --- | --- | --- |
| Web application | Next.js 15 / React 19 | Pages, API routes, server rendering, browser UI |
| Application language | TypeScript | Controls, solvers, allocation logic, integration |
| Styling and data display | Tailwind CSS, Recharts, Framer Motion | Dashboard, charts, transitions |
| Visualization | Three.js, React Three Fiber, Drei | Interactive 3D visuals where used |
| Classical optimization | `glpk.js` | Linear programming reference and feasible optimization |
| Optional inference component | `onnxruntime-node` and bundled ONNX model | Supported controller/inference paths |
| Quantum research | CPU statevector/probability models; Python/Qiskit research utilities | Experimentation, not a permanent IBM backend |
| Weather data | Open-Meteo integration | Forecast-derived modeled sensitivities |
| Optional AI narratives | Groq server-side keys | Assistant / research narrative generation |
| Deployment | Vercel | Next.js hosting and serverless API routes |
| Reproducibility | Node test runner, Python research files, CSV/JSON | Unit checks and static evidence |

**Runtime distinction:** npm dependencies power the deployed web app. Python and Qiskit materials in research folders are **not automatically executed by Vercel**. Running IBM hardware experiments requires separate IBM Quantum credentials and an experiment environment such as Kaggle.

## Optimization and mathematical model

### Allocation variables

Let `N = 20` regions, with allocation `w[i]` representing the fraction of total workload assigned to region `i`.

```text
w[i] >= 0
sum(i = 1..20) w[i] = 1
w[i] <= capacity[i]
w[i] = 0, if region i is ineligible under policy
```

A region may have an estimated carbon-intensity score, unit operating price, network latency, workload eligibility, and capacity. These are not necessarily live cloud-provider measurements.

### Blended indicators

The following are explanatory forms; the code also applies its own units, financial adjustments, and modeled offsets.

```text
blended_carbon_intensity = sum_i (w[i] * carbon_intensity[i])
weighted_latency         = sum_i (w[i] * latency_ms[i])
weighted_unit_cost       = sum_i (w[i] * unit_cost[i])
```

The dashboard evaluates SLA compliance rather than treating a favorable weighted average as permission to violate all constraints. Where necessary, the engine can fall back, reject an adjustment, or leave the original weights intact.

### Classical GLPK reference

At a conceptual level, the LP reference minimizes a cost-weighted allocation with penalty terms for unwanted deviation, subject to total-load, eligibility, and capacity constraints. The engine catalog records the reference formulation as:

```text
minimize sum_i (c[i] * w[i]) + lambda * sum_i abs(w[i] - preferred[i])
subject to sum_i w[i] = 1, 0 <= w[i] <= capacity[i]
```

`c[i]` denotes a modeled region objective coefficient, `preferred[i]` a reference allocation, and `lambda` a deviation-penalty weight. Exact coefficients, scaling, and additional restrictions are set by the application scenario; do not use this conceptual expression as an exact byte-for-byte translation of `lib/optimizer.ts`.

### Why the GLPK baseline matters

GLPK is a genuine classical optimization comparison. A hybrid algorithm is **not** automatically better because it contains a quantum-themed step. Compare identical scenarios and constraints, track feasibility, and report both objective gap and execution resources.

---

## Live optimization engines

Source of truth: `lib/quantumEngineModes.ts`. As of the v169 snapshot, **five** modes are currently selectable. Other names in Engine History describe experiments and should not be counted as active dashboard engines.

| Mode ID | UI label | Method family | Quantum execution status |
| --- | --- | --- | --- |
| `glpk` | GLPK - classical reference | GLPK linear programming | Classical only |
| `oracle` | Quantum Oracle - Grover 7q p=3 | Grover-inspired CPU candidate sampling/selection | Not physical QPU execution |
| `geometry-curved` | Curvilinear Quantum Fusion - 10q p=3 | Geometry/XY mixing with a curved schedule | CPU quantum-simulation / hybrid |
| `geometry-grover` | Adaptive Grover - 10 qubits p=3 | Grover-inspired search over encoded candidates | CPU quantum-simulation / hybrid |
| `geometry` | Geometry-Aware XY Walk - 10q p=3 | Geometry-aware quantum-walk / mixing research | CPU quantum-simulation / hybrid |

**What "7q" and "10q" mean here:** These are representations in research simulations, not a claim that an IBM QPU is called for every dashboard update or that all 20 regions occupy one physical 20-qubit register.

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

---

## Quantum risk intelligence

### Three estimators, three distinct purposes

| Estimator | How it works in v169 | Role |
| --- | --- | --- |
| **Exact synthetic probability** | Enumerates all `2^8 = 256` modeled eight-shock states | Reference model and classical ranking of candidate placements |
| **Monte Carlo** | Draws pseudo-random scenario outcomes and estimates event frequency | Comparison baseline, **not** the live allocation gate |
| **"IQAE" statistical proxy** | Computes **ideal** Grover-amplified success probabilities algebraically; samples binomial outcomes; fits an MLE | Risk upper bound used by allocation policy |

The application's "IQAE" label is conventional UI terminology for its **ideal, fixed-schedule Grover-readout likelihood estimator**. Its code does **not** implement certified adaptive IQAE confidence-interval scheduling, and it does **not** execute a physical quantum circuit. This nomenclature distinction is important for scientific reporting.

### Synthetic shock model

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

### Ordinary Monte Carlo

The live risk estimator uses `8,704` Monte Carlo samples. For outcome indicator `X_j` (1 for modeled failure, 0 otherwise):

```text
MC_estimate = (1 / M) * sum_{j=1..M} X_j
M = 8704
```

The displayed Monte Carlo interval is an approximate normal-style interval; its assumptions and finite-sample coverage should not be conflated with the profile-likelihood interval from the ideal amplitude estimator.

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

### Why the three displayed percentages differ

- **Exact model risk** is the model's enumerated reference answer for current inputs.
- **Monte Carlo risk** has random sampling error.
- **IQAE-style risk** has simulated binomial measurement error and likelihood-fitting error.

Even when the IQAE-style estimate happens to be closer in one screenshot, it does not prove general superiority. The dedicated multi-scenario benchmark supplies stronger, though still idealized, evidence.

---

## Risk-aware reallocation and risk thresholds

The postprocessor in `lib/riskAwareAllocation.ts` uses the estimated **upper confidence bound**, not the Monte Carlo point estimate, to decide whether the current allocation satisfies a user-selected risk policy.

```text
if IQAE_upper_bound <= configured_threshold:
    keep current allocation (Accepted)
else:
    search alternative feasible allocations
    use exact synthetic risk to prioritize candidates
    use IQAE-style upper bounds on the shortlisted candidates
    accept a satisfying candidate if found
    otherwise report that the target remains unmet
```

### What changing tolerance means

Tolerance is a **policy limit**, not a mathematical instruction to set the risk to that number. For example, a modeled placement with ~15.6% exact risk could be accepted under a 20% policy, but require reallocation under 15%. If the explored candidates cannot reach 5%, the dashboard must report **Target unmet** rather than inventing a 5% estimate.

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

### Decisions

| Decision | Meaning |
| --- | --- |
| **Accepted** | Existing candidate passes the configured upper-bound rule |
| **Reallocated** | A different feasible candidate is selected |
| **Target unmet / unresolved** | The search did not establish a placement satisfying the rule |
| **No eligible adjustment** | Constraints or candidate generation prevent an applicable change |

**Practical tip:** A claim like "risk reduced from 15.6% to 14.7%" should be accompanied by any cost increase, exact-model reference, and the remaining distance to the risk policy.

---

## Quantum Scheduler

The scheduler is a **simulation and planning component**: it creates a 24-hour scheduling picture for workloads with demands, earliest execution windows, durations, deadlines, residency requirements, and placement constraints. It does not create jobs in AWS, Azure, GCP, or other cloud accounts.

### Flow

```text
Job configuration
      |
      v
24 hourly planning slots
      |
      v
Per-hour optimization / placement preferences
      |
      v
Aggregate feasible regional preference
      |
      v
Blend with completed dashboard engine allocation
      |
      v
SLA-compliance check + smaller blend factors if necessary
      |
      v
Risk-aware allocation postprocessor
      |
      v
Final dashboard weights + scheduler impact diagnostics
```

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

### How to verify scheduler influence

1. Record the baseline dashboard region allocations.
2. Open Quantum Scheduler and modify a workload deadline, demand, or residency rule.
3. Run/recalculate the schedule and navigate back to the dashboard.
4. Inspect the **Scheduler impact** panel: proposed shift, applied shift, SLA status, and IQAE modification.
5. Compare final region weights and KPI deltas with the baseline. A zero change should be explainable by the status message.

---

## Weather Optimizer

The Weather Optimizer uses forecast information to explore how weather-sensitive modeled energy prices might influence placement across **20 regions**.

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

### Dashboard relationship

A completed weather optimization can publish weather/scheduler preferences into the dashboard state. The dashboard must still enforce relevant allocation constraints; risk-aware post-processing can subsequently modify the final result.

---

## Financial impact and treasury

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

**Financial disclaimer:** The treasury model is for scenario exploration, not investment advice, real treasury operations, or projected actual returns.

---

## Experimental results

There are two scientifically different evidence sets. They must **never** be merged into one "quantum advantage" claim.

### A. Ideal CPU amplitude-estimation benchmark (v166)

**Source:** `public/data/iqae-fair-benchmark-v166.json` and companion CSV. Thirty synthetic scenarios per size, six Grover-power settings, 128 simulated reads per power, and a matched **8,704** query-count proxy per method.

The numbers below are **mean absolute errors in probability units**, so an error of `0.000934` is `0.0934 percentage points`, *not* 0.934 percentage points.

| Binary shock variables | States | Ideal QAE MAE | Standard MC MAE | Importance-sampling MAE | QAE vs standard MC |
| ---: | ---: | ---: | ---: | ---: | --- |
| 3 | 8 | 0.000331 | **0.000311** | **0.000231** | MC lower error |
| 6 | 64 | 0.000531 | 0.000728 | **0.000364** | QAE lower error |
| 10 | 1,024 | 0.000837 | 0.001086 | **0.000765** | QAE lower error |
| 14 | 16,384 | **0.000934** | 0.001664 | 0.001641 | QAE lower error |

At 14 variables, the reported reduction in error against standard MC is approximately:

```text
relative_error_reduction = (0.0016635008 - 0.0009342224) / 0.0016635008
                         = 0.4384
                         = 43.84%
```

**Correct interpretation:** In this fixed, idealized benchmark, QAE had lower MAE than ordinary MC in **3 of 4 tested problem sizes**. Importance sampling beat QAE at 3, 6, and 10 variables, while QAE was slightly better at 14 variables. Exact enumeration is also possible for these small synthetic models.

**Not proven:** physical speedup, realistic state-preparation advantage, lower end-to-end runtime, advantage over all classical estimators, or scalability to industrial uncertainty systems.

### B. IBM QPU amplitude-estimation repetitions

**Source:** `public/data/iqae-hardware/mlae_hardware_summary.json`, trial CSVs, comparison CSV, and compiled-circuit data.

| Property | Recorded value |
| --- | --- |
| Backend | `ibm_marrakesh` |
| Job ID | `dbi2m3ghoj4c73b5fj8g` |
| Algorithm | Fixed-schedule **maximum-likelihood amplitude estimation (MLAE)**; not certified adaptive IQAE |
| Logical experiment | At least two simultaneous shocks across 3 modeled binary regions |
| Exact reference risk | 0.10662 (10.662%) |
| Grover powers | `[0, 1, 2]` |
| Shots per power | 128 |
| Independent quantum replicates | 8 |
| Quantum measurement shots per replicate | 384 |
| Query-depth proxy per replicate | 1,152 |
| Classical repetitions | 2,000 |
| QPU mean absolute error | **0.034384** |
| Standard MC mean absolute error, query proxy | **0.007375** |
| Importance sampling mean absolute error, query proxy | **0.003988** |
| Reported wall time including wait | Approx. 33.27 seconds |

**Correct interpretation:** This particular real-hardware experiment has **larger QPU estimation error** than the classical baselines. Deeper Grover amplification can increase gate-noise and readout-noise sensitivity. The exact effect of individual error sources requires additional calibrated testing; the error differences alone do not isolate causality.

**Methodological caveats:** a three-shock exact probability is cheap to evaluate classically; a query-weight proxy is not equal physical cost; the classical trial count differs from the QPU replicate count; and the displayed results are not an end-to-end 20-region hardware optimizer.

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
7. Show a measurable improvement relevant to **the final business decision**, not merely a favorable isolated sample.

---

## IBM hardware testing and interpretation

The IBM Hardware Testing page displays two categories:

- **Historical multi-engine data exports** in `public/evidence/ibm-2026/` and related JSON datasets. Hardware-compatible analogues are not always exact ports of the application's TypeScript engines; job rows can share underlying QPU job IDs. Do not treat duplicated rows as independent executions.
- **Amplitude-estimation evidence** in `public/data/iqae-hardware/`, including the eight-repetition MLAE comparison described above.

The application imports and visualizes these artifacts. It does not require an IBM token to browse the evidence. If you wish to conduct fresh experiments, use the separate Qiskit notebook workflow, enable Kaggle internet access, provide an IBM Quantum API credential securely, and verify hardware access/quota.

**Never commit an IBM API token to GitHub.** IBM job IDs and non-secret result exports can be included for provenance, but a job ID by itself is not independent proof that a remote platform still retains the job.

---

## Historical engine research

`lib/engineCatalog.ts` preserves research configurations beyond the current selectable five modes, including:

| Research lineage | Central idea | General caveat |
| --- | --- | --- |
| Standard QAOA + GLPK | Variational candidate refinement with classical LP support | Hybrid, not stand-alone quantum speedup |
| Fluid XY-QAOA + GLPK | XY/excitation-subspace-inspired mixing | CPU-simulated, dependent on classical processing |
| Gaseous QAOA + GLPK | Alternative mixing / sampling policy | Not a claim about physical "gaseous qubits" |
| Cooperative / four-technique ensembles | Combined search, walk, minimum-selection, annealing-inspired ideas | Many candidate-selection and encoding steps remain classical |
| Oracle and Grover variants | Threshold marking and amplification of candidate states | Identical averages to GLPK need allocation-level auditing |
| Adiabatic/annealing variants | Hamiltonian interpolation and simulated annealing ideas | Discrete simulation does not imply access to quantum annealing hardware |
| Geometry / curved variants | Curved schedules, XY mixing, geometry-aware encodings | Optimization success and runtime must be measured |
| Discrete scheduler experiments | Time-windowed constrained placement research | Scheduling output does not directly execute actual jobs |

Historical performance aggregates in the catalog can originate from user-reported screenshots or research scripts. Respect each record's provenance field; do not market archived averages as fresh measurements or machine-independent guarantees.

---

## Quick start

### Prerequisites

- **Node.js 22.x** (see `.nvmrc` and `package.json`).
- npm compatible with the supplied `package-lock.json`.
- Git for cloning and version control.
- An internet connection for npm and optional weather / AI services.

### Local installation

```bash
# Clone the repository
git clone https://github.com/prantikchanda21/Carbon-Ledger.git
cd Carbon-Ledger

# Confirm correct Node version
node --version
npm --version

# Install packages according to package-lock.json
npm ci

# Create a local environment file (optional)
cp .env.example .env.local

# Start development server
npm run dev
```

On Windows PowerShell, create the env file with:

```powershell
Copy-Item .env.example .env.local
```

Open `http://localhost:3000`.

### Production-mode local test

```bash
npm run typecheck
npm run test
npm run build
npm run start
```

`npm run build` is the relevant Next.js production-build check. **Do not assume this README means the build has already passed for every Vercel environment.**

---

## Environment configuration

The source `.env.example` provides server-side optional values. **Do not prefix secrets with `NEXT_PUBLIC_`** because those values can become visible to clients.

| Variable | Needed? | Use |
| --- | --- | --- |
| `GROQ_API_KEY` | Optional | Server-side Ask AI / assistant integration |
| `GROQ_API_KEY_2` | Optional | Backup key for supported assistant path |
| `GROQ_REPORT_API_KEY` | Optional | AI-generated report narrative path |
| `GROQ_REPORT_MODEL` | Optional | Report-generation model selection; example file specifies `openai/gpt-oss-120b` |
| `QUANTUM_MAX_CANDIDATES` | Optional | Research optimizer limit |
| `QUANTUM_PARAMETER_GRID` | Optional | Research optimization grid |
| `QUANTUM_SHOTS` | Optional | Configurable simulated measurement count for relevant paths |

The default Open-Meteo integration ordinarily does not need a user-provided API key, but network access, availability, and usage policies still matter.

**IBM Quantum credentials are separate:** the imported hardware graphs work without a live IBM connection. Only independent Qiskit notebook execution needs `IBM_QUANTUM_TOKEN` and, when the account requires it, an instance CRN.

### Security rules

- Never commit `.env.local`, QPU access tokens, Groq credentials, cookies, or provider-specific private configuration.
- Add production secrets in **Vercel Project Settings -> Environment Variables**.
- Rotate any credential accidentally pushed to GitHub.
- Keep server-side API access inside trusted routes.
- Consider rate limiting, request validation, and usage caps before deploying AI features publicly.

---

## Vercel deployment

The repository includes `vercel.json`, `next.config.ts`, `.nvmrc`, `package-lock.json`, and route-level asset tracing for GLPK WebAssembly and ONNX native dependencies.

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

---

## Repository structure

This tree highlights consequential paths; it is not an exhaustive listing of the hundreds of source and research files.

```text
Carbon-Ledger/
|-- app/
|   |-- dashboard/                 # Overview and related routes
|   |-- quantum-lab/               # Active research dashboard
|   |-- quantum-scheduler/         # Job scheduling UI
|   |-- weather-optimizer/         # Forecast-based sensitivity
|   |-- ibm-hardware/              # Hardware evidence page
|   |-- research/                  # Benchmark reports
|   |-- history/                   # Engine history
|   |-- tools/treasury/            # Financial impact
|   `-- api/                       # Optimization, schedule, weather, AI, etc.
|-- components/
|   |-- ControllerDashboard.tsx    # Live allocation orchestration
|   |-- QuantumScheduler.tsx       # Scheduling interface
|   |-- WeatherOptimizer.tsx       # Weather simulation interface
|   |-- QuantumRiskPanel.tsx       # Risk / MC / IQAE displays
|   |-- IqaeEvidence.tsx           # CPU and IBM benchmark visualizations
|   `-- IbmHardwareDashboard.tsx   # Imported IBM experiment UI
|-- lib/
|   |-- quantumEngineModes.ts      # Five active engines
|   |-- engineCatalog.ts           # Active + historical descriptions
|   |-- optimizer.ts               # Placement / classical optimization
|   |-- quantumRiskIqae.ts         # Synthetic risk and ideal MLE estimator
|   |-- riskAwareAllocation.ts     # Feasible candidate search
|   |-- schedulePlanner.ts         # Scheduling logic
|   |-- weatherDashboardSync.ts    # Forecast sensitivity integration
|   |-- override.ts                # Allocation override / feasibility
|   |-- comparisonPolicy.ts
|   `-- types.ts                   # Shared data contracts
|-- public/
|   |-- models/quantum_controller.onnx
|   |-- data/iqae-fair-benchmark-v166.json
|   |-- data/iqae-fair-benchmark-v166.csv
|   |-- data/iqae-hardware/        # Measured MLAE comparison evidence
|   |-- evidence/ibm-2026/        # Historical IBM-compatible exports
|   `-- brand/                    # Branding assets
|-- tests/                        # TypeScript / Node tests
|-- research/                     # Historical experiment code and results
|-- scripts/                      # Benchmarks, preflight, deployment checks
|-- .env.example                  # Safe example placeholders
|-- .gitignore
|-- .vercelignore
|-- next.config.ts
|-- vercel.json
|-- package.json
|-- package-lock.json
`-- README.md
```

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

---

## Testing and reproducibility

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

---

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

---

## Troubleshooting

<details>
<summary><strong>Vercel: "Failed to compile" after JavaScript compilation</strong></summary>

Next.js can compile JavaScript successfully and then fail **TypeScript validation**. Read the first source error and its path. In the supplied v169 deployment log, a scheduler result inference error occurred in `components/ControllerDashboard.tsx` near line 222; the TypeFix release changes the interim allocation result annotation to `OptimizationResult`. Redeploy the correct revision, and run `npm run typecheck` locally. Do **not** disable TypeScript checks merely to hide a genuine code error.

</details>

<details>
<summary><strong>Vercel: missing GLPK WASM or ONNX library</strong></summary>

Check `next.config.ts` output-file tracing, `public/models/quantum_controller.onnx`, and the package install log. Native ONNX binaries and WASM require correct tracing for the target serverless environment. A successful webpage build alone does not prove every API route has its native assets.

</details>

<details>
<summary><strong>Why does risk remain above my 1%, 5%, or 10% tolerance?</strong></summary>

Tolerance is a policy threshold, not a risk slider. The synthetic model has baseline risk and shock severity. The allocator searches up to 210 proposal combinations, filters invalid/duplicate choices, and evaluates a shortlist. If none passes the upper-bound test, the UI should display the lowest risk **found** and say that the target is unmet. This is not proof that no feasible allocation exists globally.

</details>

<details>
<summary><strong>Why do IQAE and Monte Carlo disagree in the same dashboard snapshot?</strong></summary>

They are different estimators with random sampling error. IQAE-style results additionally depend on an idealized Grover success-probability model and likelihood fitting. Compare both to the exact-model reference, preferably across many scenarios. A single favorable result is not evidence of general advantage.

</details>

<details>
<summary><strong>Why does the Quantum Scheduler show little or no impact?</strong></summary>

The scheduler proposal may be similar to the engine allocation, may violate SLA constraints, or may be modified by the risk postprocessor. Inspect the Scheduler Impact panel for the proposed shift, applied shift, and final shift. It is legitimate for the applied shift to be zero when no compliant change is found.

</details>

<details>
<summary><strong>Why are the IBM hardware results worse than the CPU benchmark?</strong></summary>

The CPU study samples ideal probabilities; the QPU test runs noisy physical circuits with a different amplification schedule, budget, and small problem. It is neither a hardware implementation of the full 20-region application nor the same experimental protocol as the v166 CPU benchmark.

</details>

<details>
<summary><strong>Why is the AI assistant or report empty?</strong></summary>

Verify whether the relevant Groq server-side key is configured, check Vercel function logs, confirm service availability, and respect model and API usage limits. A missing optional key should not be "fixed" by exposing credentials through a client-side public environment variable.

</details>

---

## Limitations, ethics, and research roadmap

### Current limitations

1. **Synthetic rather than production-grounded scenario model.** Most region inputs and shock distributions are illustrative.
2. **Exact reference available for small problems.** The eight-shock model has only 256 enumerated states; a classical exact calculation is straightforward.
3. **CPU quantum proxy is not physical circuit execution.** The browser estimator algebraically computes ideal Grover-readout probabilities using the exact modeled probability.
4. **Not certified adaptive IQAE.** The current implementation uses a fixed power schedule and MLE-style confidence interval.
5. **Bounded classical search.** Reallocation does not prove the global minimum of risk or cost.
6. **No real cloud action.** The scheduler and weather pages model decisions, not provisioning, migration, or job dispatch.
7. **Hardware scope mismatch.** IBM MLAE tests are separate small circuits, not native execution of every dashboard optimizer.
8. **No proven physical quantum advantage.** Some ideal benchmark cases are favorable, but real QPU measurements currently trail classical baselines.
9. **Deployment variability.** Native packages, serverless function constraints, API quotas, and unverified full-build checks can affect production behavior.
10. **Modeled finance.** APY and financial impact are not actual investment returns or cloud billing guarantees.

### Proposed research directions

- Connect authenticated, permissioned real region price/latency/grid data with timestamps and audit trails.
- Design reversible risk-oracle circuits and quantify state-preparation costs rather than assuming ideal access to exact probabilities.
- Implement a documented **certified adaptive IQAE** procedure, separate from the current fixed-schedule MLAE approximation.
- Compare error versus **actual** oracle calls, gate depth, QPU time, queue time, end-to-end runtime, and energy/computation expenditure.
- Add hardware-noise experiments, calibration checks, confidence-interval coverage tests, and repeated executions on multiple backend conditions.
- Expand scheduling feasibility coverage with persisted before/after snapshots and automated regression cases.
- Add verified cloud integrations behind explicit human approval rather than silently applying simulated decisions to production systems.

### Responsible claims for demos and publications

**Acceptable:**

> In synthetic CPU benchmarks, ideal quantum amplitude-estimation readout statistics achieved lower estimation error than standard Monte Carlo in three of four tested variable counts at a matched oracle-query proxy. Separate physical IBM experiments successfully executed amplitude-estimation circuits but did not outperform the classical comparators.

**Not supported:**

> Carbon Ledger has proved practical quantum advantage, uses IBM quantum hardware for every live allocation, or guarantees real-world cloud savings.

---

## FAQ and glossary

**Is the website "quantum powered"?**  It incorporates quantum algorithm research and simulated quantum statistics into its decision workflow. Its active browser execution does not send every allocation to IBM hardware.

**Does IQAE optimize the allocation by itself?**  No. The classical optimizer/search proposes feasible placements. The ideal IQAE-style upper bound helps decide whether to keep or change them. Exact modeled risk also participates in candidate ranking.

**Is Monte Carlo controlling the risk decision?**  In the v169 `riskAwareAllocation` code path, the MC result is a comparison diagnostic; policy gating uses the IQAE-style interval and classical candidate evaluation uses exact risk.

**Why can the lowest risk found exceed the selected tolerance?**  The tolerance does not rewrite risk drivers. The bounded candidate search may not find a placement below the requested target.

**Does 20 regions mean 20 real qubits?**  No. The application uses 20 modeled placement regions; individual research engines employ separate limited-register encodings and classical postprocessing.

**Does GLPK always win?**  No universal statement follows from these experiments. The appropriate comparison depends on the exact objective, feasibility rules, reference solution, and resource budgets.

**What is "oracle query advantage"?**  An improvement under a simplified counting model for calls to a specific oracle. It is not automatically a wall-clock, energy, economic, or physical-computing advantage.

**What is MLAE?**  Maximum-likelihood amplitude estimation fits a probability from Grover-amplified success counts. A fixed-schedule MLAE method is not the same thing as a certified adaptive IQAE procedure.

**What is a QPU?**  A quantum processing unit: hardware physically executing quantum operations. A CPU-simulated ideal distribution is a separate category of result.

**What is a confidence-bound risk flag?**  A modeled policy that flags risk when the estimator's upper interval bound exceeds the selected limit. It does not imply legally certified risk compliance.

**Can I deploy via GitHub/Vercel?**  The repository is organized for that workflow. A production build must still complete successfully in the deployment environment; consult the Vercel log if it fails.

---

## Credits, links, and final note

- [Carbon Ledger live application](https://carbon-ledger-global.vercel.app/)
- [Carbon Ledger GitHub repository](https://github.com/prantikchanda21/Carbon-Ledger)
- [IBM Quantum Platform](https://quantum.cloud.ibm.com/)
- [Open-Meteo](https://open-meteo.com/)
- [GLPK](https://www.gnu.org/software/glpk/)
- [Qiskit](https://qiskit.org/)
- [Next.js](https://nextjs.org/)
- [Vercel](https://vercel.com/)

License: see the repository's `LICENSE` file. External libraries and APIs retain their own licenses and terms.

**Carbon Ledger's contribution is an inspectable, constraint-aware research workflow linking multi-region cloud optimization with quantum-inspired estimation and real hardware experimentation. It is strongest when the distinction between simulated benefit and measured QPU performance is made explicit.**
