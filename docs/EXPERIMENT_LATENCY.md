# QAOA experimental latency mode

The target is <10 ms **warm-state QAOA simulator time**, not guaranteed end-to-end Vercel request latency.

Default server mode: fixed-angle p=4 QAOA. This genuinely evolves 10-qubit statevectors for four sequential batches, but **does not tune QAOA angles**. A smaller run time is achieved by removing expensive parameter search; solution quality must be compared with the previous full-search algorithm.

Run `npm run experiment:20regions -- --scenarios 10 --seed 42 --shots 512 --mode fast` (default). For the reference, use `--mode full`. Set `CARBON_QAOA_FULL_SEARCH=1` on Vercel to restore full-search server behavior.

Local isolated measurements (this container, Node 22): fixed-angle QAOA warmed trials took 4.84, 7.42, 6.81, 7.00 ms; first cold trial 22.88 ms. The former full-search mode was about 36–50 ms. **These are not measurements of the QAOA+GLPK end-to-end experiment, nor of your PC or Vercel**. Do not claim under-10-ms total runtime until the full benchmark verifies it.

The experiment runner exports actual end-to-end `runtime_ms` and `qaoa_execution_ms`. Report median, p95, cold start, correctness, and objective gap. Budget is modeled as a scoring pressure, not a hard enforced constraint.
