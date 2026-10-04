import test from 'node:test';
import assert from 'node:assert/strict';
import { optimize, ControllerInputError } from '../lib/optimizer.ts';
import type { Engines } from '../lib/optimizer.ts';
import { greedyAllocation, projectWeights, weightCap } from '../lib/controllerMath.ts';
import { parseControllerRequest } from '../lib/validation.ts';
import { generateTelemetry, generate24hSeries } from '../lib/mockData.ts';
import type { GridNodeTelemetry, ResolvedRequest } from '../lib/types.ts';

const NOON = new Date('2026-10-04T12:00:00Z');

function request(overrides: Partial<ResolvedRequest> = {}): ResolvedRequest {
  const dpdp = overrides.dpdp_locked ?? false;
  return {
    sla_ms: 25,
    carbon_tax: 0.5,
    budget_cr: 50,
    treasury_yield: 6.8,
    dpdp_locked: dpdp,
    telemetry: generateTelemetry(NOON, dpdp),
    ...overrides,
  };
}

const okEngines: Engines = {
  onnx: async () => ({ raw_weights: [0.2, 0.5, 0.3], hedge_fraction: 0.4, execution_ms: 0.4, init_ms: 0 }),
  classical: async (p) => ({ weights: greedyAllocation(p.costs, p.eligible, p.cap), execution_ms: 0.1, init_ms: 0 }),
};

const sum = (values: number[]): number => values.reduce((a, b) => a + b, 0);

test('DPDP lock confines all weight to the Indian region', async () => {
  const result = await optimize(request({ dpdp_locked: true, sla_ms: 100 }), okEngines);
  assert.equal(result.engine, 'onnx');
  assert.equal(result.allocations.node_weights.mumbai, 1);
  assert.equal(result.allocations.node_weights.frankfurt, 0);
  assert.equal(result.allocations.node_weights.virginia, 0);
  assert.equal(result.compliance.residency_ok, true);
  assert.ok(result.compliance.excluded.some((e) => e.region === 'frankfurt'));
});

test('latency SLA excludes slow nodes', async () => {
  const req = request({ sla_ms: 25 });
  const virginia = req.telemetry.find((n) => n.region === 'us-east-1') as GridNodeTelemetry;
  virginia.latency_ms = 41;
  const result = await optimize(req, okEngines);
  assert.equal(result.allocations.node_weights.virginia, 0);
  const virginiaReport = result.nodes.find((n) => n.id === 'virginia');
  assert.equal(virginiaReport?.eligible, false);
  assert.ok(Math.abs(sum(Object.values(result.allocations.node_weights)) - 1) < 1e-3);
  assert.equal(result.latency.sla_compliant, true);
});

test('falls back to the classical solver when ONNX fails', async () => {
  const engines: Engines = {
    ...okEngines,
    onnx: async () => {
      throw new Error('native binding missing');
    },
  };
  const result = await optimize(request({ sla_ms: 100 }), engines);
  assert.equal(result.engine, 'glpk-wasm');
  assert.match(result.fallback_reason ?? '', /native binding missing/);
  // Cheapest-first with a 70% cap: the top weight must be at the cap.
  assert.ok(Math.max(...Object.values(result.allocations.node_weights)) <= 0.7001);
  assert.ok(Math.abs(sum(Object.values(result.allocations.node_weights)) - 1) < 1e-3);
});

test('falls back to the greedy safe mode when both engines fail', async () => {
  const engines: Engines = {
    onnx: async () => {
      throw new Error('no onnx');
    },
    classical: async () => {
      throw new Error('no wasm');
    },
  };
  const result = await optimize(request({ sla_ms: 100 }), engines);
  assert.equal(result.engine, 'greedy-safe');
  assert.match(result.fallback_reason ?? '', /no wasm/);
});

test('flags an SLA breach when no node can meet the bound', async () => {
  const result = await optimize(request({ dpdp_locked: true, sla_ms: 5 }), okEngines);
  assert.equal(result.compliance.status, 'SLA_BREACH');
  assert.equal(result.latency.sla_compliant, false);
  assert.equal(result.allocations.node_weights.mumbai, 1);
});

test('rejects requests that leave no residency-compliant node', async () => {
  const req = request({ dpdp_locked: true });
  req.telemetry = req.telemetry.filter((n) => n.region !== 'ap-south-1');
  await assert.rejects(() => optimize(req, okEngines), /Telemetry is missing region mumbai|residency/);
});

test('ONNX output with no weight on eligible nodes triggers fallback', async () => {
  const engines: Engines = {
    ...okEngines,
    onnx: async () => ({ raw_weights: [0, 0.6, 0.4], hedge_fraction: 0.4, execution_ms: 0.4, init_ms: 0 }),
  };
  const result = await optimize(request({ dpdp_locked: true, sla_ms: 100 }), engines);
  assert.equal(result.engine, 'glpk-wasm');
  assert.equal(result.allocations.node_weights.mumbai, 1);
});

test('treasury split adds up and offsets respond to the budget', async () => {
  const big = await optimize(request({ budget_cr: 100, carbon_tax: 1 }), okEngines);
  const small = await optimize(request({ budget_cr: 10, carbon_tax: 0 }), okEngines);
  for (const r of [big, small]) {
    const t = r.allocations.treasury;
    assert.ok(Math.abs(t.liquid_funds_pct + t.green_bonds_pct + t.carbon_futures_pct - 100) < 0.02);
  }
  assert.ok(big.carbon_avoided.offset_pct >= small.carbon_avoided.offset_pct);
  assert.ok(small.carbon_avoided.net_footprint_mt > 0);
});

test('default scenario reaches a full offset', async () => {
  const result = await optimize(request(), okEngines);
  assert.equal(result.carbon_avoided.net_footprint_mt, 0);
  assert.equal(result.carbon_avoided.offset_pct, 100);
});

test('greedy allocation is the cheapest-first fill under the cap', () => {
  const w = greedyAllocation([0.15, 0.16, 0.12], [true, true, true], weightCap(3));
  assert.deepEqual(w.map((x) => Math.round(x * 100) / 100), [0.3, 0, 0.7]);
  assert.equal(weightCap(1), 1);
  assert.equal(projectWeights([0, 1, 1], [true, false, false]), null);
});

test('request validation', () => {
  assert.equal(parseControllerRequest({ sla_ms: 'fast' }).ok, false);
  assert.equal(parseControllerRequest({ carbon_tax: 2 }).ok, false);
  assert.equal(parseControllerRequest({ telemetry: [] }).ok, false);
  assert.equal(parseControllerRequest(null).ok, false);
  const good = parseControllerRequest({ dpdp_locked: true });
  assert.equal(good.ok, true);
  if (good.ok) assert.ok(good.value.telemetry.every((n) => n.dpdp_locked));
});

test('mock telemetry and 24h series are well-formed', () => {
  const feed = generateTelemetry(NOON);
  assert.equal(feed.length, 3);
  for (const n of feed) {
    assert.ok(n.carbon_ci > 100 && n.carbon_ci < 1000);
    assert.ok(n.latency_ms > 0);
  }
  const series = generate24hSeries({ mumbai: 0.2, frankfurt: 0.3, virginia: 0.5 }, 7, NOON);
  assert.equal(series.length, 24);
  assert.equal(series[23].label, '12:00');
});

test('ControllerInputError is exported for the route handler', () => {
  assert.ok(new ControllerInputError('x') instanceof Error);
});
