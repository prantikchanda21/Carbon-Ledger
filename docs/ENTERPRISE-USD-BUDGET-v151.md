# v151 — Enterprise USD budget and financial modeling

- The annual **treasury capital allocation** is shown in US dollars: default **$30,000,000**, range **$5M–$100M**. This is a modeled budget, not measured expenditure or real brokerage funds.
- The existing 20-region model stores `budget_cr` internally for backward compatibility with the ONNX interface. Conversion uses a **fixed scenario assumption of INR 83 per USD**; this is **not a live FX quote**. UI sliders/exports/command controls use USD.
- Every engine in the allocation API gets recalculated price-versus-carbon scores when capital changes. This is a **soft preference weighting**, not a hard cloud-spend constraint. The physical fleet remains a 240 MWh/day modeled workload, with cloud spend displayed separately.
- Treasury allocations, gross projected interest, carbon-offset allowance, footprint, operating costs and modeled net APY respond to the selected budget. The net treasury APY subtracts modeled offset expenditures only; annual cloud operating expenditure is a separate business cost. The modeled enterprise surplus subtracts both cloud OPEX and offsets (this surplus is not a treasury APY).
- Offset credits are separate from carbon futures: provision **1.5% of annual treasury capital**, with an illustrative **$25/tCO2** price. Offset use cannot exceed modeled gross emissions.
- Example: $5M allows $75k/yr in offsets, $30M allows $450k/yr, $100M allows $1.5M/yr before the emissions cap. These are assumptions for comparing scenarios, not provider quotes or realized carbon savings.
- User's stored settings migrate to the v151 USD-scoped key; historical scenario budgets remain preserved only in historical benchmark artifacts.
- Historical benchmark performance is unchanged; no new solver superiority claim is implied by increasing budget. Rebenchmark all engines under identical USD controls before comparing with older results.
