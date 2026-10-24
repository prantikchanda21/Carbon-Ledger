/// <reference lib="webworker" />
import {workloadBenchmark} from './workloadQuantum';
import type {LabInput} from './types';
self.onmessage=(event:MessageEvent<{input:LabInput;qubits:number;algorithm:'qaoa'|'quantumAnnealing';seed:number}>)=>{
  try{
    const {input,qubits,algorithm,seed}=event.data;
    const result=workloadBenchmark(input,{maxQubits:Math.min(5,qubits),depth:3,iterations:22,restarts:2,seed,annealSteps:48,annealTime:6,optimizer:'spsa',sweep:false});
    self.postMessage({ok:true,result,algorithm});
  }catch(error){self.postMessage({ok:false,error:error instanceof Error?error.message:String(error)});}
};
