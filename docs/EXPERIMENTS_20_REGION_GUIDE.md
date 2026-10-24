# Carbon Ledger — 20-region experiment runner

This offline runner uses the **project's actual** CPU statevector QAOA (`lib/quantum-v8/placement.ts`), classical `glpk.js` (`lib/classicalWasmSolver.ts`), and QAOA-committed residual GLPK (`lib/cooperativeHybrid.ts`). It is not an API mock, and it does not invent performance figures. It makes no claim of quantum advantage.

## Run on your computer (Node.js 22)

From the `Carbon-Ledger` folder, after extracting into a fresh path outside OneDrive:

```sh
npm ci
npm run experiment:20regions -- --scenarios 10 --seed 42 --shots 512
```

For a quick diagnostic, start with `--scenarios 1 --shots 128`. For the full set, use `--scenarios 50` and optionally multiple **scenario seeds**, e.g. `--seed 42`, `--seed 202`, and `--seed 1401` (use separate `--out` folders to prevent overwrites).

On Windows (Command Prompt):

```cmd
npm run experiment:20regions -- --scenarios 10 --seed 42 --shots 512 --out evidence-run-42
```

The run deliberately exits with code 2 if any solver fails; failures are recorded rather than hidden. You should resolve these failures before using the data to train an algorithm selector.

## Files produced

- `solver_benchmarks.csv`: **successful, measured** results with the columns required by the Kaggle starter notebook. **Do not train when scenarios have missing algorithm results.**
- `all_attempts.csv`: successes plus failed attempts, with status.
- `raw_results.json`: per-run allocation percentages, timing, objectives, carbon and latency metrics, solver status, and constraints verification.
- `scenario-*.json`: input snapshots for every run (20 regions and all modeled regional values).
- `run_manifest.json`: machine, versions, seed, limitations, and failures.

## Important limitations

- The 20-region telemetry and capacities are **seeded modeled inputs**, not observed live carbon grid data or measured cloud-provider quotas. Use real snapshots later for external validity.
- QAOA uses the project's **four 10-qubit, p=4 statevector batches**, executed **sequentially** in this Node runner (browser Web Workers aren't involved). These are four circuits, not a 40-qubit circuit.
- The QAOA sampler currently uses an **internal fixed pseudorandom seed**. Changing `--seed` changes the *scenario*, not the optimizer seed. Do not interpret repeated scenario runs as independent optimizer-seed replicates.
- `normalized_cost` is the project's **dynamic weighted cost score**. Do not claim real US dollar spending, guaranteed budget compliance, or quantum hardware performance from these outputs.
- GLPK-only and QAOA+GLPK use a shared frozen problem. Because the QAOA commitment restricts the classical feasible space, it may tie or be worse than optimal GLPK on the same convex objective.
- The current implementation's preferred-allocation regularization is included in the solver, whereas the exported `normalized_cost` reports the linear regional score only. Thus **the exported score is not a certified optimality gap**. For a rigorous identical-objective comparison, add exact auxiliary-variable regularization cost and independent optimum verification.
- The treasury budget is still a **weighting influence**, not a verified hard spending constraint.
- `solver_benchmarks.csv` currently has two actual measured methods (`glpk_only`, `qaoa_glpk`). Training a model to select more algorithms requires implementing and executing those methods in this runner. The existing Kaggle notebook searches for `solver_benchmarks.csv`; it should not be used to claim multi-quantum-method selection from only two method labels.

This is an **experimental data collection starting point**, not a final peer-review-grade validation.
