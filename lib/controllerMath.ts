import type { GridNodeTelemetry, NodeAssessment, PolicyFeatures, RegionId, ResolvedRequest, UnitCost } from './types.ts';
import { CARBON_TAX_USD_PER_KG_AT_MAX, DATA_GB_PER_KWH, FEATURE_MEAN, FEATURE_STD, MAX_NODE_SHARE } from './constants.ts';
import { REGION_ORDER, resolveRegionId } from './regions.ts';
import { generateTelemetry } from './mockData.ts';
import { residencyViolation, slaViolation } from './residency.ts';

export function clamp(value: number, min: number, max: number): number { return Math.min(max, Math.max(min, value)); }
export function unitCost(node: GridNodeTelemetry, carbonTax: number): UnitCost {
  const energy = node.energy_price / 1000;
  const carbon = carbonTax * CARBON_TAX_USD_PER_KG_AT_MAX * (node.carbon_ci / 1000);
  const egress = node.egress_cost_gb * DATA_GB_PER_KWH;
  return { energy, carbon, egress, total: energy + carbon + egress };
}
export interface Assessment { nodes: NodeAssessment[]; slaRelaxed: boolean; }

function assessSource(req: ResolvedRequest): NodeAssessment[] {
  const sourceNodes = new Map<RegionId, GridNodeTelemetry>();
  for (const node of req.telemetry) {
    const id = resolveRegionId(node.region);
    if (id) sourceNodes.set(id, node);
  }
  const order = REGION_ORDER.filter((id) => sourceNodes.has(id));
  return order.map((id) => {
    const telemetry = sourceNodes.get(id);
    if (!telemetry) throw new Error(`Telemetry is missing region ${id}`);
    const reason = (telemetry.available === false ? 'Region is unavailable' : null) ?? residencyViolation(telemetry) ?? slaViolation(telemetry, req.sla_ms);
    return { id, telemetry, eligible: reason === null, exclusion_reason: reason, unit_cost: unitCost(telemetry, req.carbon_tax) };
  });
}

export function assess(req: ResolvedRequest): Assessment {
  const strict = assessSource(req);
  if (strict.some((n) => n.eligible)) return { nodes: strict, slaRelaxed: false };
  const residencyOk = strict.filter((n) => residencyViolation(n.telemetry) === null && n.telemetry.available !== false);
  if (residencyOk.length === 0) return { nodes: strict, slaRelaxed: false };
  const best = Math.min(...residencyOk.map((n) => n.telemetry.latency_ms));
  const nodes = strict.map((n) => residencyViolation(n.telemetry) === null && n.telemetry.available !== false && n.telemetry.latency_ms === best
    ? { ...n, eligible: true, exclusion_reason: null } : n);
  return { nodes, slaRelaxed: true };
}
export function weightCap(eligibleCount: number): number {
  if (eligibleCount <= 1) return 1;
  return Math.max(MAX_NODE_SHARE, 1 / eligibleCount);
}
export function greedyAllocation(costs: number[], eligible: boolean[], cap: number): number[] {
  const weights = costs.map(() => 0);
  const order = costs.map((_, i) => i).filter((i) => eligible[i]).sort((a, b) => costs[a] - costs[b]);
  let remaining = 1;
  for (const i of order) { const take = Math.min(cap, remaining); weights[i] = take; remaining -= take; if (remaining <= 1e-12) break; }
  return weights;
}
export function projectWeights(raw: number[], eligible: boolean[]): number[] | null {
  const masked = raw.map((w, i) => (eligible[i] && Number.isFinite(w) && w > 0 ? w : 0));
  const total = masked.reduce((a, b) => a + b, 0);
  if (total <= 1e-9) return null;
  return masked.map((w) => w / total);
}
export function buildPolicyFeatures(req: ResolvedRequest, nodes: NodeAssessment[]): PolicyFeatures {
  const pool = nodes.filter((n) => n.eligible);
  const source = pool.length ? pool : nodes;
  const mean = (pick: (n: NodeAssessment) => number): number => source.reduce((sum, n) => sum + pick(n), 0) / Math.max(1, source.length);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const fallbackHour = req.telemetry.find((n) => typeof n.timestamp === 'number')?.timestamp ?? Date.now();
  const fallbackTelemetry = new Map(generateTelemetry(new Date(fallbackHour), req.dpdp_locked, true).map((n) => [resolveRegionId(n.region), n] as const));
  const modelInput: number[] = [];
  for (const id of REGION_ORDER) {
    const node = byId.get(id);
    const t = node?.telemetry ?? fallbackTelemetry.get(id);
    const carbon = t?.carbon_ci ?? 500;
    const price = t?.energy_price ?? 90;
    const latency = t?.latency_ms ?? 80;
    const egress = t?.egress_cost_gb ?? 0.08;
    modelInput.push(
      Math.max(-4, Math.min(4, (carbon - 350) / 300)),
      Math.max(-4, Math.min(4, (price - 85) / 45)),
      Math.max(-4, Math.min(4, (latency - 45) / 45)),
      Math.max(-4, Math.min(4, (egress - 0.07) / 0.05)),
    );
  }
  modelInput.push(
    Math.max(-4, Math.min(4, (req.treasury_yield - 7) / 2)),
    Math.max(-4, Math.min(4, (req.carbon_tax - 0.5) / 0.5)),
    Math.max(-4, Math.min(4, (req.sla_ms - 50) / 40)),
    Math.max(-4, Math.min(4, (req.budget_cr - 50) / 50)),
  );
  return {
    carbon_intensity: mean((n) => n.telemetry.carbon_ci) * (0.5 + req.carbon_tax),
    energy_price: mean((n) => n.telemetry.energy_price),
    treasury_yield: req.treasury_yield,
    latency_sla: req.sla_ms,
    model_input: modelInput,
  };
}
export function teacherHedgeFraction(f: PolicyFeatures): number {
  const zc = (f.carbon_intensity - FEATURE_MEAN[0]) / FEATURE_STD[0];
  const zy = (f.treasury_yield - FEATURE_MEAN[2]) / FEATURE_STD[2];
  const logit = -0.2 + 0.5 * zy + 0.4 * zc;
  return 1 / (1 + Math.exp(-logit));
}

