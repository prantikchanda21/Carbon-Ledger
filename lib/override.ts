import type { OptimizationResult, RegionId } from './types.ts';
import { REGION_ORDER } from './regions.ts';
import { weightCap } from './controllerMath.ts';
import { carbonAccounting } from './finance.ts';
import { FLEET_MWH_PER_DAY } from './constants.ts';

export type Weights = Record<RegionId, number>;

const round = (value: number, digits: number): number => { const f = 10 ** digits; return Math.round(value * f) / f; };
const zeros = (): Weights => Object.fromEntries(REGION_ORDER.map((id) => [id, 0])) as Weights;

/** Per-region cap for the nodes that are currently eligible. */
export function capFor(eligible: Record<RegionId, boolean>): number {
  return weightCap(REGION_ORDER.filter((id) => eligible[id]).length);
}

export function eligibilityOf(result: OptimizationResult): Record<RegionId, boolean> {
  const map = Object.fromEntries(REGION_ORDER.map((id) => [id, false])) as Record<RegionId, boolean>;
  for (const node of result.nodes) map[node.id] = node.eligible;
  return map;
}

/** Spreads `total` across items proportionally to `seed`, never exceeding `cap` per item (water-filling). */
function distribute(seed: number[], total: number, cap: number): number[] {
  const out = seed.map(() => 0);
  let free = seed.map((_, i) => i);
  let remaining = total;
  while (free.length > 0 && remaining > 1e-12) {
    const sum = free.reduce((a, i) => a + seed[i], 0);
    const share = (i: number): number => (sum > 1e-12 ? seed[i] / sum : 1 / free.length);
    const over = free.filter((i) => remaining * share(i) > cap + 1e-12);
    if (over.length === 0) {
      for (const i of free) out[i] = remaining * share(i);
      break;
    }
    for (const i of over) { out[i] = cap; remaining -= cap; }
    free = free.filter((i) => !over.includes(i));
  }
  return out;
}

/** Masks ineligible regions, caps every region and rescales so the total is exactly 100%. Null when nothing eligible has weight. */
export function normalizeWeights(raw: Partial<Weights>, eligible: Record<RegionId, boolean>, cap = capFor(eligible)): Weights | null {
  const ids = REGION_ORDER.filter((id) => eligible[id]);
  if (ids.length === 0) return null;
  const seed = ids.map((id) => { const w = raw[id] ?? 0; return Number.isFinite(w) && w > 0 ? w : 0; });
  if (seed.reduce((a, b) => a + b, 0) <= 1e-9) return null;
  const spread = distribute(seed, 1, cap);
  const out = zeros();
  ids.forEach((id, i) => { out[id] = spread[i]; });
  return out;
}

/** Sets one region to `value`; every other eligible region is rescaled so the total stays at 100%. */
export function rebalanceWeights(current: Weights, id: RegionId, value: number, eligible: Record<RegionId, boolean>): Weights {
  if (!eligible[id]) return current;
  const cap = capFor(eligible);
  const others = REGION_ORDER.filter((r) => r !== id && eligible[r]);
  if (others.length === 0) return { ...zeros(), [id]: 1 };
  // The others can hold at most cap each, so this region has a floor.
  const floor = Math.max(0, 1 - cap * others.length);
  const v = Math.min(cap, Math.max(floor, Number.isFinite(value) ? value : 0));
  const seed = others.map((r) => current[r] ?? 0);
  const usable = seed.reduce((a, b) => a + b, 0) > 1e-9 ? seed : others.map(() => 1);
  const spread = distribute(usable, 1 - v, cap);
  const out = zeros();
  out[id] = v;
  others.forEach((r, i) => { out[r] = spread[i]; });
  return out;
}

export function evenSplit(eligible: Record<RegionId, boolean>): Weights | null {
  const raw = zeros();
  for (const id of REGION_ORDER) raw[id] = eligible[id] ? 1 : 0;
  return normalizeWeights(raw, eligible);
}

/**
 * Re-evaluates an optimizer result under hand-set weights. Costs, carbon, latency and compliance are
 * recomputed from the per-node figures; the treasury split is unchanged. Returns the base result if the
 * override no longer fits any eligible region.
 */
export function applyOverride(base: OptimizationResult, override: Partial<Weights>, ctx: { budget_cr: number; carbon_tax: number }): OptimizationResult {
  const eligible = eligibilityOf(base);
  const w = normalizeWeights(override, eligible);
  if (!w) return base;

  const nodes = base.nodes.map((n) => ({ ...n, weight: round(w[n.id] ?? 0, 4) }));
  const used = nodes.filter((n) => n.weight > 0.005);
  const blendedCi = nodes.reduce((s, n) => s + (w[n.id] ?? 0) * n.carbon_ci, 0);
  const unitCost = nodes.reduce((s, n) => s + (w[n.id] ?? 0) * n.unit_cost_usd_per_kwh, 0);
  const optimizerCost = base.nodes.reduce((s, n) => s + n.weight * n.unit_cost_usd_per_kwh, 0);
  const weightedLatency = nodes.reduce((s, n) => s + (w[n.id] ?? 0) * n.latency_ms, 0);
  const maxUsedLatency = Math.max(0, ...used.map((n) => n.latency_ms));
  const baselineCi = base.carbon_avoided.baseline_ci;
  const carbon = carbonAccounting({
    blendedCi, baselineCi, carbonFuturesPct: base.allocations.treasury.carbon_futures_pct,
    budgetCr: ctx.budget_cr, carbonTax: ctx.carbon_tax,
  });
  const slaRelaxed = base.compliance.status === 'SLA_BREACH';

  return {
    ...base,
    allocations: { ...base.allocations, node_weights: Object.fromEntries(nodes.map((n) => [n.id, n.weight])) as Weights },
    latency: { ...base.latency, weighted_network_ms: round(weightedLatency, 2), max_used_latency_ms: round(maxUsedLatency, 2), sla_compliant: !slaRelaxed && maxUsedLatency <= base.latency.sla_ms },
    carbon_avoided: {
      gross_tco2_per_day: round(carbon.gross_tco2_per_day, 2), net_footprint_mt: round(carbon.net_footprint_mt, 2),
      carbon_avoided_t: round(carbon.carbon_avoided_t, 2), offset_pct: round(carbon.offset_pct, 1), offset_roi_pct: round(carbon.offset_roi_pct, 1),
      blended_ci: round(blendedCi, 1), baseline_ci: baselineCi, ci_shift_pct: round(((blendedCi - baselineCi) / baselineCi) * 100, 1),
    },
    cost: { blended_unit_cost_usd_per_kwh: round(unitCost, 5), operating_cost_usd_per_day: round(unitCost * FLEET_MWH_PER_DAY * 1000, 2) },
    compliance: { ...base.compliance, notes: [...base.compliance.notes, 'Manual allocation override active'] },
    nodes,
    manual_override: {
      active: true,
      cost_gap_pct: round(optimizerCost > 0 ? ((unitCost - optimizerCost) / optimizerCost) * 100 : 0, 2),
      optimizer_blended_ci: base.carbon_avoided.blended_ci,
    },
  };
}
