# Carbon Ledger v135 — independent digitized adiabatic engine

## Scope and honesty

A new selectable engine named `adiabatic` uses a **classically simulated** 7-qubit statevector with a three-step digitized interpolation between transverse-field X mixing and a diagonal candidate-energy Hamiltonian. Four independent registers use different deterministic feasible-allocation encodings; the highest-probability measurement bitstring in each register is decoded, and the four outputs are compared by objective. No GLPK solution, LP analytical candidate, or classical optimization fallback is used to produce this engine's allocation.

This is **not execution on quantum hardware**, nor a proof of quantum advantage. The decoder is classical, final comparisons and feasibility checks are classical, and the simulated measurement uses the modal bitstring rather than a finite-shot sampling experiment. It is a standalone *quantum simulation engine*, not a pure quantum hardware optimizer.

## Method

For normalized energy E(z) and interpolation s = (step + 0.5)/3, each step applies the problem phase `exp(-i dt s E(z))` then seven transverse field rotations `exp(i dt (1-s) X_j/7)` for dt = 2.2 and p=3. The basis contains only 128 decoded configurations per 7-qubit batch. Capacity-feasible decoding is cost-blind, unlike an optimizer, but restricts reachable solutions severely. The measurement is the most probable state at the end. Source: `lib/adiabaticQuantum.ts`.

## Measured benchmarks

32 seeded synthetic scenarios with 20 regions each. Each scenario is warmed twice before a timed solve. Timing is a local Node CPU microbenchmark excluding network and UI. Classical reference uses SciPy HiGHS LP of the identical linear+L1 objective. **GLPK was not executable in this environment, so these are not actual GLPK timings.** Financial, carbon, latency and risk scores are synthetic normalized values.

| Metric | Adiabatic v135 | HiGHS LP |
|---|---:|---:|
| Mean objective gap | 43.059% | 0% |
| Median objective gap | 40.408% | 0% |
| Worst objective gap | 60.316% | 0% |
| Median runtime | 1.612 ms | 1.325 ms |
| P95 runtime | 3.143 ms | 5.472 ms |
| Feasibility | 32 / 32 | 32 / 32 |
| Carbon score | 0.46146 | 0.30149 |
| Operating-cost score | 0.30183 | 0.24829 |
| Latency score | 0.13866 | 0.12989 |
| Risk score | 0.10309 | 0.09587 |
| Treasury APY | 6.785% | 6.980% |
| Allocation mean L1 distance | 1.1462 | Reference |

### Reproduction

`node --experimental-strip-types --no-warnings scripts/benchmark-adiabatic-v135.mjs > benchmark-adiabatic-v135-raw.json`

The LP comparison was computed with SciPy `linprog(method='highs')`, adding positive deviation variables for absolute preferred-allocation regularization; reference values are in `benchmark-adiabatic-v135-results.json`.

## Known limitations

- Very restricted reachable allocation set: 128 configurations/register, 4 registers, 20 regions. This explains much of the solution gap.
- Simulated annealing is a discretized closed-system unitary process, *not thermal quantum annealing*.
- The four registers execute sequentially in this implementation, not on four physical parallel quantum processors.
- No demonstrated quantum computational advantage; the classical LP wins decisively in weighted objective and median latency.
- Runtime and deployment validation were local and focused; a complete `next build` could not be verified from this package environment.
