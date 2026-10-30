import {placementQaoa} from './placementCore';
import type {QuantumOptimizationRequest} from '../quantumClient';
self.onmessage=(event:MessageEvent<{payload:QuantumOptimizationRequest;batch:number}>)=>{
 try{self.postMessage({result:placementQaoa(event.data.payload,event.data.batch)});}catch(e){self.postMessage({error:e instanceof Error?e.message:String(e)});}
};
