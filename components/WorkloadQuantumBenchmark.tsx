'use client';
import { useEffect, useRef, useState } from 'react';
import type { LabInput } from '@/lib/lab/types';
import { readQuantumExecution, writeQuantumExecution, QUANTUM_EXECUTION_EVENT } from '@/lib/quantumExecutionPreferences';
import { prepareWorkloadObjective, type QaoaOptions, type WorkloadBenchmark } from '@/lib/lab/workloadQuantum';
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';

const defaults:QaoaOptions={depth:2,iterations:20,gamma:0.8,beta:0.45,optimize:true,sweep:false,optimizer:'coordinate',restarts:3,seed:20261013,maxQubits:10,memoryGb:8,annealSteps:48,annealTime:6};
const num=(n:number)=>Number.isFinite(n)?n.toFixed(2):'—';
export default function WorkloadQuantumBenchmark({input}:{input:LabInput}){
  const [settings,setSettings]=useState<QaoaOptions>(defaults);
  const [executionMode,setExecutionMode]=useState<'auto'|'local'|'cloud'>('auto');
  const [runSettings,setRunSettings]=useState<QaoaOptions>(defaults);
  useEffect(() => {
    const sync = () => { const value = readQuantumExecution(); setSettings(old => ({...old, maxQubits:value.maxQubits, memoryGb:value.memoryGb})); setExecutionMode(value.executionMode); setCloudBackend(value.cloudBackend); };
    sync(); window.addEventListener('storage',sync); window.addEventListener(QUANTUM_EXECUTION_EVENT,sync);
    return () => {window.removeEventListener('storage',sync);window.removeEventListener(QUANTUM_EXECUTION_EVENT,sync);};
  }, []);
  const [busy,setBusy]=useState(false);
  const [cloudBusy,setCloudBusy]=useState(false);
  const [cloudBackend,setCloudBackend]=useState<'auto'|'cpu'|'gpu'>('auto');
  const [repeats,setRepeats]=useState(3);
  const [cloudResult,setCloudResult]=useState<{runs:Array<{depth:number;repeat:number;backend:string;cost:number;gapPercent:number;feasibleProbability:number;optimalProbability:number;runtimeMs:number}>;wallMs:number;parallelWorkers:number}|null>(null);
  const [cloudError,setCloudError]=useState('');
  const cloudAbort=useRef<AbortController|null>(null);
  const [result,setResult]=useState<{value:WorkloadBenchmark|null;error:string}>({value:null,error:''});
  const [lastInput,setLastInput]=useState<LabInput|null>(null);
  const workersRef=useRef<Worker[]>([]);
  const [parallelWorkers,setParallelWorkers]=useState(1);
  const runId=useRef(0);
  const stale=lastInput!==input;
  useEffect(()=>()=>{workersRef.current.forEach(w=>w.terminate());cloudAbort.current?.abort();},[]);
  function stop(){runId.current++;workersRef.current.forEach(w=>w.terminate());workersRef.current=[];setBusy(false);}
  function run(sweep:boolean){
    const options={...settings,sweep};
    stop();setBusy(true);setResult({value:null,error:''});setRunSettings(options);setLastInput(input);
    const id=++runId.current;
    // Independent seeded trials can run concurrently on separate browser workers.
    // A depth sweep remains on one worker to avoid multiplying its CPU load.
    const hardwareLimit=typeof navigator==='undefined'?2:Math.max(1,Math.min(4,Math.floor((navigator.hardwareConcurrency||2)/2)));
    const workerCount=sweep?1:Math.min(settings.restarts??1,hardwareLimit);
    setParallelWorkers(workerCount);
    const outcomes: WorkloadBenchmark[]=[];
    let completed=0;
    let failed='';
    const cleanup=()=>{workersRef.current.forEach(w=>w.terminate());workersRef.current=[];};
    const finish=()=>{
      if(id!==runId.current || ++completed<workerCount)return;
      cleanup();setBusy(false);
      if(outcomes.length===0){setResult({value:null,error:failed||'Local optimization failed'});return;}
      const winner=outcomes.reduce((a,b)=>b.research.bestEnergy<a.research.bestEnergy?b:a);
      const allEnergies=outcomes.flatMap(r=>r.research.restartEnergies);
      const mean=allEnergies.reduce((a,b)=>a+b,0)/allEnergies.length;
      const std=Math.sqrt(allEnergies.reduce((a,b)=>a+(b-mean)**2,0)/allEnergies.length);
      setResult({value:{...winner,research:{...winner.research,restarts:allEnergies.length,restartEnergies:allEnergies,meanEnergy:mean,stdEnergy:std}},error:''});
    };
    try{
      for(let index=0;index<workerCount;index++){
        const worker=new Worker(new URL('./workloadQaoa.worker.ts',import.meta.url));
        workersRef.current.push(worker);
        const localOptions={...options,restarts:Math.max(1,Math.floor((options.restarts??1)/workerCount)+(index<(options.restarts??1)%workerCount?1:0)),seed:(options.seed??20261013)+index*104729};
        worker.onmessage=(event:MessageEvent<{id:number;result?:WorkloadBenchmark;error?:string}>)=>{
          if(id!==runId.current)return;
          if(event.data.result)outcomes.push(event.data.result);
          if(event.data.error)failed=event.data.error;
          finish();
        };
        worker.onerror=(event)=>{if(id!==runId.current)return;failed=event.message||'Worker failed';finish();};
        worker.postMessage({input,options:localOptions,id});
      }
    }catch(error){cleanup();setResult({value:null,error:error instanceof Error?error.message:'Worker unavailable'});setBusy(false);}
  }
  async function runCloud(sweep=false){
    cloudAbort.current?.abort();const abort=new AbortController();cloudAbort.current=abort;
    setCloudBusy(true);setCloudError('');setCloudResult(null);
    try{
      const objective=prepareWorkloadObjective(input,settings.maxQubits??10);
      const response=await fetch('/api/cloud-qaoa',{method:'POST',headers:{'content-type':'application/json'},signal:abort.signal,
        body:JSON.stringify({costs:objective.costs,feasible:objective.valid,depth:settings.depth,iterations:settings.iterations,
          gamma:settings.gamma,beta:settings.beta,optimize:settings.optimize,sweep,repeats,backend:cloudBackend})});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||'Cloud compute failed');
      setCloudResult(data);setLastInput(input);
    }catch(e){if(!abort.signal.aborted)setCloudError(e instanceof Error?e.message:'Cloud execution failed');}
    finally{if(cloudAbort.current===abort){cloudAbort.current=null;setCloudBusy(false);}}
  }
  function execute(sweep:boolean){
    // Auto uses the browser for responsiveness and requires no cloud configuration.
    writeQuantumExecution({maxQubits:settings.maxQubits??10,memoryGb:settings.memoryGb??8,executionMode,cloudBackend});
    if(executionMode==='cloud'){void runCloud(sweep);}else{run(sweep);}
  }
  const availableJobs=input.jobs.length;
  const effectiveQubits=Math.min(availableJobs,settings.maxQubits??10);
  const estimatedMiB=(2**effectiveQubits*128/1024**2);
  const b=result.value;
  const edit=<K extends keyof QaoaOptions>(key:K,value:QaoaOptions[K])=>setSettings(v=>({...v,[key]:value}));
  return <div className="mt-5 rounded-xl border border-cyan-400/25 bg-cyan-400/5 p-4 space-y-4">
    <h3 className="text-base font-semibold text-cyan-100">Quantum Workload Optimizer</h3>
    <p className="lab-note">Statevector QAOA · shared placement objective · exact and greedy baselines.</p>
    <section aria-label="Adaptive execution settings" className="rounded-xl border border-cyan-500/30 bg-slate-950/60 p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h4 className="text-sm font-semibold text-cyan-100">Execution settings</h4><span className="text-xs text-slate-400">Adaptive · {effectiveQubits} active qubits · {2**effectiveQubits} states</span></div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <label className="text-xs font-semibold text-slate-200">Requested qubits<input aria-label="Requested qubits" type="number" min={1} max={12} step={1} value={settings.maxQubits??10} onChange={e=>edit('maxQubits',Math.max(1,Math.min(12,Math.floor(Number(e.target.value)||1))))} className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-950 p-2 text-sm text-white"/></label>
        <label className="text-xs font-semibold text-slate-200">Memory budget (GB)<select aria-label="Memory budget" value={settings.memoryGb??8} onChange={e=>edit('memoryGb',Number(e.target.value))} className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-950 p-2 text-sm text-white">{[2,4,8,16,32].map(v=><option key={v} value={v}>{v} GB</option>)}</select></label>
        <label className="text-xs font-semibold text-slate-200">Execution mode<select aria-label="Execution mode" value={executionMode} onChange={e=>setExecutionMode(e.target.value as 'auto'|'local'|'cloud')} className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-950 p-2 text-sm text-white"><option value="auto">Auto · safe local</option><option value="local">Local Web Worker</option><option value="cloud">Optional cloud</option></select></label>
        <label className="text-xs font-semibold text-slate-200">Hardware<select aria-label="Hardware" value={cloudBackend} disabled={executionMode!=='cloud'} onChange={e=>setCloudBackend(e.target.value as 'auto'|'cpu'|'gpu')} className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-950 p-2 text-sm text-white disabled:opacity-50"><option value="auto">Automatic</option><option value="cpu">Cloud CPU</option><option value="gpu">Cloud CUDA GPU</option></select></label>
      </div>
      <p className="mt-2 text-xs text-slate-400">Up to 12 binary workload choices; only {availableJobs} job(s) configured. Estimated quantum/objective buffers: {estimatedMiB.toFixed(2)} MiB (excluding scheduling overhead). Budget is a safety ceiling, not reserved RAM. Cloud requires a separately deployed worker. Changes apply to the next run. Browser execution uses up to four workers for independent restarts; cloud is optional.</p>
    </section>
    <details className="rounded-lg border border-white/10 bg-slate-950/40 p-3" open>
      <summary className="cursor-pointer text-sm font-semibold text-cyan-100">Annealing research settings</summary>
      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <label className="text-xs text-slate-200">Annealing steps<input aria-label="Annealing steps" type="number" min={8} max={256} value={settings.annealSteps??48} onChange={e=>edit('annealSteps',Math.max(8,Math.min(256,Math.floor(Number(e.target.value)||48))))} className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-950 p-2 text-white"/></label>
        <label className="text-xs text-slate-200">Annealing duration (units)<input aria-label="Annealing duration" type="number" min={0.1} max={30} step={0.5} value={settings.annealTime??6} onChange={e=>edit('annealTime',Math.max(0.1,Math.min(30,Number(e.target.value)||6)))} className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-950 p-2 text-white"/></label>
      </div>
      <p className="mt-2 text-xs text-slate-400">Digitized quantum annealing and classical simulated annealing share the workload cost and feasibility objective. This is local simulation, not annealing hardware.</p>
    </details>
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {([{key:'depth',name:'Circuit depth',min:1,max:8,step:1},{key:'iterations',name:'Iterations',min:0,max:120,step:1},{key:'gamma',name:'Initial γ',min:0,max:6.28,step:0.05},{key:'beta',name:'Initial β',min:0,max:3.14,step:0.05}] as const).map(f=><label className="text-xs font-semibold text-slate-200" key={f.key}>{f.name}<input aria-label={f.name} type="number" min={f.min} max={f.max} step={f.step} value={settings[f.key]} onChange={e=>edit(f.key,Math.max(f.min,Math.min(f.max,Number(e.target.value)||0)))} className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-950 p-2 text-sm text-white" /></label>)}
    </div>
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
      <label className="text-xs font-semibold text-slate-200">Optimizer<select aria-label="Variational optimizer" value={settings.optimizer??'coordinate'} onChange={e=>edit('optimizer',e.target.value as 'coordinate'|'spsa')} className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-950 p-2 text-sm text-white"><option value="coordinate">Coordinate search</option><option value="spsa">SPSA (stochastic)</option></select></label>
      <label className="text-xs font-semibold text-slate-200">Independent restarts<input aria-label="Independent restarts" type="number" min={1} max={8} value={settings.restarts??3} onChange={e=>edit('restarts',Math.max(1,Math.min(8,Number(e.target.value)||1)))} className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-950 p-2 text-sm text-white"/></label>
      <label className="text-xs font-semibold text-slate-200">Random seed<input aria-label="Random seed" type="number" min={0} max={4294967295} value={settings.seed??20261013} onChange={e=>edit('seed',Math.max(0,Math.floor(Number(e.target.value)||0)))} className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-950 p-2 text-sm text-white"/></label>
    </div>
    <div className="flex flex-wrap items-center gap-3"><label className="flex items-center gap-2 text-xs text-slate-200"><input type="checkbox" checked={settings.optimize} onChange={e=>edit('optimize',e.target.checked)}/> Optimize angles</label><button type="button" disabled={busy||cloudBusy} onClick={()=>execute(false)} className="rounded-lg border border-cyan-500/50 bg-cyan-600/25 px-4 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-600/40">Run QAOA</button><button type="button" disabled={busy||cloudBusy} onClick={()=>execute(true)} className="rounded-lg border border-slate-500 bg-slate-800 px-4 py-2 text-sm text-white hover:bg-slate-700">Depth sweep</button>{busy&&<button type="button" onClick={stop} className="rounded-lg border border-amber-400/50 px-3 py-2 text-xs text-amber-200">Cancel</button>}<span aria-live="polite" className="text-xs text-slate-400">{busy?`Optimizing with ${parallelWorkers} local worker(s)…`:stale?'Scenario changed — rerun to update results.':b?'Results reflect the last run.':'Select Run QAOA to begin.'}</span></div>
    {executionMode==='cloud'&&cloudError&&<p role="alert" className="lab-warning">{cloudError}</p>}
    {result.error&&<p className="lab-warning" role="alert">{result.error}</p>}
    <details className="rounded-lg border border-white/10 p-3"><summary className="cursor-pointer text-sm font-semibold">Parallel cloud compute (optional)</summary>
      <p className="mt-2 text-xs text-slate-400">Runs independent QAOA restarts or depth trials on remote CPU/GPU workers. Requires a separately deployed cloud service and Vercel environment variables. Cloud metrics are reported separately from the local benchmark.</p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="text-xs text-slate-200">Compute backend<select value={cloudBackend} onChange={e=>setCloudBackend(e.target.value as 'auto'|'cpu'|'gpu')} className="mt-1 block rounded-lg border border-slate-600 bg-slate-950 p-2 text-white"><option value="auto">Auto</option><option value="cpu">CPU</option><option value="gpu">CUDA GPU</option></select></label>
        <label className="text-xs text-slate-200">Parallel restarts<input className="mt-1 block w-24 rounded-lg border border-slate-600 bg-slate-950 p-2 text-white" type="number" min={1} max={16} value={repeats} onChange={e=>setRepeats(Math.max(1,Math.min(16,Number(e.target.value)||1)))}/></label>
        <button type="button" disabled={cloudBusy} onClick={() => { void runCloud(false); }} className="rounded-lg border border-cyan-500/50 bg-cyan-600/25 px-4 py-2 text-sm font-semibold text-cyan-100 disabled:opacity-50">{cloudBusy?'Running remotely…':'Run cloud batch'}</button>
        {cloudBusy&&<button type="button" className="rounded-lg border border-amber-400/50 px-3 py-2 text-xs text-amber-200" onClick={()=>{cloudAbort.current?.abort();cloudAbort.current=null;setCloudBusy(false);}}>Stop waiting</button>}
      </div>
      {cloudError&&<p role="alert" className="mt-2 text-xs text-amber-200">{cloudError}</p>}
      {cloudResult&&<div className="mt-3"><p className="text-xs text-slate-300">{cloudResult.runs.length} trials · {cloudResult.parallelWorkers} workers · {num(cloudResult.wallMs)} ms wall time · {cloudResult.runs[0]?.backend.toUpperCase()} backend</p>
        <div className="mt-2 overflow-x-auto"><table className="lab-table"><thead><tr><th>Depth</th><th>Restart</th><th>Backend</th><th>Cost ($)</th><th>Gap</th><th>Feasible P</th><th>Optimal P</th><th>Compute (ms)</th></tr></thead><tbody>{cloudResult.runs.map((r,i)=><tr key={i}><td>{r.depth}</td><td>{r.repeat+1}</td><td>{r.backend}</td><td>{num(r.cost)}</td><td>{num(r.gapPercent)}%</td><td>{num(r.feasibleProbability*100)}%</td><td>{num(r.optimalProbability*100)}%</td><td>{num(r.runtimeMs)}</td></tr>)}</tbody></table></div>
      </div>}
    </details>

    {b&&<>
      <p className="lab-note">{b.jobs.length} jobs · {b.configurations} configurations · {b.feasibleConfigurations} feasible · depth {b.qaoa.depth} · {runSettings.iterations} iterations · exact enumeration reference.</p>
      <div className="overflow-x-auto"><table className="lab-table"><thead><tr><th>Method</th><th>Cost (USD)</th><th>Gap to exact</th><th>Validity</th><th>Time (ms)</th></tr></thead><tbody>
        {([{label:'Exact enumeration',cost:b.exact.cost,feasible:true,time:b.runtimeMs.exact},{label:'Classical greedy',cost:b.greedy.cost,feasible:b.greedy.feasible,time:b.runtimeMs.greedy},{label:'1-flip local search',cost:b.localSearch.cost,feasible:b.localSearch.feasible,time:b.runtimeMs.localSearch},{label:'Simulated annealing (classical)',cost:b.simulatedAnnealing.cost,feasible:b.simulatedAnnealing.feasible,time:b.simulatedAnnealing.runtimeMs},{label:'Digitized quantum annealing',cost:b.quantumAnnealing.cost,feasible:b.quantumAnnealing.cost!==null,time:b.quantumAnnealing.runtimeMs},{label:'QAOA (modal feasible)',cost:b.qaoa.cost,feasible:b.qaoa.cost!==null,time:b.runtimeMs.qaoa}] as const).map(row=><tr key={row.label}><td>{row.label}</td><td>{row.cost===null?'—':row.cost.toFixed(4)}</td><td>{row.cost===null?'—':`${(b.exact.cost>0?100*(row.cost-b.exact.cost)/b.exact.cost:0).toFixed(2)}%`}</td><td>{row.feasible?'Feasible':'Not available'}</td><td>{num(row.time)}</td></tr>)}
      </tbody></table></div>
      
      <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="text-sm font-semibold text-slate-200">Research results</h4><button type="button" onClick={()=>{
        const record={executionMode,cloudBackend,requestedQubits:runSettings.maxQubits,memoryBudgetGb:runSettings.memoryGb,schema:'carbon-ledger-research-v14',exportedAt:new Date().toISOString(),settings:runSettings,scenario:input,results:b,limitations:'Bounded noiseless statevector research simulation, not quantum hardware or quantum advantage evidence'};
        const url=URL.createObjectURL(new Blob([JSON.stringify(record,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='carbon-ledger-quantum-experiment.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),5000);
      }} className="rounded-lg border border-cyan-500/40 px-3 py-2 text-xs font-semibold text-cyan-100">Export research JSON</button></div>
      <details className="rounded-lg border border-white/10 p-3" open><summary className="cursor-pointer text-sm font-semibold">Research diagnostics</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-3"><div><p className="text-xs text-slate-400">Optimizer</p><p className="text-sm font-semibold">{b.research.optimizer.toUpperCase()}</p></div><div><p className="text-xs text-slate-400">Restart energy, mean ± SD</p><p className="text-sm font-semibold">{num(b.research.meanEnergy)} ± {num(b.research.stdEnergy)}</p></div><div><p className="text-xs text-slate-400">Approximation ratio (cost)</p><p className="text-sm font-semibold">{b.research.approximationRatio===null?'—':num(b.research.approximationRatio)}</p></div></div>
        <p className="mt-2 text-xs text-slate-400">{b.research.restarts} independent starts · seed {b.research.seed} · terminal penalized energies: {b.research.restartEnergies.map(num).join(' / ')}. Ratio is exact feasible cost / modal feasible cost; larger is better up to 1.</p>
      </details>
      <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-lg border border-white/10 p-3"><p className="text-xs text-slate-400">Annealing feasible probability</p><p className="text-xl font-semibold">{(b.quantumAnnealing.feasibleProbability*100).toFixed(2)}%</p></div><div className="rounded-lg border border-white/10 p-3"><p className="text-xs text-slate-400">Annealing optimum probability</p><p className="text-xl font-semibold">{(b.quantumAnnealing.optimalProbability*100).toFixed(2)}%</p></div></div>
      <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-lg border border-white/10 p-3"><p className="text-xs text-slate-400">Feasible probability</p><p className="text-xl font-semibold">{(b.qaoa.feasibleProbability*100).toFixed(2)}%</p></div><div className="rounded-lg border border-white/10 p-3"><p className="text-xs text-slate-400">Optimal probability</p><p className="text-xl font-semibold">{(b.qaoa.optimalProbability*100).toFixed(2)}%</p></div></div>
      <p className="lab-note">Assignments: {b.jobs.map((id,i)=>`${id}: ${b.qaoa.mask===null?'—':(b.qaoa.mask&(1<<i))?'optimized':'baseline'}`).join(' · ')}.</p>
      <p className="lab-note">Optimized angles — γ: {b.qaoa.gamma.map(v=>v.toFixed(3)).join(', ')} · β: {b.qaoa.beta.map(v=>v.toFixed(3)).join(', ')}.</p>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="min-w-0 rounded-lg border border-white/10 p-3"><h4 className="mb-2 text-sm font-semibold">Optimizer convergence</h4><div className="h-52"><ResponsiveContainer width="100%" height="100%"><LineChart data={b.convergence}><CartesianGrid stroke="#334155" strokeDasharray="3 3"/><XAxis dataKey="iteration" stroke="#cbd5e1" fontSize={11}/><YAxis stroke="#cbd5e1" fontSize={11} domain={['auto','auto']}/><Tooltip contentStyle={{background:'#111827',border:'1px solid #475569'}}/><Line type="monotone" dataKey="energy" name="Expected penalized energy" stroke="#67e8f9" dot={false} strokeWidth={2}/></LineChart></ResponsiveContainer></div></div>
        <div className="min-w-0 rounded-lg border border-white/10 p-3"><h4 className="mb-2 text-sm font-semibold">Top bitstrings (%)</h4><div className="h-52"><ResponsiveContainer width="100%" height="100%"><BarChart data={b.distribution.slice(0,8).map(x=>({...x,percent:100*x.probability}))}><CartesianGrid stroke="#334155" strokeDasharray="3 3"/><XAxis dataKey="bits" stroke="#cbd5e1" fontSize={10}/><YAxis stroke="#cbd5e1" fontSize={11}/><Tooltip contentStyle={{background:'#111827',border:'1px solid #475569'}}/><Bar dataKey="percent" name="Probability %" fill="#22d3ee"/></BarChart></ResponsiveContainer></div></div>
      </div>
      <details className="rounded-lg border border-white/10 p-3"><summary className="cursor-pointer text-sm font-semibold">Assignment distribution</summary><div className="overflow-x-auto"><table className="lab-table"><thead><tr><th>Bitstring</th><th>Probability</th><th>USD</th><th>Valid</th></tr></thead><tbody>{b.distribution.map(x=><tr key={x.mask}><td>{x.bits}</td><td>{(100*x.probability).toFixed(2)}%</td><td>{x.cost.toFixed(4)}</td><td>{x.feasible?'Yes':'No'}</td></tr>)}</tbody></table></div></details>
      <details className="rounded-lg border border-white/10 p-3"><summary className="cursor-pointer text-sm font-semibold">Circuit schematic ({b.jobs.length} qubits)</summary><p className="lab-note mt-2">Initial H on every qubit, followed at each layer by a diagonal cost-phase operator exp(−iγHcost) and RX(2β) mixers. Cost phase uses the full energy/constraint table, not a compiled gate-level hardware circuit.</p><div className="overflow-x-auto"><pre className="mt-2 text-xs leading-6 text-cyan-100">{b.jobs.map((job,i)=>`q${i} ${job.padEnd(15)} ──H──${b.qaoa.gamma.map((_,d)=>`[Cost γ${d+1}]──RX(2β${d+1})──`).join('')}`).join('\n')}</pre></div></details>
      {runSettings.sweep&&<div className="rounded-lg border border-white/10 p-3"><h4 className="mb-2 text-sm font-semibold">QAOA depth analysis</h4><div className="h-56"><ResponsiveContainer width="100%" height="100%"><LineChart data={b.depthSweep}><CartesianGrid stroke="#334155" strokeDasharray="3 3"/><XAxis dataKey="depth" stroke="#cbd5e1" allowDecimals={false}/><YAxis stroke="#cbd5e1"/><Tooltip contentStyle={{background:'#111827',border:'1px solid #475569'}}/><Legend/><Line dataKey="gap" name="Candidate cost gap (%)" stroke="#67e8f9" strokeWidth={2}/></LineChart></ResponsiveContainer></div><p className="text-xs text-slate-400">Each depth independently optimizes its angles. Probability remains in the run metrics.</p></div>}
      {b.excluded.length>0&&<p className="lab-note">Excluded from configured quantum comparison: {b.excluded.join(', ')}. Main scheduling remains available. This is a restricted placement comparison and does not represent all possible regions or times.</p>}
      <details className="rounded-lg border border-white/10 p-3"><summary className="cursor-pointer text-sm font-semibold">Method and limitations</summary><p className="lab-note mt-2">Statevector simulation, not physical hardware. Reported runtime is indicative browser time, not a controlled solver comparison. The benchmark evaluates up to twelve binary placement choices; annealing is a digitized closed-system simulation, not quantum annealing hardware. It does not replace the carbon forecasting model. The benchmark evaluates up to twelve user-selected binary placement choices, not the full region/time scheduling problem. The modal feasible assignment is not guaranteed optimal; quantum advantage is not established. The restarts compare solutions of one bounded objective and are not independent datasets or evidence of generalization. Runtime includes reference enumeration in preprocessing and is not a hardware-level speed comparison.</p></details>
    </>}
  </div>;
}
