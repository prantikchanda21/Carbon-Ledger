import {millionToCr} from '@/lib/budgetUsd';
import {NextResponse} from 'next/server';
import {generateTelemetry} from '@/lib/mockData';
import {REGION_ORDER,REGIONS} from '@/lib/regions';
import {assess} from '@/lib/controllerMath';
import {calculateEngineKpis} from '@/lib/engineKpis';
import {POST as executeAllocation} from '@/app/api/cooperative-allocation/route';
import type {ControlState,NodeReport} from '@/lib/types';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
const modes=['glpk','oracle','geometry-curved','geometry-grover','geometry'] as const;
const clamp=(x:number,min:number,max:number)=>Math.max(min,Math.min(max,x));
export async function POST(request:Request){
 try{
  const b=await request.json() as Record<string,unknown>;
  const engine=typeof b.engine==='string'?b.engine:'glpk';
  if(!modes.some(x=>x===engine))return NextResponse.json({error:'Invalid engine'},{status:400});
  const n=(key:string,def:number,min:number,max:number)=>typeof b[key]==='number'&&Number.isFinite(b[key])?clamp(b[key] as number,min,max):def;
  const controls:ControlState={sla_ms:n('sla',78,20,180),carbon_tax:n('carbon',.5,0,1),budget_cr:millionToCr(n('budget',30,5,100)),dpdp_locked:b.residency===true};
  const hour=n('hour',12,0,23);
  const now=new Date(Date.UTC(2026,0,15,hour));
  // Explicitly synthetic, reproducible data: never marketed as a live grid feed.
  const telemetry=generateTelemetry(now,controls.dpdp_locked,true);
  const carbonMultiplier=n('carbonMultiplier',1,.5,2);
  const priceMultiplier=n('priceMultiplier',1,.5,2);
  const affectedRegion=typeof b.affectedRegion==='string'&&REGION_ORDER.some(id=>id===b.affectedRegion)?b.affectedRegion:'';
  const regionShock=n('regionShock',1,.5,3);
  const regionalMode=b.regionalMode==='outage'?'outage':b.regionalMode==='carbon'?'carbon':b.regionalMode==='price'?'price':'none';
  // Weather forecast adjustments are scenario assumptions, not measured grid emissions.
  const weatherFactors = (b.weatherFactors && typeof b.weatherFactors==='object' && !Array.isArray(b.weatherFactors)) ? b.weatherFactors as Record<string,unknown> : {};
  const applyWeather = b.applyWeather===true;
  for(const r of telemetry){
   r.carbon_ci=Number((r.carbon_ci*carbonMultiplier).toFixed(2));
   const regionalFactor = applyWeather && typeof weatherFactors[r.region]==='number' && Number.isFinite(weatherFactors[r.region]) ? clamp(weatherFactors[r.region] as number,.88,1.12) : 1;
   r.energy_price=Number((r.energy_price*priceMultiplier*regionalFactor).toFixed(2));
   if(affectedRegion && REGIONS[affectedRegion as keyof typeof REGIONS].code===r.region){
    if(regionalMode==='outage')r.available=false;
    if(regionalMode==='carbon')r.carbon_ci=Number((r.carbon_ci*regionShock).toFixed(2));
    if(regionalMode==='price')r.energy_price=Number((r.energy_price*regionShock).toFixed(2));
   }
  }
  const assessed=assess({telemetry,...controls,treasury_yield:7});
  const nodes:NodeReport[]=assessed.nodes.map(r=>({id:r.id,city:r.telemetry.region,region:r.telemetry.region,energy_price:r.telemetry.energy_price,carbon_ci:r.telemetry.carbon_ci,latency_ms:r.telemetry.latency_ms,renewable_pct:r.telemetry.renewable_pct??0,unit_cost_usd_per_kwh:r.unit_cost.total,weight:0,eligible:r.eligible,exclusion_reason:r.exclusion_reason,source:'mock'}));
  const innerRequest=new Request('http://localhost/api/cooperative-allocation',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({telemetry,controls,nodes,engine,researchDiagnostics:true})});
  const response=await executeAllocation(innerRequest);
  const data=await response.json();
  if(!response.ok)return NextResponse.json(data,{status:response.status});
  const regionKpis=nodes.map(x=>({carbon:x.carbon_ci,latency:x.latency_ms,unitCost:x.unit_cost_usd_per_kwh,eligible:x.eligible}));
  // Reuse the controller treasury hedge policy rather than invent per-engine APY.
  const hedgeFraction=0.4; // Explicit common comparison policy; gross APY should not differ by engine.
  const approvedKpis=calculateEngineKpis(data.outcome.weights,regionKpis,controls,hedgeFraction);
  const proposalKpis=data.researchProposal?calculateEngineKpis(data.researchProposal.weights,regionKpis,controls,hedgeFraction):approvedKpis;
  return NextResponse.json({...data,kpis:{proposal:proposalKpis,approved:approvedKpis,treasuryPolicy:'Common illustrative hedge fraction 40%; gross APY is engine-independent. Net treasury yield uses the modeled treasury policy; cloud operating costs are reported separately.'},input:{controls,hour,carbonMultiplier,priceMultiplier,affectedRegion,regionalMode,regionShock},regions:nodes.map(x=>({id:x.id,eligible:x.eligible,carbon:x.carbon_ci,price:x.energy_price,latency:x.latency_ms})),source:applyWeather?'Open-Meteo-driven modeled cooling-cost scenario over synthetic regional carbon baseline; not live grid carbon or IBM hardware':'Deterministic modeled regional carbon and cost telemetry; on-demand server-side solver, not IBM hardware',runAt:new Date().toISOString()},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Lab execution failed'},{status:500});}
}
