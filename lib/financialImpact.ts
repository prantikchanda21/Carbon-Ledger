/** Side-by-side *modeled* finance from identical region inputs and treasury policy.
 * No comparison is valid unless both allocations are feasible on the same snapshot.
 * Savings are operating + offsets; investment APY remains a separate capital return.
 */
import {calculateEngineKpis,type EngineKpis,type KpiRegion} from './engineKpis.ts';
import {REGION_ORDER} from './regions.ts';
import {crToUsd} from './budgetUsd.ts';
import {USD_INR} from './constants.ts';
import type {DashboardWeatherSnapshot} from './weatherDashboardSync.ts';

export type FinancialSide={
  operatingDailyUsd:number;annualCloudUsd:number;annualOffsetUsd:number;
  grossApyPct:number;netApyPct:number;annualTreasuryIncomeUsd:number;
  annualOperatingAndOffsetUsd:number;annualCombinedUsd:number;
  carbonIntensity:number;netTonnesDaily:number;latencyMs:number;weights:number[];
};
export type FinancialComparison={
  selected:FinancialSide;glpk:FinancialSide;treasuryCapitalUsd:number;
  dailyCloudSavingsUsd:number;annualCloudSavingsUsd:number;annualOffsetSavingsUsd:number;
  annualTotalSavingsUsd:number;annualCombinedDifferenceUsd:number;
  netTonnesAvoidedDaily:number;regionsMoved:number;weightShiftPct:number;
};
const finite=(x:number)=>Number.isFinite(x);
const E=1e-6;
export function sameSnapshotRegions(snapshot:DashboardWeatherSnapshot):KpiRegion[]{
 const lookup=new Map(snapshot.nodes.map(n=>[n.id,n]));
 return REGION_ORDER.map(id=>{
  const n=lookup.get(id);if(!n)throw Error(`Missing region ${id}`);
  return {carbon:n.carbon_ci,latency:n.latency_ms,unitCost:n.unit_cost_usd_per_kwh,eligible:n.eligible};
 });
}
export function validateFinancialWeights(weights:number[],regions:KpiRegion[]){
 if(weights.length!==20||regions.length!==20||!weights.every(finite)||
  Math.abs(weights.reduce((a,b)=>a+b,0)-1)>E||weights.some((w,i)=>w< -E||(!regions[i].eligible&&w>E)))
  throw Error('Non-feasible allocation: cannot compare financial impact');
}
export function compareFinancialImpact(snapshot:DashboardWeatherSnapshot,glpkByRegion:Record<string,number>):FinancialComparison{
 const regions=sameSnapshotRegions(snapshot);
 const selectedWeights=REGION_ORDER.map(id=>snapshot.weights[id]);
 const glpkWeights=REGION_ORDER.map(id=>glpkByRegion[id]);
 validateFinancialWeights(selectedWeights,regions);validateFinancialWeights(glpkWeights,regions);
 const selectedKpis=calculateEngineKpis(selectedWeights,regions,snapshot.controls,snapshot.hedgeFraction);
 const glpkKpis=calculateEngineKpis(glpkWeights,regions,snapshot.controls,snapshot.hedgeFraction);
 if(!selectedKpis.feasibleWeights||!glpkKpis.feasibleWeights)throw Error('Model rejected infeasible financial allocation');
 // Reuse the actual completed dashboard financial/energy baseline. Apply modeled
 // GLPK deltas under identical inputs, as the Weather Optimizer already does.
 const selectedDaily=snapshot.baseline.operatingUsdDaily;
 const glpkDaily=selectedDaily+glpkKpis.operatingUsdDaily-selectedKpis.operatingUsdDaily;
 const selectedApy=snapshot.baseline.netApy;
 const glpkApy=selectedApy+glpkKpis.netApy-selectedKpis.netApy;
 const usdCapital=crToUsd(snapshot.controls.budget_cr);
 const make=(weights:number[],kpis:EngineKpis,operatingDailyUsd:number,netApyPct:number,actual:boolean):FinancialSide=>{
  const annualOffsetUsd=kpis.annualOffsetSpendUsd;
  const annualTreasuryIncomeUsd=kpis.annualTreasuryIncomeInr / USD_INR; // exchange rate is modeled and documented in constants
  const annualCloudUsd=operatingDailyUsd*365;
  return {weights,operatingDailyUsd,annualCloudUsd,annualOffsetUsd,
    grossApyPct:kpis.grossApy,netApyPct,annualTreasuryIncomeUsd,
    annualOperatingAndOffsetUsd:annualCloudUsd+annualOffsetUsd,
    annualCombinedUsd:annualTreasuryIncomeUsd-annualCloudUsd-annualOffsetUsd,
    carbonIntensity:actual?snapshot.baseline.blendedCarbon:snapshot.baseline.blendedCarbon+kpis.blendedCarbon-selectedKpis.blendedCarbon,
    netTonnesDaily:actual?snapshot.baseline.netTonnes:snapshot.baseline.netTonnes+kpis.netTonnes-selectedKpis.netTonnes,
    latencyMs:actual?snapshot.baseline.weightedLatency:snapshot.baseline.weightedLatency+kpis.weightedLatency-selectedKpis.weightedLatency};
 };
 const selected=make(selectedWeights,selectedKpis,selectedDaily,selectedApy,true);
 const glpk=make(glpkWeights,glpkKpis,glpkDaily,glpkApy,false);
 const totalShift=selectedWeights.reduce((s,w,i)=>s+Math.abs(w-glpkWeights[i]),0);
 const annualCloudSavingsUsd=glpk.annualCloudUsd-selected.annualCloudUsd;
 const annualOffsetSavingsUsd=glpk.annualOffsetUsd-selected.annualOffsetUsd;
 return {selected,glpk,treasuryCapitalUsd:usdCapital,dailyCloudSavingsUsd:glpk.operatingDailyUsd-selected.operatingDailyUsd,
  annualCloudSavingsUsd,annualOffsetSavingsUsd,annualTotalSavingsUsd:annualCloudSavingsUsd+annualOffsetSavingsUsd,
  annualCombinedDifferenceUsd:selected.annualCombinedUsd-glpk.annualCombinedUsd,
  netTonnesAvoidedDaily:glpk.netTonnesDaily-selected.netTonnesDaily,
  regionsMoved:selectedWeights.filter((w,i)=>Math.abs(w-glpkWeights[i])>0.0001).length,
  weightShiftPct:totalShift*50};
}
