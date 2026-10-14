// Minimal typings for the subset of glpk.js used by lib/classicalWasmSolver.ts.
declare module 'glpk.js' {
  export interface GlpkLinearTerm {
    name: string;
    coef: number;
  }

  export interface GlpkRowBound {
    type: number;
    ub: number;
    lb: number;
  }

  export interface GlpkConstraint {
    name: string;
    vars: GlpkLinearTerm[];
    bnds: GlpkRowBound;
  }

  export interface GlpkVariableBound {
    name: string;
    type: number;
    ub: number;
    lb: number;
  }

  export interface GlpkObjective {
    direction: number;
    name: string;
    vars: GlpkLinearTerm[];
  }

  export interface GlpkProblem {
    name: string;
    objective: GlpkObjective;
    subjectTo: GlpkConstraint[];
    bounds?: GlpkVariableBound[];
  }

  export interface GlpkSolveOptions {
    msglev?: number;
    presol?: boolean;
  }

  export interface GlpkSolution {
    name: string;
    time: number;
    result: {
      z: number;
      status: number;
      vars: Record<string, number>;
    };
  }

  export interface Glpk {
    GLP_MIN: number;
    GLP_MAX: number;
    GLP_LO: number;
    GLP_UP: number;
    GLP_DB: number;
    GLP_FX: number;
    GLP_OPT: number;
    GLP_MSG_OFF: number;
    solve(problem: GlpkProblem, options?: GlpkSolveOptions): GlpkSolution | Promise<GlpkSolution>;
  }

  export type GlpkFactory = () => Glpk | Promise<Glpk>;

  const GLPK: GlpkFactory;
  export default GLPK;
}