/**
 * Supports both the legacy 3-region ONNX head and the v3 20-region head.
 * The v3 model emits one logit per catalog region; this adapter masks ineligible nodes
 * and projects the result onto the controller's configured regions.
 */
export function expandOnnxWeights(raw: number[], ids: RegionId[], eligible: boolean[], nodes: NodeAssessment[]): number[] | null {
  if (raw.length >= REGION_ORDER.length) {
    const global = new Map<RegionId, number>();
    for (let i = 0; i < REGION_ORDER.length; i += 1) {
      const value = raw[i];
      global.set(REGION_ORDER[i]!, Number.isFinite(value) ? value : 0);
    }
    const out = ids.map((id) => global.get(id) ?? 0);
    const positive = out.map((v, i) => (eligible[i] ? Math.max(0, v) : 0));
    const max = Math.max(...positive);
    if (max <= 1e-8) return null;
    return projectWeights(positive, eligible);
  }

  const macroAnchors: Record<string, number> = { asia: Math.max(0, raw[0] ?? 0), europe: Math.max(0, raw[1] ?? 0), americas: Math.max(0, raw[2] ?? 0) };
  const macroNodes: Record<string, number[]> = { asia: [], europe: [], americas: [] };
  nodes.forEach((n, i) => macroNodes[n.id && ['mumbai','hyderabad','delhi','singapore','tokyo','seoul','sydney'].includes(n.id) ? 'asia' : ['frankfurt','dublin','london','stockholm','paris','madrid','zurich'].includes(n.id) ? 'europe' : 'americas'].push(i));
  const out = ids.map(() => 0);
  for (const macro of Object.keys(macroNodes)) {
    const idxs = macroNodes[macro] ?? [];
    const eligibleIdxs = idxs.filter((i) => eligible[i]);
    const totalScore = eligibleIdxs.reduce((sum, i) => sum + 1 / Math.max(0.05, nodes[i]!.unit_cost.total), 0);
    if (totalScore <= 0) continue;
    for (const i of eligibleIdxs) out[i] = macroAnchors[macro] * (1 / Math.max(0.05, nodes[i]!.unit_cost.total)) / totalScore;
  }
  return projectWeights(out, eligible);
}
