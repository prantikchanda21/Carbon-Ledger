'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import Link from 'next/link';
import DashboardSidebar from './DashboardSidebar';
import {REGION_ORDER,REGIONS} from '@/lib/regions';
import type {WeatherResponse} from '@/lib/weather/insights';
import {budgetMillion} from '@/lib/budgetUsd';
import {WEATHER_DASHBOARD_SNAPSHOT_KEY,WEATHER_DASHBOARD_SNAPSHOT_EVENT,parseDashboardWeatherSnapshot,weatherAdjustedInputs,kpisForWeatherResult,type DashboardWeatherSnapshot,type WeatherMetric} from '@/lib/weatherDashboardSync';
type AdjustedRun={weights:number[];kpis:WeatherMetric;timing:{serverComputeMs:number};engineUsed:string};
const fmt=(n:number|undefined,d=2)=>Number.isFinite(n)?n!.toFixed(d):'—';
export default function WeatherOptimizer(){
 const [weather,setWeather]=useState<WeatherResponse|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 const [hour,setHour]=useState(0),[strength,setStrength]=useState(1),[region,setRegion]=useState<string>('mumbai');
 const [snapshot,setSnapshot]=useState<DashboardWeatherSnapshot|null>(null);
 const [requestedEngine,setRequestedEngine]=useState<string|null>(null);
 const [adjusted,setAdjusted]=useState<AdjustedRun|null>(null),[running,setRunning]=useState(false),[runError,setRunError]=useState('');
 useEffect(()=>{
  const read=()=>{
   try{setSnapshot(parseDashboardWeatherSnapshot(localStorage.getItem(WEATHER_DASHBOARD_SNAPSHOT_KEY)));setRequestedEngine(localStorage.getItem('carbon-engine-mode-v86'));}
   catch{setSnapshot(null);}
  };
  read();const storage=(e:StorageEvent)=>{if(e.key===WEATHER_DASHBOARD_SNAPSHOT_KEY||e.key==='carbon-engine-mode-v86')read();};
  const updated=()=>read();window.addEventListener('storage',storage);window.addEventListener(WEATHER_DASHBOARD_SNAPSHOT_EVENT,updated);
  return()=>{window.removeEventListener('storage',storage);window.removeEventListener(WEATHER_DASHBOARD_SNAPSHOT_EVENT,updated);};
 },[]);

 const ref=useRef<AbortController|null>(null);
 useEffect(()=>{const ac=new AbortController();fetch('/api/weather',{signal:ac.signal,cache:'no-store'}).then(async r=>{const j=await r.json();if(!r.ok||j.regions?.length!==20)throw Error(j.error||'Forecast unavailable');setWeather(j);}).catch(e=>{if(!ac.signal.aborted)setError(String(e));}).finally(()=>{if(!ac.signal.aborted)setLoading(false);});return()=>ac.abort();},[]);
 const factors=useMemo(()=>{const entries:Record<string,number>={};if(!weather)return entries;for(const r of weather.regions){const temp=r.hours[hour]?.temperatureC;if(typeof temp==='number')entries[r.code]=Math.max(.88,Math.min(1.12,1+(temp-20)*.006*strength));}return entries;},[weather,hour,strength]);
 useEffect(()=>{
  if(!weather||!snapshot){setAdjusted(null);return;}
  const controller=new AbortController();ref.current?.abort();ref.current=controller;
  setAdjusted(null);
  const timer=setTimeout(async()=>{
   setRunning(true);setRunError('');
   try{
    const inputs=weatherAdjustedInputs(snapshot,factors);
    const response=await fetch('/api/cooperative-allocation',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...inputs,controls:snapshot.controls,engine:snapshot.engine}),cache:'no-store',signal:controller.signal});
    const data=await response.json();
    if(!response.ok)throw Error(data.error||'Weather-adjusted optimization failed');
    const rawWeights=data.outcome?.weights as number[]|undefined;
    if(!data.outcome?.feasible||!Array.isArray(rawWeights)||rawWeights.length!==REGION_ORDER.length||Math.abs(rawWeights.reduce((s,w)=>s+w,0)-1)>1e-5)throw Error('Invalid weather-adjusted allocation');
    const byRegion=new Map(inputs.nodes.map((node,i)=>[node.id,rawWeights[i]]));
    const weights=REGION_ORDER.map(id=>byRegion.get(id)??0);
    const kpis=kpisForWeatherResult(snapshot,weights,inputs.nodes);
    if(!controller.signal.aborted)setAdjusted({weights,kpis,timing:data.timing??{serverComputeMs:0},engineUsed:data.engineUsed});
   }catch(e){if(!controller.signal.aborted)setRunError(e instanceof Error?e.message:String(e));}
   finally{if(!controller.signal.aborted)setRunning(false);}
  },400);
  return()=>{clearTimeout(timer);controller.abort();};
 },[weather,snapshot,hour,strength,factors]);
 const before=snapshot?REGION_ORDER.map(id=>snapshot.weights[id]):[];
 const after=adjusted?.weights??[];
 const deltas=REGION_ORDER.map((id,i)=>({id,delta:(after[i]??0)-(before[i]??0),base:before[i]??0,next:after[i]??0})).sort((a,b)=>Math.abs(b.delta)-Math.abs(a.delta));
 const staleEngine=Boolean(snapshot&&requestedEngine&&requestedEngine!==snapshot.engine);
 const selected=weather?.regions.find(r=>r.id===region);
 const pairs:[string,keyof WeatherMetric,string][]=[['Carbon intensity','blendedCarbon','gCO₂/kWh'],['Footprint','netTonnes','t/day'],['Latency','weightedLatency','ms'],['Operating cost','operatingUsdDaily','USD/day'],['Net treasury yield','netApy','%']];
 return <main className="carbon-workspace weather-workspace mx-auto max-w-[1600px] space-y-3 p-3 text-slate-100 sm:p-5"><DashboardSidebar/>
 <header className="atlas-card p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-widest text-cyan-300">Forecast-informed optimization</p><h1 className="mt-1 text-2xl font-bold">Weather × Quantum</h1><p className="mt-1 text-xs text-slate-400">Open-Meteo forecasts change modeled cooling costs across 20 regions. Baseline allocations and controls are copied from the latest completed main-dashboard engine result.</p></div><Link href="/dashboard" className="lab-button">Overview →</Link></div></header>
 <div className="atlas-card grid gap-3 p-4 sm:grid-cols-4"><div className="text-xs"><p className="font-semibold">Dashboard engine (synchronized)</p><p className="mt-2 text-cyan-200">{snapshot?.engine ?? 'Awaiting completed dashboard allocation'}</p><p className="mt-1 text-slate-400">SLA {snapshot?.controls.sla_ms ?? '—'} ms · carbon penalty {snapshot?.controls.carbon_tax.toFixed(2) ?? '—'} · India-only {snapshot?.controls.dpdp_locked ? 'ON' : 'OFF'}</p></div><label className="text-xs">Forecast offset · +{hour} hours<input type="range" min="0" max="23" value={hour} onChange={e=>setHour(Number(e.target.value))} className="mt-3 w-full accent-cyan-400"/></label><label className="text-xs">Cooling sensitivity · {strength.toFixed(1)}×<input type="range" min="0" max="2" step="0.1" value={strength} onChange={e=>setStrength(Number(e.target.value))} className="mt-3 w-full accent-cyan-400"/></label><div className="text-xs text-slate-300"><p className="font-semibold">{loading?'Loading forecast…':running?'Updating weather-adjusted allocation…':runError?'Weather comparison failed':snapshot?'Dashboard baseline synchronized':'Dashboard baseline not available'}</p><p className="mt-2 text-slate-400">{weather?`Open-Meteo · ${weather.regions.length} regions · ${snapshot?`$${budgetMillion(snapshot.controls.budget_cr).toFixed(0)}M treasury`:'No completed dashboard run'} · retrieved ${new Date(weather.retrievedAt).toLocaleString()}`:'Live weather pending'}</p></div></div>
 {!snapshot&&<div className="atlas-card p-4 text-sm text-amber-200">A completed dashboard result is required. <Link href="/dashboard" className="font-semibold underline">Open the main dashboard</Link>, wait for your selected engine to finish, then return here. Weather Optimizer will never invent a separate baseline.</div>}
 {staleEngine&&<div role="status" className="atlas-card p-3 text-xs text-amber-200">The engine selection has changed since the saved dashboard result. Open Overview and allow the new engine to complete before comparing.</div>}
 {snapshot?.allocationSource==='manual'&&<div role="note" className="atlas-card p-3 text-xs text-amber-200">The dashboard baseline contains a manual allocation override. The weather-adjusted result is a new engine optimization without the manual override; the difference therefore includes both effects.</div>}
 {snapshot&&<div className="px-2 text-xs text-emerald-200">Baseline: latest completed {snapshot.engineUsed} allocation at {new Date(snapshot.runAt).toLocaleString()} · {snapshot.allocationSource==='manual'?'includes manual allocation edits':'engine-generated'} · dashboard simulation {new Date(snapshot.simulationTime).toLocaleString()}</div>}

 {(error||runError)&&<div role="alert" className="rounded-xl border border-amber-500/30 p-3 text-xs text-amber-200">{error||runError} · Unverified data are not displayed as live weather.</div>}
 {weather&&<><section className="atlas-card p-4"><div className="flex flex-wrap justify-between gap-2"><h2 className="font-semibold">Regional weather & modeled cooling signal</h2><label className="text-xs">Inspect region <select value={region} onChange={e=>setRegion(e.target.value)} className="lab-input ml-2">{REGION_ORDER.map(id=><option key={id} value={id}>{REGIONS[id].city}</option>)}</select></label></div><div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">{[['Temperature',selected?.hours[hour]?.temperatureC==null?'—':`${fmt(selected.hours[hour].temperatureC!)} °C`],['Wind',selected?.hours[hour]?.windKmh==null?'—':`${fmt(selected.hours[hour].windKmh!)} km/h`],['Solar',selected?.hours[hour]?.solarWm2==null?'—':`${fmt(selected.hours[hour].solarWm2!,0)} W/m²`],['Estimated cooling-cost factor',`${fmt(factors[selected?.code??'']??1,3)}×`]].map(([a,b])=><div key={a} className="rounded-lg border border-white/10 p-3"><p className="text-xs text-slate-400">{a}</p><p className="mt-1 text-lg font-semibold">{b}</p></div>)}</div></section>
 <section className="atlas-card p-4"><div className="flex items-center justify-between gap-2"><h2 className="font-semibold">Weather sensitivity: engine output</h2><span className="text-xs text-slate-400">{running?'Refreshing…':'Completed results only'}</span></div>{snapshot&&adjusted?<><div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-5">{pairs.map(([name,key,unit])=><div key={name} className="rounded-lg border border-white/10 p-3"><p className="text-xs text-slate-400">{name}</p><p className="mt-1 text-base font-semibold">{fmt(Number(adjusted.kpis[key]))} <span className="text-xs">{unit}</span></p><p className="text-xs text-cyan-300">Baseline {fmt(Number(snapshot.baseline[key]))}</p></div>)}</div><details className="mt-4" open><summary className="cursor-pointer text-sm font-semibold">All 20 regional allocation changes · ranked by absolute change (expand/collapse)</summary><div className="mt-3 max-h-[480px] overflow-auto rounded-lg border border-white/10"><table className="w-full min-w-[480px] text-left text-xs"><thead className="sticky top-0 bg-slate-900 text-slate-300"><tr><th className="p-3">Region</th><th className="p-3 text-right">Baseline</th><th className="p-3 text-right">Weather-adjusted</th><th className="p-3 text-right">Change</th></tr></thead><tbody>{deltas.map(r=><tr key={r.id} className="border-t border-white/10"><td className="p-3">{REGIONS[r.id as keyof typeof REGIONS].city}</td><td className="p-3 text-right">{fmt(r.base*100)}%</td><td className="p-3 text-right">{fmt(r.next*100)}%</td><td className={`p-3 text-right ${r.delta>=0?'text-emerald-300':'text-amber-300'}`}>{r.delta>=0?'+':''}{fmt(r.delta*100)} pp</td></tr>)}</tbody></table></div></details><p className="mt-3 text-xs text-slate-400">Solver compute: {fmt(adjusted.timing.serverComputeMs,1)} ms (network time excluded). If allocations match, the solver found the same placement under both scenarios.</p></>:<p className="mt-3 text-sm text-slate-400">Computing weather-adjusted allocation from the saved dashboard baseline; no substitute baseline is generated.</p>}</section></>}
 <p className="px-1 text-xs text-slate-400">Methodology: estimated energy-price multiplier = clamp(1 + 0.006 × (forecast temperature − 20 °C) × sensitivity, 0.88, 1.12). This is a sensitivity experiment, not a validated data-center PUE forecast. Weather does not directly provide electricity-grid carbon intensity, treasury investment returns or real cloud load. The baseline reuses the latest completed dashboard telemetry and allocation; weather changes only modeled energy-price inputs before rerunning the same selected engine. Quantum circuits execute in software, not IBM hardware. Weather: Open-Meteo, subject to provider attribution and terms.</p>
 </main>;
}
