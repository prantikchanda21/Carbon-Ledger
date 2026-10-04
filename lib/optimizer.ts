import type { EngineKind, NodeReport, OptimizationResult, PolicyFeatures, RegionId, ResolvedRequest } from './types.ts';
import { assess, buildPolicyFeatures, expandOnnxWeights, greedyAllocation, teacherHedgeFraction, weightCap } from './controllerMath.ts';
import { allocateTreasury, annualInterestInr, carbonAccounting } from './finance.ts';
import { FLEET_MWH_PER_DAY } from './constants.ts';
import { REGIONS } from './regions.ts';
import { residencyViolation } from './residency.ts';

export class ControllerInputError extends Error {}
export interface OnnxPolicyOutput { raw_weights: number[]; hedge_fraction: number; execution_ms: number; init_ms: number; }
export interface DispatchProblem { costs: number[]; eligible: boolean[]; cap: number; ids: RegionId[]; }
export interface ClassicalOutput { weights: number[]; execution_ms: number; init_ms: number; }
export interface Engines { onnx(features: PolicyFeatures): Promise<OnnxPolicyOutput>; classical(problem: DispatchProblem): Promise<ClassicalOutput>; }

const messageOf = (error: unknown): string => error instanceof Error ? error.message : String(error);
const round = (value: number, digits: number): number => { const f = 10 ** digits; return Math.round(value * f) / f; };
const nodeCost = (weights: number[], costs: number[]): number => weights.reduce((s, w, i) => s + w * costs[i], 0);

