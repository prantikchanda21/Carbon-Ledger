import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {budgetLabel,crToUsd,usdToCr,DEFAULT_BUDGET_USD,MIN_BUDGET_USD,MAX_BUDGET_USD} from '../lib/budgetUsd.ts';
import {carbonAccounting,allocateTreasury} from '../lib/finance.ts';
import {dynamicAllocationScores} from '../lib/dynamicAllocation.ts';
import {calculateEngineKpis} from '../lib/engineKpis.ts';
import {fractionalAllocationPolicy} from '../lib/fractionalAllocation.ts';
import type {ControlState,NodeReport} from '../lib/types.ts';
const controls=(usd:number):ControlState=>({sla_ms:100,carbon_tax:.65,budget_cr:usdToCr(usd),dpdp_locked:false});
const nodes=Array.from({length:20},(_,i)=>({eligible:true,energy_price:40+i*7,carbon_ci:880-i*34,latency_ms:35+i*2,renewable_pct:25+i*2})) as NodeReport[];
const regions=nodes.map((n)=>({eligible:true,carbon:n.carbon_ci,latency:n.latency_ms,unitCost:n.energy_price/1000}));
const weights=Array(20).fill(1/20);
test('enterprise budget is expressed in USD with stable legacy conversion',()=>{
 assert.equal(DEFAULT_BUDGET_USD,30_000_000);
 assert.equal(MIN_BUDGET_USD,5_000_000);
 assert.equal(MAX_BUDGET_USD,100_000_000);
 for(const amount of [MIN_BUDGET_USD,DEFAULT_BUDGET_USD,MAX_BUDGET_USD])assert.ok(Math.abs(crToUsd(usdToCr(amount))-amount)<.01);
 assert.equal(budgetLabel(usdToCr(DEFAULT_BUDGET_USD)),'$30M');
});
test('all solvers receive a different cost-carbon tradeoff after USD budget changes',()=>{
 const low=dynamicAllocationScores(nodes,controls(MIN_BUDGET_USD));
 const mid=dynamicAllocationScores(nodes,controls(DEFAULT_BUDGET_USD));
 const high=dynamicAllocationScores(nodes,controls(MAX_BUDGET_USD));
 assert.ok(low.every(Number.isFinite) && high.every(Number.isFinite));
 assert.notDeepEqual(low,mid);
 assert.notDeepEqual(mid,high);
 assert.ok(Math.abs((low[0]-low[19])-(high[0]-high[19]))>.001);
});
test('treasury and carbon results recompute, offsets are budget limited',()=>{
 const low=calculateEngineKpis(weights,regions,controls(5_000_000),.4);
 const mid=calculateEngineKpis(weights,regions,controls(30_000_000),.4);
 const high=calculateEngineKpis(weights,regions,controls(100_000_000),.4);
 assert.ok(low.feasibleWeights&&mid.feasibleWeights&&high.feasibleWeights);
 assert.ok(low.offsetPercent<mid.offsetPercent && mid.offsetPercent<=high.offsetPercent);
 assert.ok(low.netTonnes>mid.netTonnes && mid.netTonnes>=high.netTonnes);
 assert.ok(low.annualTreasuryIncomeInr<mid.annualTreasuryIncomeInr && mid.annualTreasuryIncomeInr<high.annualTreasuryIncomeInr);
 assert.ok(low.annualOffsetSpendUsd<mid.annualOffsetSpendUsd && mid.annualOffsetSpendUsd<=high.annualOffsetSpendUsd);
 assert.notEqual(low.netApy,high.netApy);
});
test('USD allowance does not produce negative or more-than-gross offsets',()=>{
 for (const usd of [5_000_000,30_000_000,100_000_000]){
  const c=carbonAccounting({blendedCi:900,baselineCi:700,carbonFuturesPct:35,budgetCr:usdToCr(usd),carbonTax:.6});
  assert.ok(c.net_footprint_mt>=0 && c.net_footprint_mt<=c.gross_tco2_per_day);
  assert.ok(c.offset_pct>=0 && c.offset_pct<=100);
  assert.ok(c.offset_spend_usd_per_day*365<=usd*.015+.0001);
 }
});

test('modeled regional target allocations change with budget, not only labels',()=>{
 const lo=dynamicAllocationScores(nodes,controls(5_000_000));
 const hi=dynamicAllocationScores(nodes,controls(100_000_000));
 const pLo=fractionalAllocationPolicy(nodes,controls(5_000_000),lo);
 const pHi=fractionalAllocationPolicy(nodes,controls(100_000_000),hi);
 assert.ok(Math.abs(pLo.preferred.reduce((a,b)=>a+b,0)-1)<1e-9);
 assert.ok(Math.abs(pHi.preferred.reduce((a,b)=>a+b,0)-1)<1e-9);
 const redistribution=pLo.preferred.reduce((s,w,i)=>s+Math.abs(w-pHi.preferred[i]),0)/2;
 assert.ok(redistribution>0.0001,`No allocation changes: ${redistribution}`);
});
