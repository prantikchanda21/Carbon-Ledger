import type { LabInput } from './types';
import { prepareWorkloadObjective } from './workloadQuantum';
import { fitBinaryQubo } from './quboMath';

/** Quadratic projection and exhaustive residual check for the workload energy landscape.
 * Nonzero residual proves auxiliary variables or a different penalty encoding is required.
 */
export function inspectWorkloadQubo(input: LabInput, qubits=8) {
  const obj=prepareWorkloadObjective(input,qubits);
  const n=obj.jobs.length;
  const feasible=obj.costs.filter((_,i)=>obj.valid[i]);
  if(!feasible.length) throw new Error('No feasible assignments to map.');
  const minCost=Math.min(...obj.costs);
  const span=Math.max(1, Math.max(...obj.costs)-minCost);
  const penalty=4;
  const energy=obj.costs.map((c,i)=>(c-minCost)/span+(obj.valid[i]?0:penalty));
  const {constant,linear,quadratic,maxResidual,exact}=fitBinaryQubo(energy,n);
  // H = offset + sum h_i Z_i + sum J_ij Z_i Z_j, x=(1-Z)/2.
  const fields=linear.map((a,i)=>-a/2-quadratic[i].reduce((s,b)=>s+b/4,0)-quadratic.reduce((s,row,j)=>s+(j<i?row[i]/4:0),0));
  const coupling=quadratic.map(row=>row.map(q=>q/4));
  const offset=constant+linear.reduce((s,v)=>s+v/2,0)+quadratic.reduce((s,row)=>s+row.reduce((s,v)=>s+v/4,0),0);
  return {jobs:obj.jobs,constant,linear,quadratic,ising:{offset,fields,coupling},penalty,maxResidual,exact,states:energy.length,
    note:exact?'Exact quadratic encoding on all enumerated configurations.':'Quadratic projection only; higher-order feasibility interactions require auxiliary variables or a revised QUBO encoding. Quantum solvers continue using their original exact energy table.'};
}
