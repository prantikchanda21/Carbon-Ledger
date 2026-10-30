# v160 GitHub/Vercel readiness notes

This is a clean GitHub distribution of v159; no engine algorithms or model weights were altered. Historical root-level artifacts moved to `research/benchmarks/archived/` and `docs/history/`, with known benchmark scripts adjusted for their relocated inputs. 

## Validation limits
`npm ping` failed with `EAI_AGAIN` (npm registry unreachable). TypeScript syntax checks, local Node tests, deployment preflight, and submission smoke run where packages permit. Actual Next.js build, package installation, native ONNX and GLPK execution, production HTTP checks and live Groq calls **must be run on a networked environment**. 

## Credentials
Do not commit Groq API keys or `.env.local`. Configure `GROQ_REPORT_API_KEY` (or `GROQ_API_KEY`) as Vercel environment variable. No Ember API key is required.

## Verify
```bash
npm ci --include=optional
npm run deploy:preflight:installed
npm run typecheck
npm run lint
npm test
npm run build
npm run deploy:smoke -- https://YOUR-DOMAIN.vercel.app --onnx
```

## Local verification summary (23 October 2026)
- Deployment source preflight: passed (0 failures).
- Submission smoke: passed.
- Node tests: 146 passed, 6 failed (missing GLPK and ONNX runtime packages; npm registry not accessible from this environment).
- `npm ping` resulted in `EAI_AGAIN`. Accordingly a clean `npm ci`, TypeScript typecheck and `next build` could not be certified.
- Vercel production and all engine/API runtime calls must be verified after a networked dependency install.
