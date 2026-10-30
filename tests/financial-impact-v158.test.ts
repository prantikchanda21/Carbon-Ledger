import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {compareFinancialImpact,rebaseFinancialMetric,validateFinancialWeights} from '../lib/financialImpact.ts';
import {REGION_ORDER,REGIONS} from '../lib/regions.ts';
import {millionToCr} from '../lib/budgetUsd.ts';
import type {DashboardWeatherSnapshot} from '../lib/weatherDashboardSync.ts';
const ids=REGION_ORDER;
function makeSnapshot():DashboardWeatherSnapshot{
 const nodes=ids.map((id,i)=>({id,city:REGIONS[id].city,region:REGIONS[id].code,energy_price:50+i,carbon_ci:200+i*15,
  latency_ms:30+i,renewable_pct:30,unit_cost_usd_per_kwh:.10+i*.005,weight:.05,eligible:true,exclusion_reason:null}));
 const telemetry=ids.map((id,i)=>({region:REGIONS[id].code,carbon_ci:nodes[i].carbon_ci,energy_price:50+i,latency_ms:30+i,dpdp_locked:false,egress_cost_gb:0.1,available:true}));
 return {version:1,engine:'oracle',engineUsed:'oracle',scenarioKey:'test',runAt:new Date().toISOString(),simulationTime:new Date().toISOString(),controls:{sla_ms:80,carbon_tax:.4,budget_cr:millionToCr(30),dpdp_locked:false},telemetry,nodes,weights:Object.fromEntries(ids.map(id=>[id,.05])) as DashboardWeatherSnapshot['weights'],baseline:{blendedCarbon:342.5,netTonnes:55,weightedLatency:42,operatingUsdDaily:25000,netApy:6.1},hedgeFraction:.5,allocationSource:'engine'};
}
test('identical allocations have no cloud or offset savings, no artificial quantum win',()=>{
 const s=makeSnapshot();const c=compareFinancialImpact(s,s.weights);
 assert.ok(Math.abs(c.dailyCloudSavingsUsd)<1e-7);
 assert.ok(Math.abs(c.annualTotalSavingsUsd)<1e-6);
 assert.equal(c.weightShiftPct,0);
 assert.equal(c.regionsMoved,0);
 assert.ok(Math.abs(c.selected.netApyPct-c.glpk.netApyPct)<1e-8);
});
test('cash and APY remain distinct from cloud cost',()=>{
 const s=makeSnapshot();const other={...s.weights,[ids[0]]:.10,[ids[1]]:0};
 const c=compareFinancialImpact(s,other);
 assert.ok(c.dailyCloudSavingsUsd<0); // GLPK scenario has more traffic in cheaper region
 assert.ok(c.annualCloudSavingsUsd<0);
 assert.ok(Math.abs(c.annualTotalSavingsUsd-c.annualCloudSavingsUsd-c.annualOffsetSavingsUsd)<1e-6);
 assert.ok(Math.abs(c.annualCombinedDifferenceUsd-(c.selected.annualCombinedUsd-c.glpk.annualCombinedUsd))<1e-6);
 assert.ok(c.selected.grossApyPct>0 && c.selected.annualCombinedUsd<0); // business loss is not negative APY
 assert.ok(c.selected.netApyPct>0);
 assert.equal(c.regionsMoved,2);
 assert.ok(Math.abs(c.weightShiftPct-5)<1e-7);
});
test('rejects infeasible reference, missing region, and ineligible selected nodes',()=>{
 const s=makeSnapshot();
 assert.throws(()=>compareFinancialImpact(s,{...s.weights,[ids[0]]:NaN}));
 assert.throws(()=>compareFinancialImpact(s,{...s.weights,[ids[0]]:.07}));
 const s2=makeSnapshot();s2.nodes[0].eligible=false;
 assert.throws(()=>compareFinancialImpact(s2,s2.weights));
 assert.throws(()=>validateFinancialWeights([1],[]));
});
test('side-by-side comparison uses shared treasury capital and consistent exchange rate',()=>{
 const s=makeSnapshot();const c=compareFinancialImpact(s,s.weights);
 assert.ok(Math.abs(c.treasuryCapitalUsd-30000000)<.01);
 assert.ok(Math.abs(c.selected.annualCloudUsd-c.selected.operatingDailyUsd*365)<1e-6);
 assert.ok(Math.abs(c.selected.annualOperatingAndOffsetUsd-c.selected.annualCloudUsd-c.selected.annualOffsetUsd)<1e-6);
});

test('completed GLPK reference compared to itself has zero savings across all reported metrics',()=>{
 const s=makeSnapshot();s.engine='glpk';s.engineUsed='glpk';
 // Different valid end-of-pipeline GLPK allocation (e.g. after scheduler).
 s.weights[ids[0]]=.08;s.weights[ids[1]]=.02;
 const c=compareFinancialImpact(s,{...s.weights});
 assert.equal(c.annualTotalSavingsUsd,0);
 assert.equal(c.weightShiftPct,0);
 assert.equal(c.regionsMoved,0);
 assert.deepEqual(c.selected,c.glpk);
});


test('engine-only snapshot preserves genuine differences even when final policy outputs converge',()=>{
 const s=makeSnapshot();
 const rawSelected={...s.weights,[ids[0]]:.08,[ids[1]]:.02};
 const rawGlpk={...s.weights,[ids[0]]:.02,[ids[1]]:.08};
 // Simulate scheduler/risk convergence: both final outputs are equal.
 assert.equal(compareFinancialImpact(s,s.weights).regionsMoved,0);
 const engineSnapshot={...s,weights:rawSelected,baseline:{...s.baseline,...rebaseFinancialMetric(s,rawSelected)}};
 const comparison=compareFinancialImpact(engineSnapshot,rawGlpk);
 assert.equal(comparison.regionsMoved,2);
 assert.ok(comparison.weightShiftPct>0);
 assert.notEqual(comparison.selected.operatingDailyUsd,comparison.glpk.operatingDailyUsd);
});
