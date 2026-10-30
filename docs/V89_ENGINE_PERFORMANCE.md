# v89: resource-aware engine optimization

This release **does not guarantee that quantum engines beat GLPK**. Exact GLPK can be the fastest solver and can already achieve the best objective on the same model. Never describe accelerated five-qubit statevector calculations as quantum advantage.

Changes:
- Fluid/gaseous parameter search now has bounded unique statevector evaluations per five-qubit batch (fluid <=24, gaseous <=32), two adaptive restarts, deterministic short-circuiting, and deduplication of repeated angles. Batch with one eligible choice requires no angle search.
- All four dashboard modes remain available. Hybrid allocations worse than the GLPK baseline on the same `cooperativeHybrid` normalized objective fall back to the actual baseline with `engineUsed='glpk'`, `fallbackReason`, and `guardedFallback` timing flag. It still incurs quantum calculation time.
- Offline `experiment:20regions` exports the same non-regression guard as `guarded_fallback` plus its summary rate. This makes it harder to misreport rejected quantum solutions as successful quantum contributions.

Limits:
- Guard checks the shared optimized objective, **not** every independent metric (carbon, latency, price); there is no universal all-KPI guarantee.
- Runtime cannot reliably match or beat GLPK on cold runs; do not truncate timings or erase quantum overhead.
- Retained different quantum circuit widths: standard 4x10 qubits; fluid/gaseous 5-qubit batches. Benchmark findings are not circuit-resource matched.
- Benchmarking still uses modeled scenario data and does not enforce the treasury budget as a hard constraint.

Test (Node 22+, installed dependencies):

```
npm ci
npm run typecheck
npm run test
npm run experiment:20regions -- --scenarios 50 --seed 42 --shots 512 --mode fast --engines all
```

Check `artifacts/experimental-evidence/engine_summary.csv` and `all_attempts.csv`. Do not compare these timings directly with the independent Kaggle Python notebook or warm cached prior benchmarks.
