# Carbon Ledger v159 — Detailed, dynamic Groq enterprise reports

## What changed

The previous report endpoint requested four small paragraphs with a 1,200-token maximum and discarded all but five rows before sending evidence. v159 replaces that with a structured long-form report system, optional when Groq is configured.

In **Research & Reports → Generate current-scenario report**, select your report focus (complete, financial, quantum, sustainability, operations) and explanation style (beginner + professional, beginner, professional). Click **Generate detailed report** and preview the first tables, or generate/download PDF or Word directly.

The report includes an AI-written executive briefing, and eight analytical areas: operational context, regional allocations, sustainability/weather, operating costs and financial impacts, optimization/quantum methods, comparison benchmarks, risk/data reliability, and recommended actions. Each area contains separate beginner and expert interpretations, source-linked observations and numbered recommendations. A glossary and section index accompany the original authoritative report data tables.

The source data is collected live from the **current browser's completed dashboard allocation**, current controls, regional telemetry, locally saved scenario experiments, published research benchmark assets, and the latest GLPK comparison from the Financial Impact page **only when its run ID matches the current dashboard snapshot**. There is no fabricated GLPK response when comparison is missing.

PDF reports render true tabular columns on landscape pages with pagination, repeated headers, and longer explanations. Word exports keep real XML tables and heading styles. The preview displays readable HTML tables.

## Groq API setup

1. In `.env.local` (development only; **never commit this file**) or Vercel Project Settings → Environment Variables, set:
   ```text
   GROQ_REPORT_API_KEY=your_groq_api_key_here
   GROQ_REPORT_MODEL=openai/gpt-oss-120b
   ```
2. If you already have `GROQ_API_KEY`, the report can reuse that key; `GROQ_API_KEY_2` is supported as another failover key. `GROQ_REPORT_API_KEY` takes priority. Keys are **server-side only**, never use `NEXT_PUBLIC_` for credentials.
3. Restart local `npm run dev` or redeploy on Vercel after changing environment variables.
4. Open Overview and wait for a completed solver result. Open Financial Impact and wait for its GLPK comparison if you want real selected-vs-GLPK financial figures included. Then open Research & Reports and click **Generate detailed report**.
5. If Groq is unavailable, a **clearly labeled source-only report** still exports; the app never claims the local report was AI-generated.

## Source integrity and safety

- Groq is asked to create explanatory text, not to alter computations. All source tables survive the export unchanged.
- Model response must contain at least seven substantial sections, source-linked evidence with real section titles, recommendations, and a glossary. Invalid results trigger source-only fallback rather than a polished-looking false report.
- No quantum advantage, production carbon savings, live data, or investment returns are invented; measured vs historical vs simulated figures are distinguished.
- Only the current browser's available saved/session data is accessible; other people's accounts and unseen Cloud Run logs are not automatically available.
- The default Groq model supports strict structured outputs; alternative configured models fall back to JSON mode if necessary, and results are validated locally.
- Typical AI report requests are larger than chat replies, use additional tokens and may be rate limited by your Groq plan. If requests time out, retry with smaller saved experiment history or check Groq quota.

## Verification

- New report validation tests: `node --experimental-strip-types --no-warnings --test tests/detailed-groq-report-v159.test.ts`
- Source test suite: `npm test`
- Deployment checks: `npm run deploy:preflight`, `npm ci --include=optional`, `npm run typecheck`, `npm run build`
- An actual remote Groq call requires **your API key and internet access**; it was not performed during the offline packaging test.
