/** Completed controller output transferred to Weather Optimizer. Never synthesize a second baseline. */
import type {ControlState, GridNodeTelemetry, NodeReport, RegionId} from './types.ts';
import type {EngineMode} from './quantumEngineModes.ts';
import {validEngineMode} from './quantumEngineModes.ts';
import {REGION_ORDER,REGIONS} from './regions.ts';
import {calculateEngineKpis,type EngineKpis} from './engineKpis.ts';

export const WEATHER_DASHBOARD_SNAPSHOT_KEY='carbon-dashboard-completed-weather-v157';
export const WEATHER_DASHBOARD_SNAPSHOT_EVENT='carbon-dashboard-completed-weather';
export type WeatherMetric = Pick<EngineKpis,'blendedCarbon'|'netTonnes'|'weightedLatency'|'operatingUsdDaily'|'netApy'>;
export type DashboardWeatherSnapshot={
 version:1;engine:EngineMode;engineUsed:string;scenarioKey:string;runAt:string;simulationTime:string;
 controls:ControlState;telemetry:GridNodeTelemetry[];nodes:NodeReport[];
 weights:Record<RegionId,number>;baseline:WeatherMetric;hedgeFraction:number;
 allocationSource:'engine'|'manual';
};
const finite=(x:unknown):x is number=>typeof x==='number'&&Number.isFinite(x);
export function validDashboardWeatherSnapshot(x:unknown):x is DashboardWeatherSnapshot{
 if(!x||typeof x!=='object')return false;
 const d=x as Partial<DashboardWeatherSnapshot>;
 if(d.version!==1||!validEngineMode(d.engine)||typeof d.scenarioKey!=='string'||typeof d.runAt!=='string'||typeof d.simulationTime!=='string'||!(Number.isFinite(Date.parse(d.simulationTime)))||!d.controls||!d.baseline||!d.weights)return false;
 if(!finite(d.controls.sla_ms)||!finite(d.controls.carbon_tax)||!finite(d.controls.budget_cr)||typeof d.controls.dpdp_locked!=='boolean'||!finite(d.hedgeFraction))return false;
 if(!Array.isArray(d.telemetry)||d.telemetry.length!==20||!Array.isArray(d.nodes)||d.nodes.length!==20)return false;
 if(!REGION_ORDER.every(id=>finite(d.weights?.[id])&&d.weights![id]>=0)||Math.abs(REGION_ORDER.reduce((s,id)=>s+d.weights![id],0)-1)>1e-5)return false;
 if(!['blendedCarbon','netTonnes','weightedLatency','operatingUsdDaily','netApy'].every(key=>finite(d.baseline?.[key as keyof WeatherMetric])))return false;
 if(!REGION_ORDER.every(id=>d.nodes!.some(n=>n.id===id)))return false;
 if(!REGION_ORDER.every(id=>d.telemetry!.some(t=>t.region===REGIONS[id].code)))return false;
 return true;
}
export function parseDashboardWeatherSnapshot(raw:string|null):DashboardWeatherSnapshot|null{
 if(!raw)return null;try{const x:unknown=JSON.parse(raw);return validDashboardWeatherSnapshot(x)?x:null;}catch{return null;}
}
/** Isolate a price-only weather sensitivity: never turn Open-Meteo into invented grid carbon readings. */
export function weatherAdjustedInputs(snapshot:DashboardWeatherSnapshot,factors:Record<string,number>){
 const factor=(code:string)=>Math.max(.88,Math.min(1.12,finite(factors[code])?factors[code]:1));
 const telemetry=snapshot.telemetry.map(t=>({...t,energy_price:t.energy_price*factor(t.region)}));
 const priceByCode=new Map(telemetry.map(t=>[t.region,t.energy_price]));
 const nodes=snapshot.nodes.map(n=>{
  const price=priceByCode.get(n.region)??n.energy_price;
  // The unit cost comprises electricity, carbon, and egress; change only electricity.
  const nextUnitCost=n.unit_cost_usd_per_kwh+(price-n.energy_price)/1000;
  return {...n,energy_price:price,unit_cost_usd_per_kwh:nextUnitCost};
 });
 return {telemetry,nodes};
}
export function kpisForWeatherResult(snapshot:DashboardWeatherSnapshot,weights:number[],weatherNodes:NodeReport[]):WeatherMetric{
 const indexed=new Map(weatherNodes.map(n=>[n.id,n]));
 const baselineRegions=REGION_ORDER.map(id=>{
  const n=snapshot.nodes.find(row=>row.id===id)!;
  return {carbon:n.carbon_ci,latency:n.latency_ms,unitCost:n.unit_cost_usd_per_kwh,eligible:n.eligible};
 });
 const newRegions=REGION_ORDER.map(id=>{
  const n=indexed.get(id)!;
  return {carbon:n.carbon_ci,latency:n.latency_ms,unitCost:n.unit_cost_usd_per_kwh,eligible:n.eligible};
 });
 const baselineWeights=REGION_ORDER.map(id=>snapshot.weights[id]);
 const oldModel=calculateEngineKpis(baselineWeights,baselineRegions,snapshot.controls,snapshot.hedgeFraction);
 const newModel=calculateEngineKpis(weights,newRegions,snapshot.controls,snapshot.hedgeFraction);
 if(!newModel.feasibleWeights)throw new Error('Weather-adjusted allocation violates regional eligibility');
 // Retain exact dashboard baseline, apply only modeled sensitivity changes.
 return {blendedCarbon:snapshot.baseline.blendedCarbon+newModel.blendedCarbon-oldModel.blendedCarbon,
 netTonnes:snapshot.baseline.netTonnes+newModel.netTonnes-oldModel.netTonnes,
 weightedLatency:snapshot.baseline.weightedLatency+newModel.weightedLatency-oldModel.weightedLatency,
 operatingUsdDaily:snapshot.baseline.operatingUsdDaily+newModel.operatingUsdDaily-oldModel.operatingUsdDaily,
 netApy:snapshot.baseline.netApy+newModel.netApy-oldModel.netApy};
}
