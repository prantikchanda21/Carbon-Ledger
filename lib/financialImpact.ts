'use client';
import Link from 'next/link';
import {useCallback,useEffect,useMemo,useState} from 'react';
import {Download,RefreshCw,Scale,Wallet,AlertTriangle} from 'lucide-react';
import DashboardSidebar from '@/components/DashboardSidebar';
import {REGION_ORDER,REGIONS} from '@/lib/regions';
import {budgetLabel} from '@/lib/budgetUsd';
import {DASHBOARD_CONTROLS_STORAGE_KEY} from '@/lib/dashboardBudgetSync';
import {ENGINE_LABELS} from '@/lib/quantumEngineModes';
import {WEATHER_DASHBOARD_SNAPSHOT_KEY,WEATHER_DASHBOARD_SNAPSHOT_EVENT,parseDashboardWeatherSnapshot,type DashboardWeatherSnapshot} from '@/lib/weatherDashboardSync';
import {compareFinancialImpact,rebaseFinancialMetric,type FinancialComparison} from '@/lib/financialImpact';

const usd=(x:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(x);
const pct=(x:number)=>`${x.toFixed(2)}%`;
const normal=(x:number,d=2)=>x.toFixed(d);
function Stat({title,value,detail,positive}:{title:string;value:string;detail:string;positive?:boolean}){
 return <section className="rounded-xl border border-emerald-300/15 bg-emerald-950/40 px-4 py-4"><p className="text-xs text-emerald-100/70">{title}</p><p className={`mt-2 text-xl font-bold ${positive===true?'text-emerald-300':positive===false?'text-amber-200':'text-white'}`}>{value}</p><p className="mt-1 text-xs leading-5 text-slate-300">{detail}</p></section>;
}
export default function FinancialImpact(){
 const [snapshot,setSnapshot]=useState<DashboardWeatherSnapshot|null>(null);
 const [chosenEngine,setChosenEngine]=useState<string|null>(null);
 const [currentControls,setCurrentControls]=useState<string|null>(null);
 const [glpkWeights,setGlpkWeights]=useState<Record<string,number>|null>(null);
 const [pending,setPending]=useState(false),[error,setError]=useState('');
 const [updated,setUpdated]=useState(0);
 const [comparisonMode,setComparisonMode]=useState<'engine'|'final'>('engine');
 const read=useCallback(()=>{
  try{
   setSnapshot(parseDashboardWeatherSnapshot(localStorage.getItem(WEATHER_DASHBOARD_SNAPSHOT_KEY)));
   setChosenEngine(localStorage.getItem('carbon-engine-mode-v86'));
   setCurrentControls(localStorage.getItem(DASHBOARD_CONTROLS_STORAGE_KEY));
  }catch{setSnapshot(null);}
 },[]);
 useEffect(()=>{
  read();const onStorage=(event:StorageEvent)=>{if([WEATHER_DASHBOARD_SNAPSHOT_KEY,'carbon-engine-mode-v86',DASHBOARD_CONTROLS_STORAGE_KEY].includes(event.key??''))read();};
  window.addEventListener('storage',onStorage);window.addEventListener(WEATHER_DASHBOARD_SNAPSHOT_EVENT,read);
  return()=>{window.removeEventListener('storage',onStorage);window.removeEventListener(WEATHER_DASHBOARD_SNAPSHOT_EVENT,read);};
 },[read]);
 const wrongEngine=!!snapshot&&!!chosenEngine&&chosenEngine!==snapshot.engine;
 const staleControls=useMemo(()=>{if(!snapshot||!currentControls)return false;try{
  const c=JSON.parse(currentControls) as {sla_ms?:number;carbon_tax?:number;budget_cr?:number;dpdp_locked?:boolean};
  return c.sla_ms!==snapshot.controls.sla_ms||Math.abs((c.carbon_tax??0)-snapshot.controls.carbon_tax)>1e-6||
    Math.abs((c.budget_cr??0)-snapshot.controls.budget_cr)>1e-6||c.dpdp_locked!==snapshot.controls.dpdp_locked;
 }catch{return false;}},[snapshot,currentControls]);
 const active=!!snapshot&&!wrongEngine&&!staleControls;
 useEffect(()=>{
  if(!active||!snapshot){setGlpkWeights(null);setPending(false);return;}
  // Consume the fully policy-matched GLPK reference from the completed dashboard.
  // Never compare post-scheduler/risk allocations to an unprocessed fresh GLPK solve.
  if(snapshot.rawSelectedWeights && snapshot.rawGlpkWeights && comparisonMode==='engine'){setGlpkWeights(snapshot.glpkReferenceWeights??null);setPending(false);setError('');return;}
  if(snapshot.glpkReferenceWeights){setGlpkWeights({...snapshot.glpkReferenceWeights});setPending(false);setError('');return;}
  if(snapshot.engine==='glpk' && snapshot.allocationSource==='engine'){
   setGlpkWeights({...snapshot.weights});setPending(false);setError('');return;
  }
  // Legacy snapshots have no comparable reference: require a new dashboard run.
  setGlpkWeights(null);setPending(false);setError('Return to Overview and complete a new optimization to generate a policy-matched GLPK reference.');return;

 },[snapshot,active,updated,comparisonMode]);
 const rawPairAvailable=!!snapshot?.rawSelectedWeights&&!!snapshot.rawGlpkWeights&&snapshot.allocationSource==='engine';
 const modeUsed=rawPairAvailable&&comparisonMode==='engine'?'engine':'final';
 const view=useMemo(()=>{
  if(!snapshot||!active)return {value:null as FinancialComparison|null,error:''};
  try{
   if(modeUsed==='engine'&&snapshot.rawSelectedWeights&&snapshot.rawGlpkWeights){
    // Engine-only comparison: both allocations use the same frozen telemetry and financial model.
    // These are not the post-scheduler/risk dashboard totals.
    return {value:compareFinancialImpact({...snapshot,weights:snapshot.rawSelectedWeights,baseline:{
      ...snapshot.baseline,
      // Re-anchor the dashboard baseline from final to raw selected weights using the identical KPI model.
      ...rebaseFinancialMetric(snapshot,snapshot.rawSelectedWeights)
    }},snapshot.rawGlpkWeights),error:''};
   }
   if(!glpkWeights)return {value:null,error:''};
   return {value:compareFinancialImpact(snapshot,glpkWeights),error:''};
  }catch(e){return {value:null,error:e instanceof Error?e.message:String(e)};}
 },[snapshot,glpkWeights,active,modeUsed]);
 // Make the current matched-input financial comparison available to the detailed report exporter.
 useEffect(()=>{
  if(!snapshot||!active||!view.value)return;
  const c=view.value;
  try{localStorage.setItem('carbon-ledger-financial-impact-report-v159',JSON.stringify({
   capturedAt:new Date().toISOString(),runAt:snapshot.runAt,engine:snapshot.engine,comparisonMode:modeUsed,
   selected:{operatingDailyUsd:c.selected.operatingDailyUsd,annualCloudUsd:c.selected.annualCloudUsd,annualOffsetUsd:c.selected.annualOffsetUsd,annualOperatingAndOffsetUsd:c.selected.annualOperatingAndOffsetUsd,grossApyPct:c.selected.grossApyPct,netApyPct:c.selected.netApyPct,carbonIntensity:c.selected.carbonIntensity,latencyMs:c.selected.latencyMs},
   glpk:{operatingDailyUsd:c.glpk.operatingDailyUsd,annualCloudUsd:c.glpk.annualCloudUsd,annualOffsetUsd:c.glpk.annualOffsetUsd,annualOperatingAndOffsetUsd:c.glpk.annualOperatingAndOffsetUsd,grossApyPct:c.glpk.grossApyPct,netApyPct:c.glpk.netApyPct,carbonIntensity:c.glpk.carbonIntensity,latencyMs:c.glpk.latencyMs},
   annualTotalSavingsUsd:c.annualTotalSavingsUsd,weightShiftPct:c.weightShiftPct,regionsMoved:c.regionsMoved
  }));}catch{/* The page still works when localStorage is blocked. */}
 },[snapshot,active,view.value,modeUsed]);
 const downloadCsv=()=>{
  if(!snapshot||!view.value)return;
  const c=view.value;
  const rows=[['metric','selected','glpk'],
   ['operating_daily_usd',c.selected.operatingDailyUsd,c.glpk.operatingDailyUsd],
   ['annual_cloud_usd',c.selected.annualCloudUsd,c.glpk.annualCloudUsd],
   ['annual_offset_usd',c.selected.annualOffsetUsd,c.glpk.annualOffsetUsd],
   ['annual_combined_usd',c.selected.annualCombinedUsd,c.glpk.annualCombinedUsd],
   ['gross_apy_pct',c.selected.grossApyPct,c.glpk.grossApyPct],
   ['after_offset_apy_pct',c.selected.netApyPct,c.glpk.netApyPct],
   ['carbon_g_per_kwh',c.selected.carbonIntensity,c.glpk.carbonIntensity],
   ['net_tonnes_per_day',c.selected.netTonnesDaily,c.glpk.netTonnesDaily],
   ['latency_ms',c.selected.latencyMs,c.glpk.latencyMs],
   ...REGION_ORDER.map((id,i):[string,number,number]=>[`allocation_${id}_pct`,c.selected.weights[i]*100,c.glpk.weights[i]*100])];
  const csv=rows.map(r=>r.join(',')).join('\n');const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='carbon-ledger-financial-impact-comparison.csv';a.click();URL.revokeObjectURL(url);
 };
 return <main className="carbon-workspace financial-emerald-page mx-auto max-w-[1700px] space-y-4 p-3 text-slate-100 sm:p-5"><DashboardSidebar/><div className="min-w-0 space-y-4">
  <header className="mb-6 flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.2em] text-emerald-300">Carbon Ledger · business impact</p><h1 className="mt-2 text-3xl font-extrabold tracking-tight text-white">Financial Impact</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-emerald-100/70">Does the selected optimization engine save an enterprise money compared with GLPK on the <strong>same completed dashboard scenario</strong>?</p></div><div className="flex gap-2"><button type="button" className="lab-button inline-flex items-center gap-2" onClick={()=>{read();setUpdated(v=>v+1);}}><RefreshCw className="h-4 w-4"/>Refresh</button><button type="button" disabled={!view.value} className="lab-button inline-flex items-center gap-2 disabled:opacity-40" onClick={downloadCsv}><Download className="h-4 w-4"/>Export CSV</button></div></header>
  {!snapshot&&<section className="lab-card"><p className="font-semibold text-amber-200">No completed dashboard allocation available</p><p className="mt-2 text-sm text-slate-300">Open <Link href="/dashboard" className="text-emerald-300 underline">Overview</Link>, select an engine, and allow it to finish calculating. Financial Impact never substitutes fake or historical GLPK results.</p></section>}
  {snapshot&&<><div className="mb-5 flex flex-wrap gap-3 text-xs text-emerald-100/80"><span className="rounded-lg border border-white/10 px-3 py-2">Engine: <b>{ENGINE_LABELS[snapshot.engine]}</b></span><span className="rounded-lg border border-white/10 px-3 py-2">Treasury: <b>{budgetLabel(snapshot.controls.budget_cr)}</b></span><span className="rounded-lg border border-white/10 px-3 py-2">20 regions · {snapshot.allocationSource==='manual'?'Manual override':'Engine allocation'}</span><span className="rounded-lg border border-white/10 px-3 py-2">Snapshot: {new Date(snapshot.runAt).toLocaleString()}</span></div>
  {(wrongEngine||staleControls)&&<section className="lab-card mb-5 border-amber-400/30"><p className="text-sm text-amber-200"><AlertTriangle className="mr-2 inline h-4 w-4"/>Dashboard settings changed after the saved allocation. Return to <Link href="/dashboard" className="underline">Overview</Link>, let the engine complete, then refresh this page. A stale result is never compared as if current.</p></section>}
  {active&&pending&&<p role="status" className="lab-card mb-5 text-sm text-cyan-200">Running GLPK on the same frozen 20-region scenario…</p>}
  {active&&((modeUsed==='final'&&error)||view.error)&&<section role="alert" className="lab-card mb-5 border-rose-400/30 text-sm text-rose-200">GLPK comparison unavailable: {view.error||(modeUsed==='final'?error:'')}. No fallback results are shown.</section>}
  {active&&rawPairAvailable&&<section className="lab-card flex flex-wrap items-center gap-3 text-sm"><span className="font-semibold">Compare:</span><button type="button" aria-pressed={comparisonMode==='engine'} onClick={()=>setComparisonMode('engine')} className={`rounded-lg px-3 py-2 ${comparisonMode==='engine'?'bg-emerald-700 text-white':'border border-white/20'}`}>Engine-only (before risk/scheduler)</button><button type="button" aria-pressed={comparisonMode==='final'} onClick={()=>setComparisonMode('final')} className={`rounded-lg px-3 py-2 ${comparisonMode==='final'?'bg-emerald-700 text-white':'border border-white/20'}`}>Final dashboard (after policies)</button><p className="w-full text-xs text-slate-300">Engine-only isolates the selected solver against GLPK. Final dashboard includes scheduler and IQAE risk reassignment, which can legitimately make allocations equal.</p></section>}
  {view.value&&(()=>{const c=view.value;const good=c.annualTotalSavingsUsd>=0;return <>
   <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
    <Stat title="Annual operating + offset savings vs GLPK" value={`${good?'+':''}${usd(c.annualTotalSavingsUsd)}`} detail="Positive means selected allocation costs less annually." positive={good}/>
    <Stat title="Daily cloud operating cost" value={usd(c.selected.operatingDailyUsd)} detail={`GLPK: ${usd(c.glpk.operatingDailyUsd)} per day`}/>
    <Stat title="Annual carbon-offset expenditure" value={usd(c.selected.annualOffsetUsd)} detail={`GLPK: ${usd(c.glpk.annualOffsetUsd)}; illustrative $25/tCO₂ assumption`}/>
    <Stat title="Workload redistributed" value={`${normal(c.weightShiftPct)}%`} detail={`${c.regionsMoved}/20 regions differ from the GLPK allocation`}/>
   </section>
   <section className="mt-5 grid gap-5 lg:grid-cols-2">
    <div className="lab-card"><div className="mb-3 flex items-center gap-2"><Scale className="h-5 w-5 text-emerald-300"/><h2 className="text-lg font-bold">Same-input financial comparison · {modeUsed==='engine'?'engine-only':'final policy-adjusted'}</h2></div><p className="mb-4 text-xs text-slate-400">The selected engine and GLPK use identical regional telemetry, capacity, SLA, residency, budget, carbon penalty and treasury policy.</p>
    <div className="overflow-x-auto"><table className="w-full min-w-[420px] text-sm"><thead><tr className="border-b border-white/15 text-left text-xs text-slate-300"><th className="py-3">Metric</th><th className="text-right">Selected</th><th className="text-right">GLPK</th></tr></thead><tbody>{[
     ['Daily cloud OPEX',usd(c.selected.operatingDailyUsd),usd(c.glpk.operatingDailyUsd)],
     ['Annual cloud OPEX',usd(c.selected.annualCloudUsd),usd(c.glpk.annualCloudUsd)],
     ['Annual carbon offsets',usd(c.selected.annualOffsetUsd),usd(c.glpk.annualOffsetUsd)],
     ['Cloud + offset annual total',usd(c.selected.annualOperatingAndOffsetUsd),usd(c.glpk.annualOperatingAndOffsetUsd)],
     ['Carbon intensity',`${normal(c.selected.carbonIntensity)} gCO₂/kWh`,`${normal(c.glpk.carbonIntensity)} gCO₂/kWh`],
     ['Net footprint',`${normal(c.selected.netTonnesDaily)} t/day`,`${normal(c.glpk.netTonnesDaily)} t/day`],
     ['Network latency',`${normal(c.selected.latencyMs)} ms`,`${normal(c.glpk.latencyMs)} ms`],
    ].map(row=><tr key={row[0]} className="border-b border-white/10"><td className="py-3 pr-2 text-slate-300">{row[0]}</td><td className="text-right font-semibold text-emerald-100">{row[1]}</td><td className="text-right text-slate-300">{row[2]}</td></tr>)}</tbody></table></div>
    <div className="mt-4 rounded-lg bg-emerald-950/40 p-3 text-sm"><p className="font-semibold">Annual savings breakdown</p><p className="mt-2">Cloud OPEX savings: <strong>{usd(c.annualCloudSavingsUsd)}</strong></p><p className="mt-1">Offset savings: <strong>{usd(c.annualOffsetSavingsUsd)}</strong></p><p className="mt-1">Net footprint difference: <strong>{normal(c.netTonnesAvoidedDaily)} t/day</strong> (positive = selected saves carbon)</p></div>
    </div>
    <div className="lab-card"><div className="mb-3 flex items-center gap-2"><Wallet className="h-5 w-5 text-emerald-300"/><h2 className="text-lg font-bold">Treasury model — shown separately</h2></div>
     <p className="mb-5 text-xs leading-5 text-slate-300">Treasury capital is <strong>not</strong> the cloud operating budget. These investment yields are scenario assumptions, not guaranteed or realized returns. Carbon-offset spending is modeled separately.</p>
     <div className="grid grid-cols-2 gap-3"><Stat title="Selected gross APY" value={pct(c.selected.grossApyPct)} detail="Modeled investment yield"/><Stat title="After-offset APY" value={pct(c.selected.netApyPct)} detail={`GLPK: ${pct(c.glpk.netApyPct)}`}/></div>
     <div className="mt-4 rounded-lg border border-white/10 px-3 py-3 text-sm"><p>Modeled annual treasury income: <b>{usd(c.selected.annualTreasuryIncomeUsd)}</b></p><p className="mt-2">After cloud OPEX and offsets: <b>{usd(c.selected.annualCombinedUsd)}</b></p><p className="mt-2 text-xs text-slate-400">The combined figure is an illustrative business operating result, <strong>not</strong> an APY. Cloud bills must not be divided by treasury capital and mislabeled as investment losses.</p></div>
     <div className="mt-4"><Link href="/tools/treasury-risk" className="text-xs text-emerald-300 underline">Optional: explore separate treasury stress scenarios →</Link></div>
    </div>
   </section>
   <section className="lab-card mt-5"><h2 className="text-lg font-bold">20-region allocation difference</h2><p className="mt-2 text-xs text-slate-400">Identical snapshot; percentage-point changes between the selected engine and GLPK.</p><details className="mt-4"><summary className="cursor-pointer text-sm font-semibold text-emerald-200">Inspect every region</summary><div className="mt-3 max-h-96 overflow-auto"><table className="w-full min-w-[420px] text-sm"><thead><tr className="sticky top-0 bg-emerald-950"><th className="p-2 text-left">Region</th><th className="text-right">Selected</th><th className="text-right">GLPK</th><th className="text-right">Δ pp</th></tr></thead><tbody>{REGION_ORDER.map((id,i)=>{const d=(c.selected.weights[i]-c.glpk.weights[i])*100;return <tr key={id} className="border-t border-white/10"><td className="p-2">{REGIONS[id].city}</td><td className="text-right">{pct(c.selected.weights[i]*100)}</td><td className="text-right">{pct(c.glpk.weights[i]*100)}</td><td className={`text-right ${d>0?'text-emerald-300':d<0?'text-amber-200':''}`}>{d>0?'+':''}{normal(d)} pp</td></tr>;})}</tbody></table></div></details></section>
   <p className="mt-4 text-xs leading-5 text-slate-400">All figures are modeled, not audited cloud invoices or live investment returns. GLPK solves the same scenario as the chosen engine; its combined mathematical objective may outperform a heuristic even when one component such as carbon or cost improves. Financial savings alone do not prove quantum advantage. Snapshot timestamp and assumptions should accompany external reports.</p>
  </>;})()}
  </>}
 </div></main>;
}
