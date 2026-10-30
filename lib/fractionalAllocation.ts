import type {DispatchProblem} from './optimizer.ts';
import type {ControlState,NodeReport} from './types.ts';

/** Scenario-dependent modeled capacity and target shares. No actual provider quota is asserted. */
export function fractionalAllocationPolicy(nodes:NodeReport[], controls:ControlState, costs:number[]){
 const eligible=nodes.map(n=>n.eligible);
 const indices=nodes.map((_,i)=>i).filter(i=>eligible[i]);
 if(!indices.length)throw Error('No eligible region');
 const maxCost=Math.max(...indices.map(i=>costs[i]!));
 const minCost=Math.min(...indices.map(i=>costs[i]!));
 const spread=Math.max(0.05,maxCost-minCost);
 const signals=nodes.map((n,i)=>!eligible[i]?0:Math.exp(-2.4*(costs[i]!-minCost)/spread)*(0.75+0.25*Math.min(1,Math.max(0,n.renewable_pct/100))));
 const sum=signals.reduce((a,b)=>a+b,0);
 const preferred=signals.map(v=>v/sum);
 // Capacities are a transparent heuristic for demonstration, not measured datacenter capacities.
 // Allocate enough aggregate headroom for a feasible LP, with heterogeneity depending on latency, price and renewables.
 const base=Math.max(1/indices.length, Math.min(0.82,3.0/indices.length));
 const caps=nodes.map((n,i)=>!eligible[i]?0:Math.min(1,Math.max(base*0.6,base*(0.72+0.52*Math.min(1,n.renewable_pct/100)+0.28*(1-Math.min(1,n.latency_ms/Math.max(1,controls.sla_ms)))))));
 const totalCap=caps.reduce((a,b)=>a+b,0);
 if(totalCap<1){for(const i of indices)caps[i]=Math.min(1,caps[i]!/totalCap*1.01);}
 return {caps,preferred,regularization:0.65*spread,capacitySource:'modeled' as const};
}

export function capacityAt(p:DispatchProblem,i:number){return p.eligible[i]?Math.max(0,Math.min(1,p.caps?.[i]??p.cap)):0;}
