import type {QuantumOptimizationRequest,QuantumOptimizationResult} from '../quantumClient.ts';
import {placementQaoa} from './placementCore.ts';
export {placementQaoa} from './placementCore.ts';

/** In browsers, run the four statevector searches in independent Web Workers.
 * Promise.all on the main thread would NOT be parallel CPU execution.
 * Server execution remains synchronous because browser Worker is unavailable.
 */
export async function placementQaoaParallel(payload:QuantumOptimizationRequest): Promise<QuantumOptimizationResult & Record<string,unknown>> {
 if(typeof window==='undefined'||typeof Worker==='undefined')return placementQaoa(payload);
 const started=performance.now();
 const workers:Worker[]=[];
 const timers:ReturnType<typeof setTimeout>[]=[];
 const stopAll=()=>{for(const timer of timers)clearTimeout(timer);for(const worker of workers)worker.terminate();};
 let parts:ReturnType<typeof placementQaoa>[];
 try {
  const runs=Array.from({length:4},(_,batch)=>new Promise<ReturnType<typeof placementQaoa>>((resolve,reject)=>{
   let worker:Worker;
   try{worker=new Worker(new URL('./placement.worker.ts',import.meta.url),{type:'module'});}catch(error){reject(error);return;}
   workers.push(worker);
   let complete=false;
   const settle=(fn:()=>void)=>{if(complete)return;complete=true;worker.terminate();fn();};
   const timer=setTimeout(()=>settle(()=>reject(new Error(`QAOA batch ${batch+1} timed out`))),45000);
   timers.push(timer);
   worker.onmessage=(event:MessageEvent<{result?:ReturnType<typeof placementQaoa>;error?:string}>)=>{
    clearTimeout(timer);
    settle(()=>{if(event.data.error)reject(new Error(event.data.error));else if(event.data.result)resolve(event.data.result);else reject(new Error('Empty QAOA worker result'));});
   };
   worker.onerror=(event)=>{clearTimeout(timer);settle(()=>reject(new Error(event.message||'Quantum worker failed')));};
   try{worker.postMessage({payload,batch});}catch(error){clearTimeout(timer);settle(()=>reject(error));}
  }));
  const completed=await Promise.all(runs.map(run=>run.catch(error=>{
   // A five-region batch may have no eligible regions; other batches can still supply a candidate.
   if(error instanceof Error && /No feasible QAOA samples|No eligible candidates after constraints/.test(error.message))return null;
   throw error;
  })));
  parts=completed.filter((part):part is ReturnType<typeof placementQaoa>=>part!==null);
 }finally{stopAll();}
 const rows=parts.flatMap(x=>(x.objective_comparison as Array<{batch_index:number;best_feasible_sample_cost:number|null;best_feasible_sample_region_id:string|null;feasible_probability:number;objective:string;expected_penalized_energy:number}>));
 const best=rows.filter(x=>x.best_feasible_sample_region_id!==null).sort((a,b)=>(a.best_feasible_sample_cost??Infinity)-(b.best_feasible_sample_cost??Infinity)||b.feasible_probability-a.feasible_probability)[0];
 if(!best?.best_feasible_sample_region_id)throw new Error('No eligible quantum candidate across all four batches; check SLA and regional eligibility');
 const selected=best.best_feasible_sample_region_id;
 const requestRegion=payload.regions.find(r=>r.id===selected)!;
 const selectedCost=requestRegion.energy_price/1000+payload.carbon_tax*.25*requestRegion.carbon_ci/1000+Math.max(0,requestRegion.latency_ms-payload.sla_ms)*.005+requestRegion.egress_cost_gb*.05;
 return {...parts[0],weights:Object.fromEntries(payload.regions.map(r=>[r.id,r.id===selected?1:0])),qaoa_cost_usd_per_kwh:selectedCost,execution_ms:performance.now()-started,feasible_probability:best.feasible_probability,optimizer_evals:parts.reduce((sum,p)=>sum+Number(p.optimizer_evals??0),0),batch_count:4,objective_comparison:rows,best_feasible_sample:{region_id:selected,cost_usd_per_kwh:best.best_feasible_sample_cost,hedge:false,objective:best.objective,batch_index:best.batch_index},parallel_batches:true,encoding:'5 primary and 5 reserve bits per batch; one primary and optional distinct reserve; GLPK makes final allocation'};
}
