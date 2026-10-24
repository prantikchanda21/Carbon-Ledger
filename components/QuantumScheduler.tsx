'use client';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import DashboardSidebar from './DashboardSidebar';
import {REGION_ORDER,REGIONS} from '@/lib/regions';
import type {WeatherResponse} from '@/lib/weather/insights';
import {HOURLY_SCHEDULER_SLOTS,schedulingHour,mapHourlyWithConcurrency} from '@/lib/schedulerHours';
import {useDashboardBudget} from '@/lib/useDashboardBudget';

type Engine='glpk'|'oracle'|'geometry-curved'|'geometry-grover'|'geometry';
type Job={id:string;name:string;duration:number;earliest:number;deadline:number;demand:number;residency:'any'|'india'|'europe'|'americas'|'asia'};
type EngineResult={engineRequested:string;engineUsed?:string;regions:{id:string;eligible:boolean;carbon:number;price:number;latency:number}[];researchProposal?:{weights:number[];feasible:boolean};outcome:{weights:number[]};timing?:{serverComputeMs:number};runAt?:string};
type Plan={id:string;name:string;region:string;start:number;end:number;demand:number;carbon:number;cost:number;latency:number;score:number;weight:number;temp:number|null};
type Schedule={jobs:Plan[];unscheduled:{id:string;name:string;reason:string}[];runtimeMs:number;forecastAt:string;completedAt:string;engine:string};
const starter:Job[]=[
{id:'job-1',name:'Analytics batch',duration:3,earliest:0,deadline:16,demand:24,residency:'any'},
{id:'job-2',name:'India compliance ETL',duration:2,earliest:1,deadline:12,demand:18,residency:'india'},
{id:'job-3',name:'Model training',duration:5,earliest:0,deadline:24,demand:28,residency:'any'},
{id:'job-4',name:'European audit',duration:3,earliest:4,deadline:19,demand:16,residency:'europe'},
];
const engineNames:Record<Engine,string>={glpk:'GLPK',oracle:'Quantum Oracle · 7q', 'geometry-curved':'Curvilinear Fusion · 10q','geometry-grover':'Adaptive Grover · 10q',geometry:'Geometry-Aware Walk · 10q'};
const regions=REGION_ORDER;
const clamp=(n:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,n));
const num=(x:number,d=2)=>Number.isFinite(x)?x.toFixed(d):'—';
function residencyOK(job:Job,id:string){if(job.residency==='any')return true;if(job.residency==='india')return ['mumbai','hyderabad','delhi'].includes(id);if(job.residency==='europe')return REGIONS[id as keyof typeof REGIONS].macro==='europe';if(job.residency==='asia')return REGIONS[id as keyof typeof REGIONS].macro==='asia';return ['virginia','oregon','iowa','toronto','sao_paulo'].includes(id);}
function scheduleJobs(jobs:Job[],weather:WeatherResponse,solves:Record<number,EngineResult>,carbonWeight:number,engine:string):Schedule{
 const occupied=new Map<string,number>(); const output:Plan[]=[];const unscheduled:Schedule['unscheduled']=[];
 // EDF and largest-demand-first for deterministic, reproducible time/region assignment.
 const sorted=[...jobs].sort((a,b)=>a.deadline-b.deadline||b.demand-a.demand||a.id.localeCompare(b.id));
 for(const job of sorted){let best:Plan|null=null;
  for(let h=job.earliest;h+job.duration<=Math.min(24,job.deadline);h++){
   const slotRuns=Array.from({length:job.duration},(_,k)=>solves[schedulingHour(h+k)]);
   if(slotRuns.some(run=>!run))continue;
   for(let i=0;i<regions.length;i++){const id=regions[i];if(!residencyOK(job,id))continue;
    const hourlyRegions=slotRuns.map(run=>run.regions.find(n=>n.id===id));
    if(hourlyRegions.some(r=>!r?.eligible))continue;
    // Placement preferences are sampled for EVERY hour of the job, not just its start.
    const weights=slotRuns.map(run=>{
     const allocation=run.researchProposal?.feasible?run.researchProposal.weights:run.outcome.weights;
     return clamp(Number(allocation[i]??0),0,1);
    });
    const w=weights.reduce((sum,x)=>sum+x,0)/weights.length;
    if(w<0.00001)continue;
    // Modeled region capacity: 100 demand units per hour.
    let room=true;for(let t=h;t<h+job.duration;t++){if((occupied.get(`${id}:${t}`)||0)+job.demand>100){room=false;break;}}if(!room)continue;
    const wr=weather.regions.find(x=>x.id===id);
    const hours=Array.from({length:job.duration},(_,k)=>wr?.hours[h+k]);
    if(hours.some(x=>!x||!Number.isFinite(x.temperatureC)))continue;
    const temps=hours.map(x=>x!.temperatureC!);
    const meanTemp=temps.reduce((a,b)=>a+b,0)/temps.length;
    // API already includes weather-adjusted regional prices. Do not apply cooling twice.
    const hourlyCosts=slotRuns.map((_,k)=>hourlyRegions[k]!.price);
    const price=hourlyCosts.reduce((a,b)=>a+b,0)/hourlyCosts.length;
    const carbonPerHour=hourlyRegions.reduce((a,b)=>a+b!.carbon,0)/hourlyRegions.length;
    const latency=hourlyRegions.reduce((a,b)=>a+b!.latency,0)/hourlyRegions.length;
    const cost=job.demand*job.duration*price/100;
    const carbon=job.demand*job.duration*carbonPerHour/1000;
    const score=(carbonWeight*(carbon/Math.max(.1,job.demand*job.duration))+(1-carbonWeight)*(cost/Math.max(.1,job.demand*job.duration)))*10+latency/1000+(.12*(1-w));
    if(!best||score<best.score-1e-9||(Math.abs(score-best.score)<1e-9&&(h<best.start||h===best.start&&id<best.region)))best={id:job.id,name:job.name,region:id,start:h,end:h+job.duration,demand:job.demand,carbon,cost,latency,score,weight:w,temp:meanTemp};
   }
  }
  if(!best)unscheduled.push({id:job.id,name:job.name,reason:'No feasible engine-selected region/time window under deadline, residency, forecast, and modeled capacity constraints'});
  else {output.push(best);for(let t=best.start;t<best.end;t++)occupied.set(`${best.region}:${t}`,(occupied.get(`${best.region}:${t}`)||0)+job.demand);}
 }
 return {jobs:output,unscheduled,runtimeMs:Object.values(solves).reduce((s,r)=>s+(r.timing?.serverComputeMs||0),0),forecastAt:weather.retrievedAt,completedAt:new Date().toISOString(),engine};
}
export default function QuantumScheduler(){
 const {budgetMillion,setBudgetMillion}=useDashboardBudget();
 const [engine,setEngine]=useState<Engine>('glpk');const [jobs,setJobs]=useState<Job[]>(starter);const [carbonWeight,setCarbonWeight]=useState(.5);
 const [plan,setPlan]=useState<Schedule|null>(null);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [hoursCompleted,setHoursCompleted]=useState(0);
 const abort=useRef<AbortController|null>(null);const runSequence=useRef(0);
 const [revision,setRevision]=useState(0);
 const update=useCallback((id:string,patch:Partial<Job>)=>{setJobs(old=>old.map(j=>j.id===id?{...j,...patch}:j));},[]);
 useEffect(()=>{const controller=new AbortController();const sequence=++runSequence.current;abort.current?.abort();abort.current=controller;
  const timer=setTimeout(async()=>{setBusy(true);setError('');setHoursCompleted(0);try{
   // Do not display old schedules as current when inputs change.
   const weatherRes=await fetch('/api/weather',{signal:controller.signal,cache:'no-store'});const wx=await weatherRes.json();
   if(!weatherRes.ok||wx.regions?.length!==20||wx.regions.some((r:{hours?:unknown[]})=>!r.hours||r.hours.length<24))throw new Error(wx.error||'Complete 20-region hourly Open-Meteo forecast unavailable');
   const weatherData=wx as WeatherResponse;
   // Limit parallelism because each request can launch four CPU statevector workers.
   const outputs=await mapHourlyWithConcurrency(HOURLY_SCHEDULER_SLOTS,3,async(slot)=>{
    if(controller.signal.aborted)throw new DOMException('Cancelled','AbortError');
    const factors:Record<string,number>=Object.fromEntries(weatherData.regions.map(r=>[r.code,typeof r.hours[slot]?.temperatureC==='number'?clamp(1+.006*(r.hours[slot].temperatureC!-20),.88,1.12):1]));
    const response=await fetch('/api/quantum-lab-live',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({engine,sla:78,carbon:carbonWeight,budget:budgetMillion,hour:slot,applyWeather:true,weatherFactors:factors}),signal:controller.signal,cache:'no-store'});
    const json=await response.json();
    if(!response.ok||!Array.isArray(json.regions)||!Array.isArray(json.outcome?.weights)||json.outcome.weights.length!==20)throw new Error(json.error||`Engine execution failed at +${slot}h`);
    if(!controller.signal.aborted&&sequence===runSequence.current)setHoursCompleted(v=>v+1);
    return json as EngineResult;
   });
   if(controller.signal.aborted||sequence!==runSequence.current)return;
   setPlan(scheduleJobs(jobs,weatherData,outputs,carbonWeight,engineNames[engine]));
  }catch(e){if(!controller.signal.aborted&&sequence===runSequence.current){setError(e instanceof Error?e.message:String(e));setPlan(null);}}
  finally{if(!controller.signal.aborted&&sequence===runSequence.current)setBusy(false);}
 },650);return()=>{clearTimeout(timer);controller.abort();};
 },[engine,jobs,carbonWeight,budgetMillion,revision ]);
 const totals=useMemo(()=>({carbon:plan?.jobs.reduce((s,j)=>s+j.carbon,0)||0,cost:plan?.jobs.reduce((s,j)=>s+j.cost,0)||0,count:plan?.jobs.length||0}),[plan]);
 return <main className="carbon-workspace scheduler-workspace mx-auto max-w-[1600px] space-y-3 p-3 text-slate-100 sm:p-5"><DashboardSidebar/>
 <header className="atlas-card p-4"><p className="text-xs uppercase tracking-widest text-cyan-300">Forecast-guided execution planning</p><div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold">Quantum Scheduler</h1><p className="mt-1 max-w-3xl text-xs text-slate-400">Plan workload locations and start times using Open-Meteo forecasts and the selected quantum/classical allocation engine. Research simulation only; no cloud jobs are executed.</p></div><span className="text-xs text-slate-400" aria-live="polite">{busy?`Optimizing hourly schedule · ${hoursCompleted}/24 snapshots`:error?'Calculation failed':plan?'Latest calculation completed':'Waiting for data'}</span></div></header>
 <section className="atlas-card grid gap-3 p-4 md:grid-cols-4"><label className="text-xs">Placement engine<select className="lab-input mt-1 w-full" value={engine} onChange={e=>setEngine(e.target.value as Engine)}>{Object.entries(engineNames).map(([id,label])=><option value={id} key={id}>{label}</option>)}</select></label><label className="text-xs">Carbon priority · {Math.round(carbonWeight*100)}%<input type="range" min="0" max="1" step="0.05" value={carbonWeight} onChange={e=>setCarbonWeight(Number(e.target.value))} className="mt-3 w-full accent-cyan-400"/></label><label className="text-xs">Enterprise treasury capital · ${budgetMillion.toFixed(0)}M/year<input aria-label="Shared enterprise treasury budget" type="range" min="5" max="100" step="1" value={budgetMillion} onChange={e=>setBudgetMillion(Number(e.target.value))} className="mt-3 w-full accent-cyan-400"/><span className="text-[11px] text-slate-400">Synced with Overview · modeling assumption, not a cloud spending cap</span></label><div className="flex items-end"><button type="button" className="lab-button w-full" onClick={()=>setRevision(r=>r+1)} disabled={busy}>Refresh forecast & schedule</button></div></section>
 <section className="atlas-card p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-semibold">Workload queue</h2><p className="text-xs text-slate-400">Edit jobs to recalculate automatically. Deadline and start are hours from the forecast start (0–24).</p></div><button className="lab-button" type="button" onClick={()=>{const id=`job-${Date.now()}`;setJobs(p=>[...p,{id,name:`Workload ${p.length+1}`,duration:2,earliest:0,deadline:20,demand:12,residency:'any'}]);}}>+ Add job</button></div>
 <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[870px] text-left text-xs"><thead><tr className="text-slate-400"><th className="p-2">Workload</th><th>Duration (h)</th><th>Earliest (+h)</th><th>Deadline (+h)</th><th>Demand (units/h)</th><th>Residency</th><th>Action</th></tr></thead><tbody>{jobs.map(j=><tr key={j.id} className="border-t border-white/10"><td className="p-2"><input aria-label={`${j.id} workload name`} className="lab-input w-40" value={j.name} maxLength={55} onChange={e=>update(j.id,{name:e.target.value})}/></td>{(['duration','earliest','deadline','demand'] as const).map(field=><td key={field} className="pr-2"><input aria-label={`${j.name} ${field}`} className="lab-input w-20" type="number" min={field==='earliest'?0:1} max={field==='demand'?100:24} value={j[field]} onChange={e=>update(j.id,{[field]:clamp(Number(e.target.value)||0,field==='earliest'?0:1,field==='demand'?100:24)} as Partial<Job>)}/></td>)}<td><select className="lab-input" aria-label={`${j.name} residency`} value={j.residency} onChange={e=>update(j.id,{residency:e.target.value as Job['residency']})}>{['any','india','asia','europe','americas'].map(x=><option key={x} value={x}>{x}</option>)}</select></td><td><button type="button" className="text-rose-300 disabled:opacity-40" disabled={jobs.length===1} onClick={()=>setJobs(v=>v.filter(x=>x.id!==j.id))}>Remove</button></td></tr>)}</tbody></table></div></section>
 {error&&<div role="alert" className="rounded-lg border border-rose-400/40 bg-rose-400/10 p-3 text-sm text-rose-100">{error}. No schedule is presented as successful. <button onClick={()=>setRevision(r=>r+1)} className="ml-2 underline">Retry</button></div>}
 {plan&&<><section className="grid grid-cols-2 gap-2 md:grid-cols-4">{[['Jobs scheduled',`${totals.count}/${jobs.length}`],['Modeled carbon',`${num(totals.carbon)} index units`],['Modeled energy costs',`${num(totals.cost)} relative units`],['24-hour solver compute',`${num(plan.runtimeMs,1)} ms`]].map(([name,value])=><div className="atlas-card p-3" key={name}><p className="text-xs text-slate-400">{name}</p><p className="mt-1 text-lg font-semibold">{value}</p></div>)}</section>
 <section className="atlas-card p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">24-hour execution timeline</h2><span className="text-xs text-slate-400">Hover bars to inspect placement · UTC offsets from forecast start</span></div><div className="mt-3 overflow-x-auto"><div className="min-w-[700px]"><div className="ml-40 grid grid-cols-5 text-xs text-slate-500"><span>+0h</span><span>+6h</span><span>+12h</span><span>+18h</span><span>+24h</span></div>{plan.jobs.map((j,i)=><div className="mt-2 flex items-center gap-2" key={j.id}><span className="w-36 shrink-0 truncate text-xs" title={j.name}>{j.name}</span><div className="relative h-9 flex-1 rounded-md bg-white/5"><div className="absolute top-1 h-7 overflow-hidden rounded-md border border-cyan-300/30 bg-cyan-500/30 px-2 text-xs leading-7 text-white" style={{left:`${j.start/24*100}%`,width:`${Math.max(2,(j.end-j.start)/24*100)}%`}} title={`${REGIONS[j.region as keyof typeof REGIONS].city} · +${j.start}–${j.end}h · demand ${j.demand}`}><span className="whitespace-nowrap">{REGIONS[j.region as keyof typeof REGIONS].city}</span></div></div></div>)}</div></div></section>
 <section className="atlas-card p-4"><h2 className="font-semibold">Scheduled workload decisions</h2><div className="mt-3 overflow-x-auto"><table className="min-w-[740px] w-full text-xs"><thead className="text-left text-slate-400"><tr><th className="p-2">Job</th><th>Region</th><th>Window</th><th>Temperature</th><th>Candidate allocation weight</th><th>Modeled carbon</th><th>Modeled cost</th><th>Latency</th></tr></thead><tbody>{plan.jobs.map(j=><tr key={j.id} className="border-t border-white/10"><td className="p-2">{j.name}</td><td>{REGIONS[j.region as keyof typeof REGIONS].city}</td><td>+{j.start}h → +{j.end}h</td><td>{j.temp===null?'—':`${num(j.temp,1)}°C`}</td><td>{num(j.weight*100,1)}%</td><td>{num(j.carbon)}</td><td>{num(j.cost)}</td><td>{num(j.latency,1)}ms</td></tr>)}</tbody></table></div>{plan.unscheduled.length>0&&<div className="mt-3 rounded-lg border border-amber-400/30 p-3 text-sm"><strong>{plan.unscheduled.length} unscheduled:</strong>{plan.unscheduled.map(j=><p key={j.id} className="mt-1 text-xs">{j.name} — {j.reason}</p>)}</div>}</section>
 <p className="px-1 text-xs text-slate-400">Data: Open-Meteo hourly forecasts retrieved {new Date(plan.forecastAt).toLocaleString()}; {plan.engine} run on modeled regional telemetry at every forecast hour (+0 through +23). The engine selects regional candidates for each hour; a deterministic, classical deadline/capacity-aware scheduler assigns individual jobs to hours. Its annual treasury budget matches Overview. Weather-to-cooling adjustment is illustrative (not calibrated PUE). Carbon/cost figures are comparative modeled index units, not audited emissions or invoices. Region capacity uses an illustrative 100 demand units/hour. No real cloud workloads are deployed. Last scheduled: {new Date(plan.completedAt).toLocaleString()}.</p></>}
 {!plan&&!error&&<div className="atlas-card p-6 text-sm text-slate-300">{busy?'Fetching forecast and running allocation engine…':'Schedule will appear after successful calculation.'}</div>}
 </main>;
}