export async function optimize(req: ResolvedRequest, engines: Engines): Promise<OptimizationResult> {
  const { nodes, slaRelaxed } = assess(req);
  const eligible = nodes.map((n) => n.eligible);
  if (!eligible.some(Boolean)) throw new ControllerInputError('No node satisfies the data-residency rules for this request');
  const ids = nodes.map((n) => n.id);
  const costs = nodes.map((n) => n.unit_cost.total);
  const cap = weightCap(eligible.filter(Boolean).length);
  const features = buildPolicyFeatures(req, nodes);
  let engine: EngineKind = 'greedy-safe';
  let weights: number[] = [];
  let hedgeFraction = teacherHedgeFraction(features);
  let executionMs = 0;
  let initMs = 0;
  let fallbackReason: string | null = null;
  let onnxSucceeded = false;
  let onnxSolveMs: number | null = null;
  let glpkSolveMs: number | null = null;

  const runClassical = async (): Promise<ClassicalOutput> => engines.classical({ costs, eligible, cap, ids });

  if (req.chaos === 'onnx' || req.chaos === 'both') {
    fallbackReason = 'Chaos mode forced ONNX failure';
  } else {
    try {
      const out = await engines.onnx(features);
      const expanded = expandOnnxWeights(out.raw_weights, ids, eligible, nodes);
      if (expanded === null) throw new Error('Policy output has no weight on eligible nodes');
      engine = 'onnx';
      onnxSucceeded = true;
      weights = expanded;
      hedgeFraction = Math.min(1, Math.max(0, out.hedge_fraction));
      executionMs = out.execution_ms;
      initMs = out.init_ms;
      onnxSolveMs = out.execution_ms;
    } catch (error) {
      fallbackReason = `ONNX unavailable: ${messageOf(error)}`;
    }
  }

  let shadow: OptimizationResult['shadow'];
  if (!onnxSucceeded) {
    try {
      if (req.chaos === 'both') throw new Error('Chaos mode forced GLPK failure');
      const out = await runClassical();
      engine = 'glpk-wasm';
      weights = out.weights;
      executionMs = out.execution_ms;
      initMs = out.init_ms;
      glpkSolveMs = out.execution_ms;
    } catch (error) {
      fallbackReason = `${fallbackReason ?? 'ONNX bypassed'} | glpk.js unavailable: ${messageOf(error)}`;
      const t0 = performance.now();
      weights = greedyAllocation(costs, eligible, cap);
      executionMs = performance.now() - t0;
      initMs = 0;
      engine = 'greedy-safe';
    }
  }

  if (req.shadow && engine === 'onnx') {
    try {
      const optimal = await runClassical();
      glpkSolveMs = optimal.execution_ms;
      const surrogateCost = nodeCost(weights, costs);
      const optimalCost = nodeCost(optimal.weights, costs);
      shadow = {
        available: true,
        optimal_engine: 'glpk-wasm',
        optimal_cost_usd_per_kwh: round(optimalCost, 6),
        surrogate_cost_usd_per_kwh: round(surrogateCost, 6),
        cost_gap_pct: round(optimalCost > 0 ? ((surrogateCost - optimalCost) / optimalCost) * 100 : 0, 2),
      };
    } catch (error) {
      shadow = { available: false, optimal_engine: 'greedy-safe', optimal_cost_usd_per_kwh: 0, surrogate_cost_usd_per_kwh: nodeCost(weights, costs), cost_gap_pct: 0 };
      fallbackReason = `${fallbackReason ?? ''}${fallbackReason ? ' | ' : ''}shadow unavailable: ${messageOf(error)}`;
    }
  }

  const w = weights!;
  const cis = nodes.map((n) => n.telemetry.carbon_ci);
  const blendedCi = w.reduce((s, wi, i) => s + wi * cis[i], 0);
  const baselineCi = cis.reduce((a, b) => a + b, 0) / cis.length;
  const blendedUnitCost = nodeCost(w, costs);
  const treasury = allocateTreasury(hedgeFraction, req.budget_cr, req.carbon_tax, req.treasury_yield);
  const carbon = carbonAccounting({ blendedCi, baselineCi, carbonFuturesPct: treasury.carbon_futures_pct, budgetCr: req.budget_cr, carbonTax: req.carbon_tax });
  const used = nodes.filter((_, i) => w[i] > 0.005);
  const weightedLatency = w.reduce((s, wi, i) => s + wi * nodes[i].telemetry.latency_ms, 0);
  const maxUsedLatency = Math.max(0, ...used.map((n) => n.telemetry.latency_ms));
  const residencyOk = used.every((n) => residencyViolation(n.telemetry) === null);
  const excluded = nodes.filter((n) => !n.eligible && n.exclusion_reason !== null).map((n) => ({ region: n.id, reason: n.exclusion_reason as string }));
  const notes = excluded.map((e) => `${REGIONS[e.region].city} excluded: ${e.reason}`);
  if (slaRelaxed) notes.push(`No eligible node meets the ${req.sla_ms} ms SLA; routed to the lowest-latency compliant node (best effort)`);
  if (req.dpdp_locked) notes.push('DPDP residency lock active: workloads confined to Indian regions');
  const nodeReports: NodeReport[] = nodes.map((n, i) => ({
    id: n.id, city: REGIONS[n.id].city, region: n.telemetry.region, carbon_ci: n.telemetry.carbon_ci,
    energy_price: n.telemetry.energy_price, latency_ms: n.telemetry.latency_ms, renewable_pct: n.telemetry.renewable_pct ?? REGIONS[n.id].renewable_baseline_pct,
    unit_cost_usd_per_kwh: round(n.unit_cost.total, 5), weight: round(w[i], 4), eligible: n.eligible, exclusion_reason: n.exclusion_reason, source: n.telemetry.source,
  }));
  const nodeWeights = Object.fromEntries(nodes.map((n, i) => [n.id, round(w[i], 4)])) as Record<RegionId, number>;
  return {
    engine, fallback_reason: fallbackReason, allocations: { node_weights: nodeWeights, treasury, hedge_pct: round(treasury.green_bonds_pct + treasury.carbon_futures_pct, 2) },
    latency: { execution_ms: round(executionMs, 3), init_ms: round(initMs, 3), weighted_network_ms: round(weightedLatency, 2), max_used_latency_ms: round(maxUsedLatency, 2), sla_ms: req.sla_ms, sla_compliant: !slaRelaxed && maxUsedLatency <= req.sla_ms },
    carbon_avoided: { gross_tco2_per_day: round(carbon.gross_tco2_per_day, 2), net_footprint_mt: round(carbon.net_footprint_mt, 2), carbon_avoided_t: round(carbon.carbon_avoided_t, 2), offset_pct: round(carbon.offset_pct, 1), offset_roi_pct: round(carbon.offset_roi_pct, 1), blended_ci: round(blendedCi, 1), baseline_ci: round(baselineCi, 1), ci_shift_pct: round(((blendedCi - baselineCi) / baselineCi) * 100, 1) },
    treasury_income_inr: annualInterestInr(req.budget_cr, treasury.projected_apy),
    cost: { blended_unit_cost_usd_per_kwh: round(blendedUnitCost, 5), operating_cost_usd_per_day: round(blendedUnitCost * FLEET_MWH_PER_DAY * 1000, 2) },
    compliance: { status: slaRelaxed ? 'SLA_BREACH' : 'COMPLIANT', dpdp_locked: req.dpdp_locked, residency_ok: residencyOk, excluded, notes },
    nodes: nodeReports,
    shadow,
    engine_race: { onnx_ms: onnxSolveMs, glpk_ms: glpkSolveMs, target_ms: 3 },
    evaluation_key: req.evaluation_key,
    ai_architecture: { model_version: 'v3-qaoa-surrogate-20r', model_regions: 20, output_regions: 20, training_pipeline: 'qiskit-qaoa-reference' },
  };
}
