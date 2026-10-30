# Carbon Ledger v143 — Grover Contribution Ablation

## Design

- Source engine: v142 Quantum Oracle, without modifying its allocation-selection implementation.
- 32 deterministic synthetic 20-region scenarios, seeds and objective from `scripts/benchmark-oracle-v136.mjs`.
- All methods operate on **exactly the same 4 × 128 cost-aware, classically prepared feasible candidates**.
- Grover: 4 seven-qubit statevectors, 3 Grover iterations each, 32 Born-rule shots per register; reports the best measured candidate.
- Uniform classical: 128 samples with replacement from the same 512 basis-indexed candidates (equal output sample count), 100 independent seeded replications per scenario.
- Full pool oracle: best of all 512 candidate objective scores; this is a classical exhaustive *pool* upper bound, not an LP optimum.

## Recorded Results

| Statistic | Measured result |
|---|---:|
| Grover mean gap from full-pool best | 0.00000000% |
| Uniform random mean gap from full-pool best | 0.00271492% |
| Mean Grover improvement over uniform sample | 0.00271397% |
| Scenarios where Grover beats average classical sampling | 12/32 |
| Scenarios tied | 20/32 |
| Scenarios where classical random mean beats Grover | 0/32 |
| Grover median warm engine-call time | 0.9568 ms |
| Classical sample-selection median time (excluding candidate preparation) | 0.0014 ms |

## Interpretation and limitations

**No quantum advantage demonstrated.** Equal numbers of output samples does *not* mean equal computational or oracle cost. Grover's simulated oracle explicitly evaluates energies for **all 512 candidates** to choose its threshold, while the classical sampler here samples those same precomputed energy values. Both reuse classical heuristic candidate preparation. Statevector evolution is simulated on a CPU. These runtimes are **not comparable end-to-end**: the random-selection benchmark excludes preparation, while the quantum engine does preparation internally.

The best measured quantum allocation matched the best classically prepared candidate in every scenario. Uniform sampling also essentially matched it. Better quantum sampling isn't the binding obstacle: the pool construction largely dictates the 3.44% LP gap reported for v142. The 0.0027% improvement over random sampling should not be characterized as practically meaningful without further tests, repeated measurements and a fair oracle-cost accounting.

## Reproduce

`node --experimental-strip-types scripts/benchmark-ablation-v143.mjs > benchmark-ablation-v143-results.json`

`node --experimental-strip-types --test tests/quantum-oracle-v136.test.mjs`

Full project production deployment and an actual GLPK run were not verified in this ablation. The LP gap from v142 is historical, not freshly measured here.
