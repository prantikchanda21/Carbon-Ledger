import test from 'node:test';
import assert from 'node:assert/strict';
import { generateTelemetry } from '../lib/mockData.ts';
import { optimize, type Engines } from '../lib/optimizer.ts';
import { greedyAllocation } from '../lib/controllerMath.ts';
import { REGION_ORDER } from '../lib/regions.ts';
import { applyOverride, capFor, eligibilityOf, evenSplit, normalizeWeights, rebalanceWeights, type Weights } from '../lib/override.ts';
import type { ResolvedRequest } from '../lib/types.ts';

const engines: Engines = {
  onnx: async () => { throw new Error('offline'); },
  classical: async (p) => ({ weights: greedyAllocation(p.costs, p.eligible, p.cap), execution_ms: 0.1, init_ms: 0 }),
};
const request = (patch: Partial<ResolvedRequest> = {}): ResolvedRequest => ({
  telemetry: generateTelemetry(new Date('2026-10-04T12:00:00Z'), false, true),
  sla_ms: 100, carbon_tax: 0.5, budget_cr: 50, treasury_yield: 6.8, dpdp_locked: false, shadow: false, chaos: 'none', ...patch,
});
const sum = (w: Weights): number => REGION_ORDER.reduce((s, id) => s + (w[id] ?? 0), 0);

test('rebalance keeps total at 100%, respects the cap and leaves excluded regions at zero', async () => {
  const base = await optimize(request({ sla_ms: 60 }), engines);
  const eligible = eligibilityOf(base);
  const cap = capFor(eligible);
  const target = REGION_ORDER.find((id) => eligible[id])!;
  for (const value of [0, 0.2, 0.5, 0.95, 1]) {
    const next = rebalanceWeights(base.allocations.node_weights, target, value, eligible);
    assert.ok(Math.abs(sum(next) - 1) < 1e-9, `sum for ${value}`);
    for (const id of REGION_ORDER) {
      assert.ok(next[id] <= cap + 1e-9);
      if (!eligible[id]) assert.equal(next[id], 0);
    }
  }
});

test('editing an excluded region is a no-op', async () => {
  const base = await optimize(request({ sla_ms: 30 }), engines);
  const eligible = eligibilityOf(base);
  const blocked = REGION_ORDER.find((id) => !eligible[id]);
  assert.ok(blocked, 'expected at least one excluded region at a 30 ms SLA');
  const weights = base.allocations.node_weights;
  assert.equal(rebalanceWeights(weights, blocked!, 0.5, eligible), weights);
});

test('normalizeWeights drops ineligible weight and returns null when nothing eligible has weight', async () => {
  const base = await optimize(request({ sla_ms: 30 }), engines);
  const eligible = eligibilityOf(base);
  const blocked = REGION_ORDER.find((id) => !eligible[id])!;
  const onlyBlocked = { [blocked]: 1 } as Partial<Weights>;
  assert.equal(normalizeWeights(onlyBlocked, eligible), null);
  const split = evenSplit(eligible)!;
  assert.ok(Math.abs(sum(split) - 1) < 1e-9);
  assert.equal(split[blocked], 0);
});

test('applyOverride recomputes cost, carbon and latency from the manual weights', async () => {
  const base = await optimize(request(), engines);
  const eligible = eligibilityOf(base);
  const ids = REGION_ORDER.filter((id) => eligible[id]);
  const worst = [...base.nodes].filter((n) => n.eligible).sort((a, b) => b.unit_cost_usd_per_kwh - a.unit_cost_usd_per_kwh)[0]!;
  const manual = rebalanceWeights(base.allocations.node_weights, worst.id, 0.7, eligible);
  const out = applyOverride(base, manual, { budget_cr: 50, carbon_tax: 0.5 });
  assert.ok(ids.length > 2);
  assert.ok(out.manual_override?.active);
  assert.ok((out.manual_override?.cost_gap_pct ?? 0) > 0, 'shifting load to the priciest region must cost more');
  assert.ok(out.cost.blended_unit_cost_usd_per_kwh > base.cost.blended_unit_cost_usd_per_kwh);
  assert.ok(Math.abs(sum(out.allocations.node_weights) - 1) < 1e-3);
  assert.equal(out.allocations.treasury, base.allocations.treasury);
  assert.notEqual(out.carbon_avoided.blended_ci, base.carbon_avoided.blended_ci);
});

test('applyOverride with the optimizer weights reproduces the optimizer cost and has zero gap', async () => {
  const base = await optimize(request(), engines);
  const out = applyOverride(base, base.allocations.node_weights, { budget_cr: 50, carbon_tax: 0.5 });
  assert.ok(Math.abs(out.manual_override!.cost_gap_pct) < 0.01);
  assert.ok(Math.abs(out.cost.blended_unit_cost_usd_per_kwh - base.cost.blended_unit_cost_usd_per_kwh) < 2e-5);
});

test('applyOverride falls back to the optimizer result when the override has no eligible weight', async () => {
  const base = await optimize(request({ sla_ms: 30 }), engines);
  const eligible = eligibilityOf(base);
  const blocked = REGION_ORDER.find((id) => !eligible[id])!;
  const out = applyOverride(base, { [blocked]: 1 } as Partial<Weights>, { budget_cr: 50, carbon_tax: 0.5 });
  assert.equal(out, base);
  assert.equal(out.manual_override, undefined);
});
