import type {OptimizationResult,RegionId,ControlState} from './types.ts';
import {applyOverride} from './override.ts';

/** The exact scheduler policy shared by the selected allocation and GLPK reference. */
export function applyComparableScheduler(hybridResult:OptimizationResult,schedulerWeights:Record<RegionId,number>|undefined,controls:ControlState){
 if(!schedulerWeights)return null;
    // Preserve the 50% preference strength, but backtrack when the full change breaks the SLA.
    // Never claim an adjustment was applied if caps/eligibility projection removes its effect.
    const original=hybridResult.allocations.node_weights;
    const demand=schedulerWeights;
    const context={budget_cr:controls.budget_cr,carbon_tax:controls.carbon_tax};
    let best=hybridResult;
    let strength=0;
    const changes=(weights:Record<string,number>)=>hybridResult.nodes.reduce((sum,node)=>sum+Math.abs((weights[node.id]??0)-(original[node.id]??0)),0)/2;
    const proposedWeights=Object.fromEntries(hybridResult.nodes.map(node=>[node.id,.5*(original[node.id]??0)+.5*(demand[node.id]??0)]));
    const proposed=applyOverride(hybridResult,proposedWeights,context);
    const proposalMovement=changes(proposed.allocations.node_weights);
    // Largest feasible prefix of the line joining engine weights and scheduler weights.
    // Backtracking also works when a 50% mix violates the SLA but a smaller mix does not.
    for(const factor of [1,.75,.5,.25,.125,.0625,.03125,.015625]){
      const candidate=factor===1?proposed:applyOverride(hybridResult,Object.fromEntries(hybridResult.nodes.map(node=>[node.id,(1-.5*factor)*(original[node.id]??0)+.5*factor*(demand[node.id]??0)])),context);
      if(candidate.latency.sla_compliant && changes(candidate.allocations.node_weights)>1e-6){best=candidate;strength=.5*factor;break;}
    }
    return {result:best,proposal:proposed,proposalMovement,appliedMovement:changes(best.allocations.node_weights),strength,status:strength>0?'applied':proposalMovement<1e-6?'no-change':'blocked' as 'applied'|'no-change'|'blocked'};
}
