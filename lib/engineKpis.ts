import { carbonAccounting, allocateTreasury, annualInterestInr } from './finance.ts';
import { FLEET_MWH_PER_DAY, INR_PER_CRORE, USD_INR } from './constants.ts';
import type { ControlState } from './types.ts';

export type EngineKpis = {blendedCarbon:number;grossTonnes:number;netTonnes:number;avoidedTonnes:number;offsetPercent:number;weightedLatency:number;maxLatency:number;operatingUsdDaily:number;grossApy:number;netApy:number;annualTreasuryIncomeInr:number;annualCloudSpendInr:number;annualNetInr:number;annualOffsetSpendUsd:number;feasibleWeights:boolean};
export type KpiRegion={carbon:number;latency:number;unitCost:number;eligible:boolean};
/** Identical finance/carbon policies for every solver; returns modeled scenario estimates, not live metering. */
export function calculateEngineKpis(weights:number[], regions:KpiRegion[], controls:ControlState, hedgeFraction:number, treasuryYield=7):EngineKpis {
 const total=weights.reduce((a,w)=>a+w,0);
 const feasibleWeights=weights.length===regions.length&&Math.abs(total-1)<1e-5&&weights.every((w,i)=>Number.isFinite(w)&&w>=-1e-9&&(w<=1e-9||regions[i]?.eligible));
 const blendedCarbon=weights.reduce((s,w,i)=>s+w*(regions[i]?.carbon??0),0);
 const unitCost=weights.reduce((s,w,i)=>s+w*(regions[i]?.unitCost??0),0);
 const weightedLatency=weights.reduce((s,w,i)=>s+w*(regions[i]?.latency??0),0);
 const maxLatency=Math.max(0,...regions.filter((_,i)=>(weights[i]??0)>0.005).map(r=>r.latency));
 const baselineCarbon=regions.reduce((s,r)=>s+r.carbon,0)/Math.max(1,regions.length);
 const treasury=allocateTreasury(hedgeFraction,controls.budget_cr,controls.carbon_tax,treasuryYield);
 const carbon=carbonAccounting({blendedCi:blendedCarbon,baselineCi:baselineCarbon,carbonFuturesPct:treasury.carbon_futures_pct,budgetCr:controls.budget_cr,carbonTax:controls.carbon_tax});
 const operatingUsdDaily=unitCost*FLEET_MWH_PER_DAY*1000;
 const annualCloudSpendInr=operatingUsdDaily*365*USD_INR;
 const annualTreasuryIncomeInr=annualInterestInr(controls.budget_cr,treasury.projected_apy);
 const annualOffsetSpendUsd=carbon.offset_spend_usd_per_day*365;
 const annualNetInr=annualTreasuryIncomeInr-annualCloudSpendInr-annualOffsetSpendUsd*USD_INR;
 const netApy=controls.budget_cr>0?(annualTreasuryIncomeInr-annualOffsetSpendUsd*USD_INR)/(controls.budget_cr*INR_PER_CRORE)*100:0;
 return {blendedCarbon,grossTonnes:carbon.gross_tco2_per_day,netTonnes:carbon.net_footprint_mt,avoidedTonnes:carbon.carbon_avoided_t,offsetPercent:carbon.offset_pct,weightedLatency,maxLatency,operatingUsdDaily,grossApy:treasury.projected_apy,netApy,annualTreasuryIncomeInr,annualCloudSpendInr,annualNetInr,annualOffsetSpendUsd,feasibleWeights};
}
