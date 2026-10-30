'use client';
import {useState} from 'react';
import {forecast24h} from '@/lib/forecast';
import {REGIONS} from '@/lib/regions';
import {buildQuantumRequest,submitQuantum} from '@/lib/quantumClient';
import {cooperativeDispatch} from '@/lib/cooperativeHybrid';
import {solveClassicalDispatch} from '@/lib/classicalWasmSolver';
import {weightCap} from '@/lib/controllerMath';
import type {ControlState,GridNodeTelemetry,OptimizationResult,RegionId} from '@/lib/types';

type Horizon = {hour:number;region:RegionId;hybrid:number;classical:number;carbonHybrid:number;carbonClassical:number;weights:number[];baselineWeights:number[];backend:string;trace:string[]};
type Outcome = {time:string;source:string;horizons:Horizon[]};
/** Forecast-driven optimization: the forecasting step remains classical; QAOA commits a
 * forecast-informed region and GLPK fills capacity-constrained residual assignments. */
export default function ForecastHybridPanel({telemetry,controls,result}:{telemetry:GridNodeTelemetry[];controls:ControlState;result:OptimizationResult|null}){
 const [running,setRunning]=useState(false),[error,setError]=useState(''),[out,setOut]=useState<Outcome|null>(null);
 const [period,setPeriod]=useState(24);
 async function run(){setRunning(true);setError('');setOut(null);try{
  if(!result)throw Error('Run the main controller before forecast-aware optimization.');
  const nodes=result.nodes,ids=nodes.map(n=>n.id),eligible=nodes.map(n=>n.eligible);
  if(ids.length!==20)throw Error('Forecast hybrid requires the 20-region controller result.');
  const cap=weightCap(eligible.filter(Boolean).length);
  const forecasts=forecast24h(new Date(),ids);
  const points=[0,Math.floor(period/2),period-1];
  const horizons:Horizon[]=[];
  for(const hour of points){
   const carbon=ids.map(id=>forecasts.find(f=>f.region===id)!.points[hour]!.mean);
   const price=ids.map(id=>forecasts.find(f=>f.region===id)!.points[hour]!.price);
   // Current unit price adjusted using the modeled forward price ratio, with carbon
   // price exposure derived from the forecast carbon intensity delta.
   const costs=nodes.map((node,i)=>{
    const current=node.energy_price;
    const ratio=current>0?Math.max(.5,Math.min(2,price[i]!/current)):1;
    return Math.max(0,node.unit_cost_usd_per_kwh*ratio+(carbon[i]!-node.carbon_ci)*controls.carbon_tax/1_000_000);
   });
   const request=buildQuantumRequest(telemetry,controls,'simulator');
   request.regions.forEach(r=>{const i=ids.indexOf(r.id);r.eligible=i>=0&&eligible[i]!;if(i>=0){r.carbon_ci=carbon[i]!;r.energy_price=price[i]!;}});
   const q=await submitQuantum(request);
   if(q.status!=='completed'&&q.status!=='done')throw Error(q.error||'Quantum forecast optimization failed.');
   const selected=Object.entries(q.weights??{}).filter(([id])=>{const i=ids.indexOf(id as RegionId);return i>=0&&eligible[i];}).sort((a,b)=>b[1]!-a[1]!)[0]?.[0];
   const index=ids.findIndex(id=>id===selected);
   if(index<0)throw Error('Quantum forecast run returned no eligible region.');
   const h=await cooperativeDispatch({ids,eligible,costs,cap},index,solveClassicalDispatch,Math.min(.2,cap*.5));
   const weighted=(weights:number[])=>weights.reduce((sum,w,i)=>sum+w*carbon[i]!,0);
   horizons.push({hour,region:ids[index]!,hybrid:h.hybridCost,classical:h.classicalCost,carbonHybrid:weighted(h.weights),carbonClassical:weighted(h.classicalWeights),weights:h.weights,baselineWeights:h.classicalWeights,backend:q.backend,trace:h.trace.map(t=>t.description)});
  }
  const completed={time:new Date().toISOString(),source:'Modeled regional carbon/price forward curves; not measured future grid data',horizons};
  setOut(completed);try {localStorage.setItem('carbon-ledger-forecast-report',JSON.stringify(completed));}catch {}
 }catch(e){setError(e instanceof Error?e.message:String(e));}finally{setRunning(false);}}
 function exportJson(){if(!out)return;const url=URL.createObjectURL(new Blob([JSON.stringify({kind:'forecast-cooperative-hybrid',...out},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='carbon-ledger-forecast-hybrid.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 return <section className="space-y-3 text-sm text-slate-200"><p className="text-xs text-slate-400">Forecast-aware cooperative allocation: modeled forward carbon and energy-price curves feed each horizon&apos;s quantum region choice; GLPK fills the feasible residual allocation. Forecasting itself remains classical. These runs do not automatically update your live controller or constitute production predictions.</p><div className="flex flex-wrap items-center gap-3"><label className="text-xs text-slate-300">Horizon <select aria-label="Forecast horizon" className="lab-input ml-2" value={period} onChange={e=>{setPeriod(Number(e.target.value));setOut(null);}}><option value={6}>6 hours</option><option value={12}>12 hours</option><option value={24}>24 hours</option></select></label><button className="lab-button lab-primary" disabled={running||!result} onClick={()=>void run()}>{running?'Running three cooperative scenarios…':'Run forecast-aware QAOA + GLPK'}</button>{out&&<button className="lab-button" onClick={exportJson}>Export horizon results JSON</button>}</div>{error&&<p role="alert" className="text-rose-300">{error}</p>}{out&&<><p className="text-xs text-cyan-200">{out.source}. Three independent horizon solves; {out.time}.</p><div className="overflow-x-auto"><table className="lab-table w-full"><thead><tr><th>Future hour</th><th>QAOA region</th><th>Hybrid unit cost</th><th>GLPK unit cost</th><th>Hybrid gCO₂/kWh</th><th>GLPK gCO₂/kWh</th></tr></thead><tbody>{out.horizons.map(h=><tr key={h.hour}><td>+{h.hour}h</td><td>{REGIONS[h.region].city}</td><td>{h.hybrid.toFixed(5)}</td><td>{h.classical.toFixed(5)}</td><td>{h.carbonHybrid.toFixed(1)}</td><td>{h.carbonClassical.toFixed(1)}</td></tr>)}</tbody></table></div><details className="rounded-lg border border-white/10 p-3"><summary className="cursor-pointer text-xs">Quantum/classical contribution trace</summary>{out.horizons.map(h=><div key={h.hour} className="mt-3 text-xs"><strong>+{h.hour}h · {h.backend}</strong>{h.trace.map((s,i)=><p key={i} className="mt-1 text-slate-400">{i+1}. {s}</p>)}</div>)}</details></>}</section>;
}
