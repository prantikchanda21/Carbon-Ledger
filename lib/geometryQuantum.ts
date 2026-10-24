import {Worker} from 'node:worker_threads';
import {geometryWorkerSource} from './geometryQuantumWorker.ts';
export interface GeometryInput {costs:number[];caps:number[];preferred:number[];regularization:number;}
export type GeometryVariant='geometry'|'xy'|'grover'|'curved'|'fusion';
export interface GeometryBatch {weights:number[];objective:number;selectedBasis:number;qubits:10;p:3;batch:number;norm:number;shots:number;validBasisStates:number;trace:{round:number;schedule:number;marked:number;bestObjective:number}[];durationMs:number;candidateBest:number;samplingGapPct:number;uniformObjective:number;classicalOptimizerUsed:false;method:string;}
type Pending={resolve:(value:GeometryBatch)=>void;reject:(e:Error)=>void;timer:ReturnType<typeof setTimeout>};
class StatevectorWorker{
 worker:Worker;pending=new Map<number,Pending>();nextId=0;
 readonly batch:number;
 constructor(batch:number){this.batch=batch;
  this.worker=new Worker(geometryWorkerSource,{eval:true});
  this.worker.on('message',(msg:{id:number;result?:GeometryBatch;error?:string})=>{
   const p=this.pending.get(msg.id);if(!p)return;
   clearTimeout(p.timer);this.pending.delete(msg.id);if(!this.pending.size)this.worker.unref();
   if(msg.error)p.reject(new Error(msg.error));else if(msg.result)p.resolve(msg.result);else p.reject(new Error('Malformed quantum worker result'));
  });
  const rejectAll=(e:Error)=>{for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(e);}this.pending.clear();};
  this.worker.on('error',rejectAll);this.worker.on('exit',code=>rejectAll(new Error(`Geometry worker exited: ${code}`)));this.worker.unref();
 }
 run(problem:GeometryInput,variant:GeometryVariant){return new Promise<GeometryBatch>((resolve,reject)=>{
  const id=++this.nextId,timer=setTimeout(()=>{this.pending.delete(id);reject(new Error('Geometry quantum worker timed out'));},15000);
  this.pending.set(id,{resolve,reject,timer});this.worker.ref();this.worker.postMessage({id,input:{...problem,batch:this.batch,variant}});
 });}
}
let pool:StatevectorWorker[]|undefined;
export async function geometryQuantumAllocation(input:GeometryInput,variant:GeometryVariant='geometry'){
 const n=input.costs.length;
 if(n!==20||input.caps.length!==n||input.preferred.length!==n||![...input.costs,...input.caps,...input.preferred,input.regularization].every(Number.isFinite)||input.regularization<0||input.caps.some(c=>c<0)||input.caps.reduce((a,b)=>a+b,0)<1-1e-9)throw Error('Invalid or infeasible 20-region geometry inputs');
 pool??=Array.from({length:4},(_,i)=>new StatevectorWorker(i));
 // Fusion runs two independent depth-3 10-qubit circuits per worker.
 // Its final choice is the better *measured circuit outcome*; no LP fallback.
 const groups=await Promise.all(pool.map(async w=>variant==='fusion'
  ?[await w.run(input,'curved'),await w.run(input,'grover')]
  :[await w.run(input,variant)]));
 const allBatches=groups.flat();
 const batches=groups.map(group=>group.reduce((a,b)=>a.objective<=b.objective?a:b));
 const selected=batches.reduce((a,b)=>a.objective<=b.objective?a:b);
 const feasible=selected.weights.every((v,i)=>Number.isFinite(v)&&v>=-1e-10&&v<=input.caps[i]+1e-8)&&Math.abs(selected.weights.reduce((a,b)=>a+b,0)-1)<1e-8;
 if(!feasible||allBatches.some(b=>Math.abs(b.norm-1)>1e-8))throw Error('Invalid simulated quantum result');
 return {...selected,batches,allBatches,feasible,variant,
   method:variant==='fusion'?'Four workers × two independent depth-3 10-qubit CPU quantum simulations (curved XY/Grover + adaptive Grover), classical best measured-candidate selector':selected.method};
}
