import test from 'node:test';
import assert from 'node:assert/strict';
import {REGION_ORDER,REGIONS} from '../lib/regions.ts';
import {WEATHER_DASHBOARD_SNAPSHOT_KEY,validDashboardWeatherSnapshot,parseDashboardWeatherSnapshot,weatherAdjustedInputs,kpisForWeatherResult,type DashboardWeatherSnapshot} from '../lib/weatherDashboardSync.ts';
import {millionToCr} from '../lib/budgetUsd.ts';
import {calculateEngineKpis} from '../lib/engineKpis.ts';
import {readFileSync} from 'node:fs';

function fixture():DashboardWeatherSnapshot{
 const controls={sla_ms:80,carbon_tax:.6,budget_cr:millionToCr(45),dpdp_locked:false};
 const telemetry=REGION_ORDER.map((id,i)=>({region:REGIONS[id].code,carbon_ci:200+10*i,energy_price:100+i*2,latency_ms:30+i,dpdp_locked:false,egress_cost_gb:.05,renewable_pct:30,available:true}));
 const nodes=REGION_ORDER.map((id,i)=>({id,city:REGIONS[id].city,region:REGIONS[id].code,energy_price:100+i*2,carbon_ci:200+10*i,latency_ms:30+i,renewable_pct:30,unit_cost_usd_per_kwh:.2+i*.002,eligible:true,exclusion_reason:null}));
 const weights=Object.fromEntries(REGION_ORDER.map(id=>[id,.05])) as DashboardWeatherSnapshot['weights'];
 const kpis=calculateEngineKpis(REGION_ORDER.map(()=>.05),nodes.map(n=>({carbon:n.carbon_ci,latency:n.latency_ms,unitCost:n.unit_cost_usd_per_kwh,eligible:true})),controls,.4);
 return {version:1,engine:'geometry-curved',engineUsed:'geometry-curved',scenarioKey:'test',runAt:'2026-10-23T00:00:00Z',simulationTime:'2026-10-23T00:00:00Z',controls,telemetry,nodes,weights,baseline:{blendedCarbon:kpis.blendedCarbon,netTonnes:kpis.netTonnes,weightedLatency:kpis.weightedLatency,operatingUsdDaily:kpis.operatingUsdDaily,netApy:kpis.netApy},hedgeFraction:.4,allocationSource:'engine'};
}
test('snapshot validates real completed 20-region inputs and rejected placeholders',()=>{
 const x=fixture();assert.ok(validDashboardWeatherSnapshot(x));assert.deepEqual(parseDashboardWeatherSnapshot(JSON.stringify(x)),x);
 assert.equal(parseDashboardWeatherSnapshot(null),null);assert.equal(parseDashboardWeatherSnapshot('{'),null);
 assert.equal(validDashboardWeatherSnapshot({...x,weights:{...x.weights,mumbai:.4}}),false);
 assert.equal(validDashboardWeatherSnapshot({...x,nodes:x.nodes.slice(0,8)}),false);
 assert.ok(WEATHER_DASHBOARD_SNAPSHOT_KEY.includes('completed'));
});
test('identical conditions preserve all original weather baseline outcomes',()=>{
 const x=fixture();const input=weatherAdjustedInputs(x,{});
 const out=kpisForWeatherResult(x,REGION_ORDER.map(id=>x.weights[id]),input.nodes);
 for(const k of ['blendedCarbon','netTonnes','weightedLatency','operatingUsdDaily','netApy'] as const)
  assert.ok(Math.abs(out[k]-x.baseline[k])<1e-8,`${k} should match`);
 assert.deepEqual(input.telemetry,x.telemetry);
});
test('weather adjusts energy price only; preserves carbon, latency, eligibility and residency',()=>{
 const x=fixture();const id='mumbai',code=REGIONS[id].code;const adjusted=weatherAdjustedInputs(x,{[code]:1.1});
 assert.equal(adjusted.telemetry[0].energy_price,x.telemetry[0].energy_price*1.1);
 assert.equal(adjusted.nodes[0].unit_cost_usd_per_kwh,x.nodes[0].unit_cost_usd_per_kwh+x.nodes[0].energy_price*.1/1000);
 assert.equal(adjusted.nodes[0].carbon_ci,x.nodes[0].carbon_ci);assert.equal(adjusted.nodes[0].latency_ms,x.nodes[0].latency_ms);
 assert.equal(adjusted.nodes[0].eligible,x.nodes[0].eligible);
 assert.equal(x.telemetry[0].energy_price,100);
 const outputs=kpisForWeatherResult(x,REGION_ORDER.map(id=>x.weights[id]),adjusted.nodes);
 assert.ok(outputs.operatingUsdDaily>x.baseline.operatingUsdDaily);
});
test('weather-adjusted allocation changes KPIs but baseline stays the stored dashboard result',()=>{
 const x=fixture();const alloc=REGION_ORDER.map((_,i)=>i<10?.06:.04);
 const out=kpisForWeatherResult(x,alloc,weatherAdjustedInputs(x,{}).nodes);
 assert.notEqual(out.blendedCarbon,x.baseline.blendedCarbon);
 assert.equal(x.weights.mumbai,.05);
});
test('weather optimizer no longer generates a separate synthetic baseline or hardcodes controls',()=>{
 const ui=readFileSync(new URL('../components/WeatherOptimizer.tsx',import.meta.url),'utf8');
 const dashboard=readFileSync(new URL('../components/ControllerDashboard.tsx',import.meta.url),'utf8');
 assert.ok(ui.includes("fetch('/api/cooperative-allocation'"));
 assert.ok(ui.includes('snapshot.controls'));assert.ok(ui.includes('snapshot.engine'));
 assert.ok(ui.includes('REGION_ORDER.map(id=>snapshot.weights[id])'));
 assert.ok(!ui.includes("fetch('/api/quantum-lab-live'"));assert.ok(!ui.includes('sla:78,carbon:.5'));
 assert.ok(dashboard.includes('WEATHER_DASHBOARD_SNAPSHOT_KEY'));
 assert.ok(dashboard.includes('cooperativeActive'));
});
