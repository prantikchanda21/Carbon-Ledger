# Carbon Ledger v156 — Vercel deployment and runtime verification

This release hardens the v155 project. It **has not** passed an online clean `npm ci`, a full Next.js build, or a live Vercel test in the authoring environment, because npm registry access was unavailable.

## Environment

- Vercel Framework: **Next.js**
- Node.js: **22.x** (set in `package.json` and `.nvmrc`)
- Root Directory: the folder containing `package.json`
- Install command: `npm ci --include=optional`
- Build command: `npm run build`
- All five active engine APIs are Node.js routes; do not deploy as Edge functions.
- `GLPK` and `onnxruntime-node` must actually install; they are **not** included in the ZIP. The ONNX model is included at `public/models/quantum_controller.onnx`.

## Run on Windows CMD

Open CMD in the extracted project folder:

```cmd
node -v
npm ci --include=optional
npm run deploy:preflight:installed
npm run typecheck
npm test
npm run build
npm run start
```

The authoring environment completed 129/135 tests, with six tests blocked because `glpk.js` / `onnxruntime-node` could not be downloaded. Once installed on your machine, ALL tests must pass before you claim a verified release. Never suppress TypeScript errors or use `--legacy-peer-deps` to bypass package conflicts.

## Test a live Vercel deployment

```cmd
npm run deploy:smoke -- https://YOUR-PROJECT.vercel.app --onnx
```

This tests the health endpoint, the actual native ONNX inference route, and **all five** active engine modes via `/api/quantum-lab-live`: GLPK, Quantum Oracle, Adaptive Grover, Geometry-Aware Walk, and Curvilinear Fusion. It verifies a 20-region feasible allocation and rejects silent fallback or invalid KPI data. A failure means the release should not be considered deployed successfully.

## What was changed from v155

1. The `sweep` route limits parallel ONNX/GLPK calls to four and allows a longer 60-second Vercel serverless duration to reduce burst failures.
2. The GLPK health test gives cold WebAssembly initialization a more realistic bounded window.
3. Vercel output file tracing explicitly includes the Linux x64 ONNX native assets, in addition to GLPK WebAssembly and the model file.
4. A deployment preflight and an actual five-engine API smoke script are provided.
5. The CI workflow checks installed assets and runs typechecking, tests and the production build.
6. `.vercelignore` prevents uploading local `node_modules` and `.next` build artifacts.

## Deployment conditions and limitations

- The quantum engines perform **CPU statevector simulation**, not QPU executions. Four worker threads are used by the geometry modes.
- Groq API keys are optional. Do not add them to client-side `NEXT_PUBLIC_` variables.
- The ONNX inference API may fall back to GLPK (and finally to greedy) if the native model fails; this is why `--onnx` checks that actual inference worked.
- API timeouts, memory and architecture compatibility need real checks on your Vercel plan.
- No file or script can guarantee a deploy will have no errors without testing on the actual network/runtime.
