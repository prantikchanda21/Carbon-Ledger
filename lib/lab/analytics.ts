import { REGION_ORDER } from '../regions.ts';
import type { RegionId } from '../types.ts';
import { HOUR, nodeAt, predictNode, schedule, rng } from './engine.ts';
import type { LabInput, Schedule, Snapshot } from './types.ts';
export interface ForecastScore { at: string; predicted: number; actual: number; low: number; high: number }
function percentile(xs: number[], q: number): number { const sorted=[...xs].sort((a,b)=>a-b); return sorted[Math.min(sorted.length-1,Math.floor(sorted.length*q))]??0; }
/** Walk-forward evaluation: the target and future values never enter its forecast or interval. */
export function scoreForecast(history: Snapshot[], region: RegionId) {
  const rows: ForecastScore[]=[]; const residuals:number[]=[];
  for(let i=24;i<history.length;i++) {
    const at=Date.parse(history[i].at), pred=predictNode(history,region,at,at), observed=nodeAt(history,region,at);
    if(!pred||!observed)continue;
    const radius=residuals.length>=12?percentile(residuals.slice(-168),0.9):null;
    if(radius!==null) rows.push({at:history[i].at,predicted:pred.carbon_ci,actual:observed.carbon_ci,low:Math.max(0,pred.carbon_ci-radius),high:pred.carbon_ci+radius});
    residuals.push(Math.abs(pred.carbon_ci-observed.carbon_ci));
  }
  return {rows,mae:rows.length?rows.reduce((s,r)=>s+Math.abs(r.predicted-r.actual),0)/rows.length:null,coverage:rows.length?rows.filter(r=>r.actual>=r.low&&r.actual<=r.high).length/rows.length:null,method:'Seasonal mean / rolling persistence; empirical 90% absolute-residual band'};
}
export function futureForecast(input:LabInput,region:RegionId) {
  const origin=Date.parse(input.start),training=input.history.filter(s=>Date.parse(s.at)<origin);
  const metrics=scoreForecast(training,region);
  const errors=metrics.rows.map(r=>Math.abs(r.predicted-r.actual));
  const radius=errors.length?percentile(errors.slice(-168),0.9):null;
  return Array.from({length:input.horizon},(_,hour)=>{
    const node=predictNode(training,region,origin+hour*HOUR,origin);
    return {hour,carbon:node?.carbon_ci??null,price:node?.energy_price??null,low:node&&radius!==null?Math.max(0,node.carbon_ci-radius):null,high:node&&radius!==null?node.carbon_ci+radius:null};
  });
}
export function realized(input:LabInput,plan:Schedule) {
  let usd=0, kg=0, violations=0, missing=0;
  const origin=Date.parse(input.start);
  for(const c of plan.choices) {
    const j=input.jobs.find(x=>x.id===c.job)!;
    let energy=0,carbon=0;
    for(let h=c.start;h<c.finish;h++) {
      const n=nodeAt(input.history,c.region,origin+h*HOUR);
      if(!n){missing++;continue;}
      if(n.available===false||n.latency_ms>Math.min(j.latency,input.controls.sla_ms))violations++;
      if(h>=c.finish-j.duration) {energy+=j.kwh/j.duration*n.energy_price/1000;carbon+=j.kwh/j.duration*n.carbon_ci/1000;}
    }
    // Revalue transfer energy using observed source/destination at transfer start.
    const from=nodeAt(input.history,j.current,origin+c.start*HOUR),to=nodeAt(input.history,c.region,origin+c.start*HOUR);
    const moved=j.current!==c.region;
    const transferKg=moved&&from&&to?c.migrationKwh*(from.carbon_ci+to.carbon_ci)/2000:0;
    const transferUsd=moved&&from&&to?j.dataGb*from.egress_cost_gb+c.migrationKwh*(from.energy_price+to.energy_price)/2000:0;
    kg+=carbon+transferKg; usd+=energy+transferUsd+c.downtimeUsd+(carbon+transferKg)*input.carbonPriceUsdT/1000;
  }
  return {usd,kg,violations,missing,unserved:plan.unscheduled.length};
}
export function backtest(input:LabInput) {
  const rows=[];let cumulativeUsd=0,cumulativeKg=0;
  const first=Date.parse(input.history[0].at)+48*HOUR,last=Date.parse(input.history.at(-1)!.at)+HOUR;
  for(let at=first;at+input.horizon*HOUR<=last;at+=input.horizon*HOUR) {
    const sample={...input,start:new Date(at).toISOString()};
    const baseline=realized(sample,schedule(sample,'baseline')),optimized=realized(sample,schedule(sample,'optimized'));
    const comparable=baseline.unserved===0&&optimized.unserved===0&&baseline.missing===0&&optimized.missing===0;
    const savingsUsd=comparable?baseline.usd-optimized.usd:null,avoidedKg=comparable?baseline.kg-optimized.kg:null;
    if(comparable){cumulativeUsd+=savingsUsd!;cumulativeKg+=avoidedKg!;}
    rows.push({at:sample.start,baseline,optimized,comparable,savingsUsd,avoidedKg,cumulativeUsd,cumulativeKg});
  }
  return rows;
}
export interface StressInput { carbonShockPct:number;energyShockPct:number;cashUsd:number;cashRequiredUsd:number;hedgePct:number;premiumPct:number;volatilityPct:number;runs:number }
export function stressTest(base:Schedule,carbonPrice:number,input:StressInput,seed:number) {
  const random=rng(seed),outcomes=[];
  const carbonBase=base.carbonKg*carbonPrice/1000,energyBase=base.choices.reduce((s,c)=>s+c.energyUsd+c.transferUsd,0),other=base.choices.reduce((s,c)=>s+c.downtimeUsd,0);
  for(let i=0;i<input.runs;i++) {
    const common=(random()-0.5)*2*input.volatilityPct/100;
    const carbonFactor=Math.max(0,1+input.carbonShockPct/100+common);
    const energyFactor=Math.max(0,1+input.energyShockPct/100+0.6*common+(random()-0.5)*input.volatilityPct/100);
    const hedgePayout=carbonBase*input.hedgePct/100*(carbonFactor-1); // symmetric fixed-price hedge
    const premium=carbonBase*input.hedgePct/100*input.premiumPct/100;
    const cost=carbonBase*carbonFactor+energyBase*energyFactor+other-hedgePayout+premium;
    outcomes.push({cost,cashRemaining:input.cashUsd-cost,shortfall:Math.max(0,input.cashRequiredUsd-(input.cashUsd-cost))});
  }
  const costs=outcomes.map(o=>o.cost),p95=percentile(costs,0.95),tail=costs.filter(c=>c>=p95);
  return {mean:costs.reduce((s,c)=>s+c,0)/costs.length,p05:percentile(costs,0.05),p95,tailMean:tail.reduce((s,c)=>s+c,0)/tail.length,shortfallProbability:outcomes.filter(o=>o.shortfall>0).length/outcomes.length,worstShortfall:Math.max(...outcomes.map(o=>o.shortfall)),outcomes};
}
export function historyCsv(history:Snapshot[]):string {
  return 'timestamp,region,carbon_ci,energy_price,latency_ms,egress_cost_gb,available,source\n'+history.flatMap(s=>s.telemetry.map(n=>[s.at,n.region,n.carbon_ci,n.energy_price,n.latency_ms,n.egress_cost_gb,n.available!==false,n.source??'mock'].join(','))).join('\n');
}
export function parseHistoryCsv(raw:string):Snapshot[] {
  const lines=raw.trim().split(/\r?\n/);const header=lines.shift()?.split(',');
  if(header?.join(',')!=='timestamp,region,carbon_ci,energy_price,latency_ms,egress_cost_gb,available,source')throw new Error('CSV header does not match the downloadable template');
  const map=new Map<string,Snapshot>();
  for(const line of lines) {
    const cells=line.split(',');if(cells.length!==8)throw new Error('Each CSV row needs 8 columns');
    const [at,region,ci,price,latency,egress,available,source]=cells;
    if(!['true','false'].includes(available)||!['mock','electricity-maps','stale'].includes(source))throw new Error('Invalid availability or source');
    if([ci,price,latency,egress].some(v=>!v.trim()))throw new Error('Missing numeric CSV value');
    const row=map.get(at)??{at,telemetry:[]};row.telemetry.push({region,carbon_ci:Number(ci),energy_price:Number(price),latency_ms:Number(latency),egress_cost_gb:Number(egress),available:available==='true',source:source as 'mock'|'electricity-maps'|'stale',dpdp_locked:false,timestamp:Date.parse(at)});map.set(at,row);
  }
  return [...map.values()];
}
export { REGION_ORDER };
