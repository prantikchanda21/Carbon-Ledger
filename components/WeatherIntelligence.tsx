'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CloudSun, RefreshCw } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { modelWeatherImpacts, type WeatherResponse } from '@/lib/weather/insights';
import type { GridNodeTelemetry } from '@/lib/types';
import { REGIONS, REGION_ORDER } from '@/lib/regions';
import type { RegionId } from '@/lib/types';

const fmt = (value: number | null, digits = 1) => value===null ? '—' : value.toFixed(digits);
export default function WeatherIntelligence({telemetry,selected,onSelect}: {telemetry:GridNodeTelemetry[];selected:RegionId|null;onSelect:(id:RegionId)=>void}) {
  const [data,setData] = useState<WeatherResponse|null>(null);
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState('');
  const [scenario,setScenario] = useState<'baseline'|'weather'>('weather');
  const refresh=useCallback(async()=>{
    setLoading(true);setError('');
    try { const res=await fetch('/api/weather',{cache:'no-store'});const json=await res.json();if(!res.ok || !Array.isArray(json.regions)||json.regions.length!==REGION_ORDER.length)throw new Error(json.error||'Incomplete weather response');setData(json as WeatherResponse); }
    catch(e){setError(e instanceof Error?e.message:'Forecast unavailable');}
    finally{setLoading(false);}
  },[]);
  useEffect(()=>{void refresh();},[refresh]);
  const analysis=useMemo(()=>modelWeatherImpacts(data?.regions??[],telemetry),[data,telemetry]);
  const regionId=selected??'mumbai';
  const region=data?.regions.find(r=>r.id===regionId);
  const insight=analysis.find(r=>r.id===regionId);
  const ranking=useMemo(()=>[...analysis].filter(r=>r.weatherCostIndex!==null).sort((a,b)=>(a.weatherCostIndex??Infinity)-(b.weatherCostIndex??Infinity)),[analysis]);
  const chart=region?.hours.map(h=>({time:h.time.slice(11,16),temperature:h.temperatureC,solar:h.solarWm2}))??[];
  return <section id="weather-intelligence" className="atlas-card p-4 space-y-4" aria-label="Open-Meteo regional weather intelligence">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="flex items-center gap-2 text-base font-semibold text-white"><CloudSun className="h-5 w-5 text-cyan-300"/> Weather intelligence · 20 regions</h2><p className="mt-1 text-xs text-slate-400">Real Open-Meteo forecasts · estimated cooling-price sensitivity · regional decision support</p></div><button type="button" disabled={loading} onClick={()=>void refresh()} className="flex items-center gap-1 rounded-lg border border-cyan-400/30 px-3 py-2 text-xs text-cyan-200 disabled:opacity-40"><RefreshCw className="h-3.5 w-3.5"/>{loading?'Fetching…':'Refresh forecast'}</button></div>
    <div className="flex flex-wrap items-center gap-3 text-xs"><label className="text-slate-300">Cloud region <select className="lab-input ml-2" value={regionId} onChange={e=>onSelect(e.target.value as RegionId)}>{REGION_ORDER.map(id=><option key={id} value={id}>{REGIONS[id].city}</option>)}</select></label><label className="text-slate-300">Compare <select className="lab-input ml-2" value={scenario} onChange={e=>setScenario(e.target.value as 'baseline'|'weather')}><option value="baseline">Baseline electricity price</option><option value="weather">Weather-adjusted scenario</option></select></label></div>
    {error&&<p role="alert" className="rounded-lg border border-amber-400/25 bg-amber-400/5 p-2 text-xs text-amber-200">Open-Meteo unavailable: {error}. No weather values have been fabricated. {data?'Showing last successful in-page response.':''}</p>}
    {!data&&!error&&<p className="text-sm text-slate-400">Loading live forecasts…</p>}
    {data&&<><div className="flex flex-wrap gap-2 text-[11px] text-slate-400"><span className="rounded-md bg-emerald-400/10 px-2 py-1 text-emerald-200">Source: Open-Meteo forecast</span><span>Retrieved {new Date(data.retrievedAt).toLocaleString()}</span><span>24-hour UTC forecast window</span></div>
      <div className="grid grid-cols-2 gap-2 2xl:grid-cols-4">{[
        ['Avg. temperature',`${fmt(insight?.temperatureC??null)} °C`],['Avg. solar radiation',`${fmt(insight?.solarAverage??null,0)} W/m²`],['Avg. wind',`${fmt(insight?.windAverage??null)} km/h`],['Estimated price factor',insight?.coolingMultiplier===null||insight?.coolingMultiplier===undefined?'—':`${((insight.coolingMultiplier-1)*100)>=0?'+':''}${fmt((insight.coolingMultiplier-1)*100)}%`],
      ].map(([label,value])=><div key={label} className="rounded-xl border border-white/10 bg-white/[.03] p-3"><p className="text-[11px] text-slate-400">{label}</p><p className="mt-2 text-lg font-semibold text-white">{value}</p></div>)}</div>
      <div className="grid gap-3 2xl:grid-cols-2"><div className="rounded-xl border border-white/10 p-3"><h3 className="text-xs font-semibold text-cyan-100">Temperature · next 24 hours (°C)</h3><div className="mt-2 h-48"><ResponsiveContainer width="100%" height="100%"><LineChart data={chart}><CartesianGrid stroke="#263443" vertical={false}/><XAxis dataKey="time" stroke="#94a3b8" tick={{fontSize:10}} interval={5}/><YAxis stroke="#94a3b8" tick={{fontSize:10}}/><Tooltip contentStyle={{background:'#0f172a',border:'1px solid #475569'}}/><Line type="monotone" dataKey="temperature" stroke="#34d399" dot={false} name="Temperature °C"/></LineChart></ResponsiveContainer></div></div>
      <div className="rounded-xl border border-white/10 p-3"><h3 className="text-xs font-semibold text-cyan-100">Solar radiation · next 24 hours (W/m²)</h3><div className="mt-2 h-48"><ResponsiveContainer width="100%" height="100%"><LineChart data={chart}><CartesianGrid stroke="#263443" vertical={false}/><XAxis dataKey="time" stroke="#94a3b8" tick={{fontSize:10}} interval={5}/><YAxis stroke="#94a3b8" tick={{fontSize:10}}/><Tooltip contentStyle={{background:'#0f172a',border:'1px solid #475569'}}/><Line type="monotone" dataKey="solar" stroke="#38bdf8" dot={false} name="Solar W/m²"/></LineChart></ResponsiveContainer></div></div></div>
      <div className="rounded-xl border border-white/10 p-3"><h3 className="text-xs font-semibold text-white">Weather-informed decision support</h3><p className="mt-2 text-xs leading-5 text-slate-300">{insight?.modeledPrice===null||insight?.modeledPrice===undefined?'Regional price unavailable.':`For ${insight.city}, baseline modeled energy price ${fmt(insight.basePrice,4)} becomes ${fmt(scenario==='weather'?insight.modeledPrice:insight.basePrice,4)} in the selected scenario. The modeled cooling influence is ${fmt(((insight.coolingMultiplier??1)-1)*100)}%.`}</p><p className="mt-2 text-xs text-slate-400">Illustrative sensitivity formula: energy-price factor = clamp(1 + 0.006 × (forecast mean temperature °C − 20), 0.88, 1.12). Not a validated PUE model; solar/wind are weather indicators, not measured renewable generation. Electricity carbon intensity is NOT inferred from weather. This panel is decision support, not an automatic adjustment of GLPK/QAOA inputs.</p></div>
      <div className="rounded-xl border border-white/10 p-3"><h3 className="text-xs font-semibold text-white">Lowest modeled weather + carbon indices <span className="font-normal text-slate-400">(not allocation recommendations)</span></h3><div className="mt-2 grid gap-2 lg:grid-cols-3">{ranking.slice(0,3).map((r,i)=><button type="button" key={r.id} onClick={()=>onSelect(r.id as RegionId)} className="rounded-lg border border-white/10 bg-white/[.03] p-3 text-left text-xs hover:border-cyan-400/30"><span className="text-emerald-300">#{i+1} {r.city}</span><span className="mt-1 block text-slate-400">Scenario index {fmt(r.weatherCostIndex,4)} · {fmt(r.temperatureC)} °C</span></button>)}</div><p className="mt-2 text-[11px] text-slate-500">Index = modeled energy price × (1 + existing carbon intensity / 1000). Does not assess residency, capacity, latency or total costs; defer final placements to the optimizer.</p></div>
      <p className="text-[10px] text-slate-500">Weather data: Open-Meteo (open-meteo.com), attribution under its applicable terms. Forecasts are not direct measurements of data-center energy or grid renewable production.</p>
    </>}
  </section>;
}
