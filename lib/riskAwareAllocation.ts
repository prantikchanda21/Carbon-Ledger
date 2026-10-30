/** Risk-aware allocation postprocessor shared by every live optimization engine.
 * Candidate search is classical; IQAE-style risk statistics are simulated in estimateRisk.
 * The risk reduction is NOT a claim of quantum speedup or Qiskit execution.
 */
import type {OptimizationResult, ControlState, RegionId} from './types.ts';
import {applyOverride,capacitiesOf,normalizeWeights} from './override.ts';
import {estimateRisk,scenarioRisk,type RiskReport} from './quantumRiskIqae.ts';

export type RiskDecision={result:OptimizationResult;before:RiskReport;after:RiskReport;changed:boolean;status:'accepted'|'reallocated'|'unresolved';attempts:number;threshold:number;costChangePct:number;lowestRiskFound:number;lowestUpperBoundFound:number;validCandidates:number;searchExhaustive:false;};
const seedFor=(key:string)=>{let h=2166136261;for(const c of key)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;};
function inputs(result:OptimizationResult,seed:number){return {weights:result.allocations.node_weights,carbon:result.carbon_avoided.blended_ci,latency:result.latency.weighted_network_ms,sla:result.latency.sla_ms,seed};}
export function riskAwareAllocation(base:OptimizationResult,controls:ControlState,thresholdPct:number,scenarioKey:string):RiskDecision{
 const threshold=thresholdPct/100,seed=seedFor(scenarioKey+':risk');
 const before=estimateRisk(inputs(base,seed),threshold);
 const accepted=(result:OptimizationResult,after:RiskReport,changed:boolean,status:RiskDecision['status'],attempts:number,validCandidates:number,lowestRiskFound:number,lowestUpperBoundFound:number):RiskDecision=>({
   result,before,after,changed,status,attempts,validCandidates,lowestRiskFound,lowestUpperBoundFound,searchExhaustive:false,threshold,
   costChangePct:(result.cost.operating_cost_usd_per_day/Math.max(1e-9,base.cost.operating_cost_usd_per_day)-1)*100
 });
 if(!before.riskFlag)return accepted(base,before,false,'accepted',0,0,before.exact,before.iqaeInterval[1]);
 const caps=capacitiesOf(base,controls),original=base.allocations.node_weights;
 const eligible=base.nodes.filter(n=>n.eligible&&(caps[n.id]??0)>0);
 if(eligible.length<2)return accepted(base,before,false,'unresolved',0,0,before.exact,before.iqaeInterval[1]);
 const eligMap=Object.fromEntries(base.nodes.map(n=>[n.id,n.eligible])) as Record<RegionId,boolean>;
 const maxCost=Math.max(1e-9,...eligible.map(n=>n.unit_cost_usd_per_kwh));
 const rawCandidates:{candidate:OptimizationResult;exact:number;penalty:number;movement:number}[]=[];
 const seen=new Set<string>();
 let attempts=0,validCandidates=0;
 // Deterministic bounded search: diverse carbon, latency, cost and dispersion objectives.
 // This is a sampled feasible search, NOT a proof of a global risk minimum.
 const profiles:[[number,number,number],...Array<[number,number,number]>]=[[.4,.3,.3],[0,0,0],[1,0,0],[0,1,0],[0,0,1],[.5,0,.5]];
 for(const blend of [.15,.35,.55,.75,1])for(const rank of [0,.5,1,2,4,8,16])for(const [wc,wl,wp] of profiles){
  const raw={} as Record<RegionId,number>;
  for(const node of eligible){
   const carbon=node.carbon_ci/600,cost=node.unit_cost_usd_per_kwh/maxCost,latency=node.latency_ms/Math.max(1,controls.sla_ms);
   raw[node.id]=(1-blend)*(original[node.id]??0)+blend/(eligible.length*(1+rank*(wc*carbon+wl*latency+wp*cost)));
  }
  const normalized=normalizeWeights(raw,eligMap,caps);
  if(!normalized)continue;
  const key=eligible.map(n=>(normalized[n.id]??0).toFixed(6)).join(':');
  if(seen.has(key))continue;
  seen.add(key);attempts++;
  const candidate=applyOverride(base,normalized,{budget_cr:controls.budget_cr,carbon_tax:controls.carbon_tax});
  if(Math.abs(Object.values(candidate.allocations.node_weights).reduce((s,w)=>s+w,0)-1)>0.001 || !candidate.latency.sla_compliant || candidate.nodes.some(n=>!n.eligible&&n.weight>1e-6))continue;
  if(candidate.nodes.some(n=>(candidate.allocations.node_weights[n.id]??0)>(caps[n.id]??0)+1e-7))continue;
  validCandidates++;
  const exact=scenarioRisk(inputs(candidate,seed)).exact;
  const penalty=Math.max(0,(candidate.cost.operating_cost_usd_per_day-base.cost.operating_cost_usd_per_day)/Math.max(1,base.cost.operating_cost_usd_per_day));
  const movement=eligible.reduce((s,n)=>s+Math.abs((original[n.id]??0)-(candidate.allocations.node_weights[n.id]??0)),0);
  rawCandidates.push({candidate,exact,penalty,movement});
 }
 rawCandidates.sort((a,b)=>a.exact-b.exact || a.penalty-b.penalty);
 let lowestRiskFound=Math.min(before.exact,...rawCandidates.map(x=>x.exact));
 let lowestUpperBoundFound=before.iqaeInterval[1];
 // Run the expensive IQAE-style estimator on the most promising exact-model candidates.
 // Include diverse low-cost choices too; MC is not used to rank or gate allocations.
 const shortlist=rawCandidates.slice(0,32);
 for(const c of [...rawCandidates].sort((a,b)=>a.penalty-b.penalty).slice(0,8))if(!shortlist.includes(c))shortlist.push(c);
 let winner:{candidate:OptimizationResult;report:RiskReport;score:number}|null=null;
 for(const item of shortlist){
  if(item.exact>=before.exact-1e-8)continue;
  const report=estimateRisk(inputs(item.candidate,seed),threshold);
  lowestUpperBoundFound=Math.min(lowestUpperBoundFound,report.iqaeInterval[1]);
  const score=report.riskFlag?10+report.iqaeInterval[1]+.01*item.penalty:item.movement+.01*item.penalty;
  if(!winner || score<winner.score)winner={candidate:item.candidate,report,score};
 }
 const best=winner?.candidate??base,after=winner?.report??before;
 const changed=best!==base&&eligible.some(n=>Math.abs((original[n.id]??0)-(best.allocations.node_weights[n.id]??0))>1e-5);
 const result=changed?{...best,manual_override:undefined,compliance:{...best.compliance,notes:[...best.compliance.notes.filter(n=>n!=='Manual allocation override active'),'Risk-aware postprocessor: classical candidate search + simulated IQAE risk gate.']}}:base;
 return accepted(result,after,changed,after.riskFlag?'unresolved':changed?'reallocated':'accepted',attempts,validCandidates,lowestRiskFound,lowestUpperBoundFound);
}
