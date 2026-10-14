import type { LabInput, Snapshot } from './types';
import type { RegionId } from '../types';
import { HOUR, predictNode, nodeAt } from './engine';

/** Small local two-qubit statevector feature map plus a trainable classical neural readout.
 * The circuit is simulated on a CPU, not executed on quantum hardware. No claim of quantum advantage.
 * Fitted only to strictly earlier observations; labeled experimental throughout.
 */
const features=(x:number,y:number)=>{
  // Two-qubit statevector, input Ry rotations, CZ entangler, fixed readout rotations.
  // Qubit 0 is the low bit; all amplitudes remain real for this circuit.
  const state=new Float64Array([1,0,0,0]);
  const ry=(bit:number,angle:number)=>{
    const c=Math.cos(angle/2),t=Math.sin(angle/2),step=1<<bit;
    for(let base=0;base<4;base++)if(!(base&step)){
      const other=base|step, a=state[base],b=state[other];
      state[base]=c*a-t*b;state[other]=t*a+c*b;
    }
  };
  ry(0,Math.PI*Math.tanh(x));ry(1,Math.PI*Math.tanh(y));
  state[3]*=-1; // controlled-Z entangling gate
  ry(0,0.83);ry(1,-0.61);
  let z0=0,z1=0,zz=0,x0=0,x1=0,xx=0;
  for(let i=0;i<4;i++){
    const prob=state[i]*state[i],s0=(i&1)?-1:1,s1=(i&2)?-1:1;
    z0+=prob*s0;z1+=prob*s1;zz+=prob*s0*s1;
    x0+=state[i]*state[i^1];x1+=state[i]*state[i^2];xx+=state[i]*state[i^3];
  }
  return [1,z0,z1,zz,x0,x1,xx];
};
interface Network {w:number[][];b:number[];v:number[];out:number}
function fit(X:number[][],Y:number[]):Network {
  const neurons=8,dimensions=X[0].length;
  // Seeded, deterministic shallow neural readout on quantum-circuit features.
  const w=Array.from({length:neurons},(_,j)=>Array.from({length:dimensions},(_,i)=>0.18*Math.sin((j+1)*13+(i+1)*7)));
  const b=Array(neurons).fill(0),v=Array.from({length:neurons},(_,j)=>0.12*Math.cos(j*3+1));
  let out=0;
  for(let epoch=0;epoch<180;epoch++){
    const rate=0.012/(1+epoch/150);
    for(let row=0;row<X.length;row++){
      const hidden=w.map((weights,j)=>Math.tanh(b[j]+weights.reduce((sum,a,i)=>sum+a*X[row][i],0)));
      const estimate=out+hidden.reduce((sum,h,j)=>sum+h*v[j],0);
      const error=Math.max(-3,Math.min(3,estimate-Y[row]));
      const oldV=v.slice();
      for(let j=0;j<neurons;j++){
        v[j]-=rate*(error*hidden[j]+0.001*v[j]);
        const derivative=error*oldV[j]*(1-hidden[j]*hidden[j]);
        b[j]-=rate*derivative;
        for(let i=0;i<dimensions;i++)w[j][i]-=rate*(derivative*X[row][i]+0.001*w[j][i]);
      }
      out-=rate*error;
    }
  }
  return {w,b,v,out};
}
function infer(network:Network,x:number[]){
  return network.out+network.w.reduce((sum,weights,j)=>sum+network.v[j]*Math.tanh(network.b[j]+weights.reduce((a,b,i)=>a+b*x[i],0)),0);
}
function learn(history:Snapshot[],region:RegionId,origin:number){
  const points=history.filter(row=>Date.parse(row.at)<origin).sort((a,b)=>Date.parse(a.at)-Date.parse(b.at)).slice(-384);
  const actual=points.map(row=>({at:Date.parse(row.at),val:nodeAt(history,region,Date.parse(row.at))?.carbon_ci})).filter((a):a is {at:number;val:number}=>typeof a.val==='number');
  if(actual.length<48)return null;
  const mean=actual.reduce((s,r)=>s+r.val,0)/actual.length;
  const scale=Math.max(1,Math.sqrt(actual.reduce((s,r)=>s+(r.val-mean)**2,0)/actual.length));
  const X:number[][]=[],Y:number[]=[];
  for(let i=24;i<actual.length;i++){
    const prior=actual[i-1],day=actual[i-24],now=actual[i];
    if(now.at-prior.at!==HOUR||now.at-day.at!==24*HOUR)continue;
    X.push(features((prior.val-mean)/scale,(day.val-mean)/scale));Y.push((now.val-mean)/scale);
  }
  if(X.length<24)return null;
  const network=fit(X,Y);
  return {network,mean,scale,examples:X.length};
}
export function qennForecast(input:LabInput,region:RegionId){
  const origin=Date.parse(input.start);
  const model=learn(input.history,region,origin);
  if(!model)return {available:false as const,reason:'At least 48 hourly observations with 24-hour continuity are required.'};
  const timeline=new Map<number,number>();
  for(const row of input.history){const at=Date.parse(row.at);if(at<origin){const node=nodeAt(input.history,region,at);if(node)timeline.set(at,node.carbon_ci);}}
  const points=[];
  for(let hour=0;hour<input.horizon;hour++){
    const time=origin+hour*HOUR;
    const previous=timeline.get(time-HOUR),day=timeline.get(time-24*HOUR);
    const fallback=predictNode(input.history,region,time,origin)?.carbon_ci??null;
    const value=previous===undefined||day===undefined?fallback:Math.max(0,model.mean+model.scale*infer(model.network,features((previous-model.mean)/model.scale,(day-model.mean)/model.scale)));
    if(value!==null)timeline.set(time,value);
    points.push({hour,carbon:value});
  }
  // Chronological train/test separation, no future target leakage.
  const ordered=input.history.filter(row=>Date.parse(row.at)<origin).sort((a,b)=>Date.parse(a.at)-Date.parse(b.at));
  const split=Math.floor(ordered.length*0.8),train=ordered.slice(0,split),test=ordered.slice(split);
  let modelError=0,baseError=0,samples=0;
  if(train.length>=48){
    const trained=learn(train,region,Date.parse(test[0]?.at??input.start));
    if(trained)for(const row of test){
      const at=Date.parse(row.at),observed=nodeAt(input.history,region,at)?.carbon_ci;
      const prev=nodeAt(input.history,region,at-HOUR)?.carbon_ci,day=nodeAt(input.history,region,at-24*HOUR)?.carbon_ci;
      if(observed===undefined||prev===undefined||day===undefined)continue;
      const guess=Math.max(0,trained.mean+trained.scale*infer(trained.network,features((prev-trained.mean)/trained.scale,(day-trained.mean)/trained.scale)));
      modelError+=Math.abs(guess-observed);baseError+=Math.abs(day-observed);samples++;
    }
  }
  return {available:true as const,model:'Hybrid quantum-feature neural regressor (local simulation)',examples:model.examples,points,validation:{samples,qennMae:samples?modelError/samples:null,seasonalMae:samples?baseError/samples:null},note:'Experimental hybrid neural readout on simulated two-qubit circuit features, trained locally on past telemetry. Holdout test is one-step prediction using previous observed values; multi-step forecast uses its own predictions.'};
}
