'use client';
import { useEffect, useRef, useState } from 'react';
import type { GridNodeTelemetry } from '@/lib/types';
import type { LabInput } from '@/lib/lab/types';
import { predictNode } from '@/lib/lab/engine';
import { REGION_ORDER } from '@/lib/regions';
import { buildQuantumRequest, submitQuantum, pollQuantum, type QuantumOptimizationResult } from '@/lib/quantumClient';
interface Row {engine:string;cost?:number;gapPct?:number;feasible?:boolean;computeMs?:number;initMs?:number;error?:string}
interface Bench {ids:string[];costs:number[];exact:number;rows:Row[];objective:string;createdAt:string;request:{telemetry:GridNodeTelemetry[]}}
export default function BenchmarkLab({input,onResult}:{input:LabInput;onResult:(value:unknown)=>void}) {
  const [bench,setBench]=useState<Bench|null>(null),[q,setQ]=useState<QuantumOptimizationResult|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[wall,setWall]=useState<number|null>(null);
  const abort=useRef<AbortController|null>(null);
  useEffect(()=>()=>abort.current?.abort(),[]);
  async function run(includeQuantum:boolean) {
    abort.current?.abort();const controller=new AbortController();abort.current=controller;setBusy(true);setError('');setBench(null);setQ(null);setWall(null);
    try {
      const telemetry=REGION_ORDER.map(id=>predictNode(input.history,id,Date.parse(input.start),Date.parse(input.start))).filter((x):x is NonNullable<typeof x>=>!!x);
      if(telemetry.length!==20)throw new Error('Need forecast data for all 20 regions');
      const r=await fetch('/api/benchmark',{method:'POST',headers:{'content-type':'application/json'},signal:controller.signal,body:JSON.stringify({...input.controls,telemetry,treasury_yield:6.8})});
      const data=await r.json();if(!r.ok)throw new Error(data.error??'Benchmark unavailable');const b=data as Bench;setBench(b);onResult(b);
      if(includeQuantum) {
        const request=buildQuantumRequest(telemetry,input.controls,'simulator');request.benchmark=true;
        request.regions=request.regions.map(n=>({...n,eligible:b.ids.includes(n.id)}));
        const start=performance.now();let result=await submitQuantum(request,controller.signal);setQ(result);
        const jobId=result.job_id;
        for(let i=0;result.status==='queued'&&jobId&&i<120;i++) {
          await new Promise<void>((resolve,reject)=>{const done=()=>{controller.signal.removeEventListener('abort',cancel);resolve();};const timer=setTimeout(done,2500);const cancel=()=>{clearTimeout(timer);reject(new DOMException('Aborted','AbortError'));};controller.signal.addEventListener('abort',cancel,{once:true});});
          result=await pollQuantum(jobId,request,controller.signal);setQ(result);
        }
        const elapsed=performance.now()-start;setWall(elapsed);onResult({...b,quantum:result,wallMs:elapsed});
                if(result.error)setError(result.error);
      }
    }catch(e){if((e as Error).name!=='AbortError')setError(e instanceof Error?e.message:'Benchmark failed');}
    finally {if(!controller.signal.aborted)setBusy(false);}
  }
  let quantumRow:Row|null=null;
  if(bench&&q?.weights&&(q.status==='completed'||q.status==='done')) {
    const weights=bench.ids.map(id=>q.weights?.[id as keyof typeof q.weights]??0);
    const total=weights.reduce((s,w)=>s+w,0);
    const sameCandidates=q.candidate_region_ids?.length===bench.ids.length&&bench.ids.every(id=>q.candidate_region_ids.includes(id as typeof q.candidate_region_ids[number]));
    const feasible=sameCandidates&&weights.every(w=>Number.isFinite(w)&&w>=0)&&Math.abs(total-1)<1e-6&&Object.entries(q.weights).every(([id,w])=>bench.ids.includes(id)||!w);
    const cost=weights.reduce((s,w,i)=>s+w*bench.costs[i],0);
    quantumRow={engine:'QAOA / Qiskit simulator',cost,feasible,gapPct:bench.exact>0?(cost-bench.exact)/bench.exact*100:0,computeMs:q.execution_ms??undefined};
  }
  return <div className="space-y-4">
    <p className="lab-note">Same six feasible candidates, same placement objective, sum of weights = 1 and cap = 1. This is a placement microbenchmark; it does not establish an advantage on the full scheduling problem. ONNX is projected onto this candidate set. QAOA outputs conditional feasible-sample probabilities.</p>
    <div className="flex flex-wrap gap-2"><button className="lab-button" disabled={busy} onClick={()=>void run(false)}>Run classical + ONNX</button><button className="lab-button" disabled={busy} onClick={()=>void run(true)}>{busy?'Running…':'Run all engines'}</button>{busy&&<button className="lab-button" onClick={()=>{abort.current?.abort();setBusy(false);setError('Stopped waiting.');}}>Stop waiting</button>}</div>
    {error&&<p role="status" className="lab-warning">{error}</p>}
    {q&&<p className="lab-note">Quantum status: {q.status} · {q.backend} · Job: {q.job_id??'local'} · End-to-end: {wall===null?'pending':`${(wall/1000).toFixed(2)}s`}</p>}
    {bench&&<><p className="lab-note">{bench.objective} Candidates: {bench.ids.join(', ')}.</p><div className="overflow-x-auto"><table className="lab-table"><thead><tr><th>Engine</th><th>USD/kWh</th><th>Gap to exact</th><th>Feasible</th><th>Compute ms</th><th>Init ms</th></tr></thead><tbody>{[...bench.rows,...(quantumRow?[quantumRow]:[])].map(row=><tr key={row.engine}><td>{row.engine}{row.error&&<p className="text-amber-200">{row.error}</p>}</td><td>{row.cost?.toFixed(6)??'—'}</td><td>{row.gapPct?.toFixed(3)??'—'}{row.gapPct!==undefined?'%':''}</td><td>{row.feasible===undefined?'—':row.feasible?'Yes':'No'}</td><td>{row.computeMs?.toFixed(3)??'not reported'}</td><td>{row.initMs?.toFixed(3)??'—'}</td></tr>)}</tbody></table></div></>}
  </div>;
}
