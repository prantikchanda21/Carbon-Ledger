/** Deterministic, independently inspectable verification of the browser's ideal IQAE proxy.
 * This is NOT validation of genuine quantum circuits or production failure probabilities.
 */
import {estimateRisk,scenarioRisk,type RiskInputs} from './quantumRiskIqae';
import type {RiskDecision} from './riskAwareAllocation';
export type VerificationCheck={id:string;name:string;pass:boolean;observed:string;expected:string};
export type VerificationResult={checks:VerificationCheck[];time:string;seed:number;context:string};
const fmt=(v:number)=>(v*100).toFixed(3)+'%';
const close=(a:number,b:number,tolerance=1e-12)=>Math.abs(a-b)<=tolerance;
export function verifyIqaeRisk(input:RiskInputs,thresholdPct:number,enabled:boolean,decision:RiskDecision|null,context:string):VerificationResult{
 const base=scenarioRisk(input).exact;
 const estimated=estimateRisk(input,thresholdPct/100);
 const same=estimateRisk(input,thresholdPct/100);
 const keys=Object.keys(input.weights).filter(k=>input.weights[k]>0);
 const alternative={...input.weights};
 if(keys.length>1){const amount=alternative[keys[0]]*0.4;alternative[keys[0]]-=amount;alternative[keys[1]]+=amount;}
 const altered=scenarioRisk({...input,weights:alternative}).exact;
 const stressful=scenarioRisk({...input,latency:input.latency+Math.max(10,input.sla*0.5),carbon:input.carbon+150}).exact;
 const strict=estimated.iqaeInterval[1]>0.01;
 const loose=estimated.iqaeInterval[1]>0.20;
 const decisionOkay=!enabled || (decision!==null && (decision.changed
   ? Object.keys(decision.before ? decision.result.allocations.node_weights : {}).length>0 && decision.attempts>0 && decision.status!=='accepted'
   : decision.status!=='reallocated'));
 const checks:VerificationCheck[]=[
  {id:'allocation',name:'Allocation input sensitivity',pass:keys.length>1&&Math.abs(altered-base)>1e-8,observed:`Original ${fmt(base)} → perturbed ${fmt(altered)}`,expected:'Changing allocations changes model probability'},
  {id:'stress',name:'Stress scenario response',pass:stressful>=base-1e-12&&stressful>base+1e-7,observed:`Normal ${fmt(base)} → stressed ${fmt(stressful)}`,expected:'Higher latency and carbon pressure increases risk'},
  {id:'threshold',name:'Risk policy threshold',pass:(!loose||strict)&&((estimated.iqaeInterval[1]>thresholdPct/100)===estimated.riskFlag),observed:`Upper bound ${fmt(estimated.iqaeInterval[1])}; limit ${thresholdPct}%`,expected:'Flag exactly when upper bound exceeds chosen limit; stricter limits never reduce flags'},
  {id:'feedback',name:'Allocation feedback consistency',pass:decisionOkay,observed:!enabled?'Automatic mode disabled':!decision?'No controller result available':`${decision.status}; changed=${decision.changed}; candidates=${decision.attempts}`,expected:'Reallocation is reported only when allocation weights change; monitoring does not reallocate'},
  {id:'reference',name:'Exact probability comparison',pass:Math.abs(estimated.probability-base)<=0.03&&estimated.iqaeInterval[0]<=base&&estimated.iqaeInterval[1]>=base,observed:`Ideal estimate ${fmt(estimated.probability)} vs exact ${fmt(base)}; interval ${fmt(estimated.iqaeInterval[0])}–${fmt(estimated.iqaeInterval[1])}`,expected:'Absolute error ≤3 percentage points and exact value within estimated interval'},
  {id:'repeat',name:'Seeded repeatability',pass:close(same.probability,estimated.probability)&&close(same.mc,estimated.mc)&&close(same.exact,estimated.exact),observed:`Run A ${fmt(estimated.probability)} / run B ${fmt(same.probability)}`,expected:'Identical input and seed produce identical outcomes'}
 ];
 return {checks,time:new Date().toISOString(),seed:input.seed,context};
}
