// Run: node --experimental-strip-types --no-warnings scripts/verify-enterprise-budget-v151.mjs
// These are policy-target illustrations, NOT measured GLPK or quantum engine allocations.
import {usdToCr} from '../lib/budgetUsd.ts';
import {dynamicAllocationScores} from '../lib/dynamicAllocation.ts';
import {fractionalAllocationPolicy} from '../lib/fractionalAllocation.ts';
import {calculateEngineKpis} from '../lib/engineKpis.ts';
const nodes=Array.from({length:20},(_,i)=>({id:`region_${i+1}`,eligible:true,energy_price:40+i*7,carbon_ci:880-i*34,latency_ms:35+i*2,renewable_pct:25+i*2}));
const regions=nodes.map(n=>({carbon:n.carbon_ci,latency:n.latency_ms,unitCost:n.energy_price/1000,eligible:true}));
const results=[];
for(const budgetUSD of [5_000_000,30_000_000,100_000_000]){
 const controls={sla_ms:100,carbon_tax:.65,budget_cr:usdToCr(budgetUSD),dpdp_locked:false};
 const scores=dynamicAllocationScores(nodes,controls);
 const policy=fractionalAllocationPolicy(nodes,controls,scores);
 // Compare only scenario modeled target shares to isolate budget sensitivity.
 const kpi=calculateEngineKpis(policy.preferred,regions,controls,.4);
 results.push({budgetUSD,allocationTarget:policy.preferred,annualIncomeUSD:Number((kpi.annualTreasuryIncomeInr/83).toFixed(2)),dailyOperatingUSD:Number(kpi.operatingUsdDaily.toFixed(2)),annualOffsetUSD:Number(kpi.annualOffsetSpendUsd.toFixed(2)),offsetPercent:Number(kpi.offsetPercent.toFixed(2)),netTonnes:Number(kpi.netTonnes.toFixed(2)),netYieldPercent:Number(kpi.netApy.toFixed(2)),blendedCarbon:Number(kpi.blendedCarbon.toFixed(2))});
}
console.log(JSON.stringify({note:'Synthetic policy-target scenario only; not GLPK/quantum measured allocations',results},null,2));
