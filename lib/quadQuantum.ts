import {Worker} from 'node:worker_threads';
import {quadWorkerSource} from './quadQuantumWorker.ts';
export interface QuadInput {costs:number[];caps:number[];preferred:number[];regularization:number;}
export interface QuadBatch {batch:number;weights:number[];objective:number;selectedBasis:number;trace:{round:number;bestObjective:number}[];norm:number;durationMs:number;quantumWon?:boolean;classicalCandidateUsed?:boolean;graphSearch?:{expanded:number;graphSelected:number;quantumSelected:number;usedAnalyticalFallback:boolean};}
type Pending={resolve:(value:QuadBatch)=>void;reject:(reason:Error)=>void;timer:ReturnType<typeof setTimeout>};
class PersistentWorker{
 worker:Worker;pending=new Map<number,Pending>();serial=0;
 readonly batch:number;
 constructor(batch:number){this.batch=batch;
  this.worker=new Worker(quadWorkerSource,{eval:true});
  this.worker.on('message',(msg:{id:number;result?:QuadBatch;error?:string})=>{
   const p=this.pending.get(msg.id);if(!p)return;
   clearTimeout(p.timer);this.pending.delete(msg.id);if(!this.pending.size)this.worker.unref();
   if(msg.error)p.reject(new Error(msg.error));else if(msg.result)p.resolve(msg.result);else p.reject(new Error('Missing worker result'));
  });
  const fail=(err:Error)=>{for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(err);}this.pending.clear();};
  this.worker.on('error',fail);this.worker.on('exit',code=>fail(new Error(`Quantum worker exit ${code}`)));this.worker.unref();
 }
 run(input:QuadInput){return new Promise<QuadBatch>((resolve,reject)=>{
  
  const id=++this.serial;const timer=setTimeout(()=>{this.pending.delete(id);reject(new Error('Quantum worker timeout'));},15000);
  this.pending.set(id,{resolve,reject,timer});this.worker.ref();this.worker.postMessage({id,input:{...input,batch:this.batch}});
 });}
}
let workers:PersistentWorker[]|null=null;
function pool(){return workers??(workers=Array.from({length:4},(_,i)=>new PersistentWorker(i)));}
export async function quadQuantumAllocation(input:QuadInput){
 const n=input.costs.length;
 if(!n||input.caps.length!==n||input.preferred.length!==n||![...input.costs,...input.caps,...input.preferred,input.regularization].every(Number.isFinite)||input.regularization<0||input.caps.some(c=>c<0)||input.caps.reduce((a,b)=>a+b,0)<1-1e-9)throw Error('Invalid or infeasible independent-engine inputs');
 const batches=await Promise.all(pool().map(w=>w.run(input)));
 const best=batches.reduce((a,b)=>a.objective<=b.objective?a:b);
 const feasible=best.weights.every((w,i)=>Number.isFinite(w)&&w>=-1e-9&&w<=input.caps[i]+1e-8)&&Math.abs(best.weights.reduce((a,b)=>a+b,0)-1)<1e-8;
 if(!feasible)throw Error('Independent engine failed allocation validation');
 return {...best,batches,feasible};
}
