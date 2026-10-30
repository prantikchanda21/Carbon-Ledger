import type { Glpk, GlpkFactory, GlpkProblem } from 'glpk.js';
import type { ClassicalOutput, DispatchProblem } from './optimizer.ts';
import {capacityAt} from './fractionalAllocation.ts';

let instance: Promise<Glpk> | null = null;
let reportedInit = false;

function resolveFactory(mod: unknown): GlpkFactory {
  let current: unknown = mod;
  for (let depth = 0; depth < 3; depth += 1) {
    if (typeof current === 'function') return current as GlpkFactory;
    if (typeof current === 'object' && current !== null && 'default' in current) {
      current = (current as { default: unknown }).default;
    } else {
      break;
    }
  }
  throw new Error('glpk.js did not export a factory function');
}

export function loadGlpk(): Promise<Glpk> {
  if (instance === null) {
    instance = import('glpk.js')
      .then((mod) => Promise.resolve(resolveFactory(mod)()))
      .catch((error: unknown) => {
        instance = null;
        throw error;
      });
  }
  return instance;
}

/**
 * Classical fallback: a linear program solved by glpk.js (GLPK compiled to WebAssembly).
 *
 *   minimise   sum_i cost_i * w_i          (energy cost + carbon tax penalty + egress)
 *   subject to sum_i w_i = 1
 *              0 <= w_i <= cap             for nodes inside the SLA and residency bounds
 *              w_i = 0                     for excluded nodes
 */
export async function solveClassicalDispatch(problem: DispatchProblem): Promise<ClassicalOutput> {
  const started = performance.now();
  const glpk = await loadGlpk();
  const initMs = reportedInit ? 0 : performance.now() - started;
  reportedInit = true;

  const lp: GlpkProblem = {
    name: 'carbon-treasury-dispatch',
    objective: {
      direction: glpk.GLP_MIN,
      name: 'operating_cost',
      vars: [...problem.ids.map((id, i) => ({ name: id, coef: problem.costs[i] })), ...((problem.preferred && problem.regularization) ? problem.ids.map((_,i)=>({name:`deviation_${i}`,coef:problem.regularization!})):[])],
    },
    subjectTo: [
      {
        name: 'full_allocation',
        vars: problem.ids.map((id) => ({ name: id, coef: 1 })),
        bnds: { type: glpk.GLP_FX, ub: 1, lb: 1 },
      },
      ...((problem.preferred && problem.regularization) ? [
        ...problem.ids.map((id,i)=>({name:`target_${i}`,vars:[{name:id,coef:1},{name:`deviation_${i}`,coef:-1}],bnds:{type:glpk.GLP_UP,ub:problem.preferred![i]!,lb:0}})),
        ...problem.ids.map((id,i)=>({name:`target_inverse_${i}`,vars:[{name:id,coef:-1},{name:`deviation_${i}`,coef:-1}],bnds:{type:glpk.GLP_UP,ub:-problem.preferred![i]!,lb:0}})),
      ] : []),
    ],
    bounds: [...problem.ids.map((id, i) =>
      problem.eligible[i]
        ? { name: id, type: glpk.GLP_DB, lb: 0, ub: capacityAt(problem,i) }
        : { name: id, type: glpk.GLP_FX, lb: 0, ub: 0 },
    ),...((problem.preferred && problem.regularization)?problem.ids.map((_,i)=>({name:`deviation_${i}`,type:glpk.GLP_LO,lb:0,ub:0})):[])],
  };

  const solveStarted = performance.now();
  const solution = await Promise.resolve(glpk.solve(lp, { msglev: glpk.GLP_MSG_OFF }));
  const executionMs = performance.now() - solveStarted;

  if (solution.result.status !== glpk.GLP_OPT) {
    throw new Error(`glpk.js returned non-optimal status ${solution.result.status}`);
  }
  const weights = problem.ids.map((id) => {
    const value = solution.result.vars[id];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`glpk.js returned no value for ${id}`);
    }
    return Math.max(0, value);
  });
  return { weights, execution_ms: executionMs, init_ms: initMs };
}
