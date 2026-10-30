import {loadGlpk} from './classicalWasmSolver.ts';
import type { GlpkProblem } from 'glpk.js';
import type { DispatchProblem } from './optimizer.ts';
import {capacityAt} from './fractionalAllocation.ts';
export async function solveResidualDispatch(p:DispatchProblem,chosen:number,commitment:number):Promise<number[]>{
 const glpk=await loadGlpk();
 const bounds:NonNullable<GlpkProblem["bounds"]>=p.ids.map((id,i)=>{const max=p.eligible[i]?capacityAt(p,i)-(i===chosen?commitment:0):0;if(max < -1e-9)throw Error('Commitment exceeds capacity');return {name:id,type: max<=0?glpk.GLP_FX:glpk.GLP_DB,lb:0,ub:Math.max(0,max)};});
 const model:GlpkProblem={name:'quantum-classical-cooperative-residual',objective:{direction:glpk.GLP_MIN,name:'residual_cost',vars:[...p.ids.map((id,i)=>({name:id,coef:p.costs[i]})),...((p.preferred&&p.regularization)?p.ids.map((_,i)=>({name:`deviation_${i}`,coef:p.regularization!})):[])]},subjectTo:[{name:'remaining_load',vars:p.ids.map(id=>({name:id,coef:1})),bnds:{type:glpk.GLP_FX,lb:1-commitment,ub:1-commitment}}],bounds};
 if(p.preferred&&p.regularization){
  for(let i=0;i<p.ids.length;i++){
   const id=p.ids[i]!,target=p.preferred[i]!-(i===chosen?commitment:0);
   model.subjectTo.push({name:`target_${i}`,vars:[{name:id,coef:1},{name:`deviation_${i}`,coef:-1}],bnds:{type:glpk.GLP_UP,ub:target,lb:0}});
   model.subjectTo.push({name:`target_inverse_${i}`,vars:[{name:id,coef:-1},{name:`deviation_${i}`,coef:-1}],bnds:{type:glpk.GLP_UP,ub:-target,lb:0}});
   bounds.push({name:`deviation_${i}`,type:glpk.GLP_LO,lb:0,ub:0});
  }
 }
 const solved=await Promise.resolve(glpk.solve(model,{msglev:glpk.GLP_MSG_OFF}));
 if(solved.result.status!==glpk.GLP_OPT)throw Error('No feasible GLPK completion after quantum decision');
 return p.ids.map(id=>Number(solved.result.vars[id]??0));
}
