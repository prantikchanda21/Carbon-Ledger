# Submission verification — Carbon Ledger v129

## Execute before submission

```bash
npm ci
npm run smoke
npm run typecheck
npm run test
npm run build
```


## Data provenance


## Vercel secrets


## Build limitation

Local verification: smoke check PASSED; 86/92 existing Node tests PASSED; six tests could not run successfully because glpk.js or onnxruntime-node are missing from the incomplete installation. npm ci did not complete in this environment. Full TypeScript, Next.js production build, cloud provider authentication and browser interactions remain unverified. A successful Vercel build cannot be guaranteed until those checks pass.
