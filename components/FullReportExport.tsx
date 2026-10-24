'use client';
import {useState} from 'react';
import {FileDown,FileText,RefreshCcw,BookOpen,BarChart3} from 'lucide-react';
import {collectUnifiedReport} from '@/lib/unifiedReport';
import {downloadPdf,downloadWord} from '@/lib/reportDownloads';
import {enhanceReport, type ReportAudience,type ReportFocus} from '@/lib/reportNarrative';
import type {ReportData} from '@/lib/siteReport';

const focuses:{value:ReportFocus;label:string}[]=[
 {value:'comprehensive',label:'Complete enterprise analysis'},
 {value:'financial',label:'Financial impact and treasury'},
 {value:'quantum',label:'Quantum engines and benchmarks'},
 {value:'sustainability',label:'Carbon, weather and sustainability'},
 {value:'operations',label:'Workload placement and operations'}
];
export default function FullReportExport({compact=false}:{compact?:boolean}){
 const [focus,setFocus]=useState<ReportFocus>('comprehensive');
 const [audience,setAudience]=useState<ReportAudience>('dual');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const [ready,setReady]=useState<{report:ReportData;source:'groq'|'local';at:string}|null>(null);
 const [expanded,setExpanded]=useState(false);
 async function generate(download?:'pdf'|'word'){
  if(busy)return;
  setBusy(true);setError('');setMessage('Collecting live scenario, saved results, engine metrics and benchmark evidence…');
  try{
   const snapshot=await collectUnifiedReport();
   setMessage('Preparing evidence-linked analysis with Groq. Numeric tables are kept unchanged…');
   const enriched=await enhanceReport(snapshot,{focus,audience});
   setReady({report:enriched.report,source:enriched.source,at:new Date().toLocaleString()});
   setMessage(enriched.source==='groq'
    ?`Detailed Groq report generated. ${enriched.report.sections.length} source and analysis tables available.`
    :`Source-only report prepared. Groq enhancement unavailable (${enriched.reason??'not configured'}). Add GROQ_REPORT_API_KEY or GROQ_API_KEY in server environment to enable AI sections.`);
   if(download==='pdf')downloadPdf(enriched.report);
   if(download==='word')downloadWord(enriched.report);
  }catch(err){setError(`Report preparation failed: ${err instanceof Error?err.message:String(err)}`);setMessage('');}
  finally{setBusy(false);}
 }
 function exportReady(kind:'pdf'|'word'){
  if(!ready){void generate(kind);return;}
  try{kind==='pdf'?downloadPdf(ready.report):downloadWord(ready.report);}catch(err){setError(`Export failed: ${err instanceof Error?err.message:String(err)}`);}
 }
 return <div className={compact?'space-y-3 rounded-xl border border-emerald-500/20 p-3':'atlas-card space-y-4 p-5'}>
  <div><h3 className="flex items-center gap-2 text-lg font-semibold text-white"><BookOpen size={19} className="text-emerald-300"/> Dynamic Enterprise Intelligence Report</h3>
   <p className="mt-2 text-sm leading-6 text-slate-300">Build a thorough report from the <strong>current 20-region allocation</strong>, controls, weather, carbon, modeled finance, saved experiments and available quantum benchmarks. Groq writes two layers of explanation, evidence-linked findings and recommendations; measured tables remain authoritative.</p></div>
  <div className="grid gap-3 md:grid-cols-2">
   <label className="space-y-1 text-xs font-semibold text-slate-200">Report emphasis
    <select className="lab-input w-full" value={focus} onChange={e=>{setFocus(e.target.value as ReportFocus);setReady(null);setMessage('');}} aria-label="Report emphasis">{focuses.map(f=><option key={f.value} value={f.value}>{f.label}</option>)}</select>
   </label>
   <label className="space-y-1 text-xs font-semibold text-slate-200">Explanation style
    <select className="lab-input w-full" value={audience} onChange={e=>{setAudience(e.target.value as ReportAudience);setReady(null);setMessage('');}} aria-label="Report explanation style">
     <option value="dual">Beginner + professional (recommended)</option><option value="beginner">Beginner-friendly</option><option value="professional">Professional / technical</option>
    </select>
   </label>
  </div>
  <div className="flex flex-wrap gap-2">
   <button disabled={busy} type="button" onClick={()=>void generate()} className="lab-button lab-primary inline-flex items-center gap-2 disabled:opacity-50"><RefreshCcw size={16}/>{busy?'Analyzing current data…':ready?'Regenerate using latest data':'Generate detailed report'}</button>
   <button disabled={busy} type="button" onClick={()=>exportReady('pdf')} className="lab-button inline-flex items-center gap-2 disabled:opacity-50"><FileDown size={16}/> {ready?'Download PDF':'Generate & download PDF'}</button>
   <button disabled={busy} type="button" onClick={()=>exportReady('word')} className="lab-button inline-flex items-center gap-2 disabled:opacity-50"><FileText size={16}/> {ready?'Download Word':'Generate & download Word'}</button>
  </div>
  {message&&<p role="status" className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm text-emerald-100">{message}</p>}
  {error&&<p role="alert" className="rounded-lg border border-rose-500/20 p-3 text-xs text-rose-300">{error}</p>}
  {ready&&<div className="space-y-3 rounded-xl border border-cyan-500/20 bg-slate-950/30 p-4">
   <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="flex items-center gap-2 font-semibold text-white"><BarChart3 size={17}/> Report preview</h4><span className="text-xs text-slate-400">{ready.source==='groq'?'Groq commentary + source tables':'Source tables only'} · Snapshot {ready.at}</span></div>
   <p className="text-xs text-amber-100">Preview/export reflects the collected snapshot. Click Regenerate to incorporate any new engine run, budget or telemetry updates. Missing measurements are not invented.</p>
   <p className="text-sm text-slate-300">{ready.report.sections.length} structured tables · Executive summary, technical interpretation, supporting evidence and action priorities when Groq is enabled.</p>
   <button type="button" className="lab-button" onClick={()=>setExpanded(v=>!v)}>{expanded?'Hide preview':'Preview the first report sections'}</button>
   {expanded&&ready.report.sections.slice(0,ready.source==='groq'?5:3).map((s,i)=><section key={`${i}:${s.title}`} className="space-y-2 rounded-lg border border-white/10 p-3"><h5 className="text-sm font-bold text-emerald-100">{s.title}</h5><p className="text-xs leading-5 text-slate-400">{s.explanation}</p><div className="overflow-x-auto"><table className="w-full min-w-[500px] text-left text-xs"><thead><tr>{s.columns.map((c,j)=><th key={j} className="border-b border-emerald-500/30 px-3 py-2 text-emerald-200">{c}</th>)}</tr></thead><tbody>{s.rows.slice(0,12).map((row,r)=><tr key={r} className="border-b border-white/10">{s.columns.map((_,j)=><td key={j} className="px-3 py-2 align-top leading-5 text-slate-300">{row[j]??'—'}</td>)}</tr>)}</tbody></table></div></section>)}
  </div>}
  <p className="text-xs leading-5 text-slate-400">Server-side key: <code>GROQ_REPORT_API_KEY</code> (or <code>GROQ_API_KEY</code>). Optional model: <code>GROQ_REPORT_MODEL</code>. Keys are never sent to the browser. Reports are AI-assisted analysis of modeled and recorded data—not independently verified cloud savings or quantum advantage.</p>
 </div>;
}
