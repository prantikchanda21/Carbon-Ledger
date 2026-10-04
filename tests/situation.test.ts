import test from 'node:test';
import assert from 'node:assert/strict';
import { optimize } from '../lib/optimizer.ts';
import type { Engines } from '../lib/optimizer.ts';
import { greedyAllocation } from '../lib/controllerMath.ts';
import { generateTelemetry } from '../lib/mockData.ts';
import { buildSituation, describeSituation } from '../lib/situation.ts';

const NOON = new Date('2026-10-04T12:00:00Z');
const engines: Engines = {
  onnx: async () => ({ raw_weights: [0.2, 0.5, 0.3], hedge_fraction: 0.4, execution_ms: 0.4, init_ms: 0 }),
  classical: async (p) => ({ weights: greedyAllocation(p.costs, p.eligible, p.cap), execution_ms: 0.1, init_ms: 0 }),
};

test('situation summary is built only from calculated facts', async () => {
  const controls = { sla_ms: 50, carbon_tax: 0.5, budget_cr: 50, dpdp_locked: false };
  const telemetry = generateTelemetry(NOON, false);
  const result = await optimize({ ...controls, treasury_yield: 6.8, telemetry }, engines);
  const facts = buildSituation(telemetry, controls, result, [], [], NOON);
  assert.equal(facts.data_source, 'synthetic demo data');
  assert.ok(facts.top_allocations.length > 0);
  const text = describeSituation(facts);
  assert.match(text, /placing most workload in/);
  assert.match(text, /synthetic demo data/);
  assert.ok(!/undefined|NaN/.test(text));
});

test('summary handles a missing result without throwing', () => {
  const facts = buildSituation([], { sla_ms: 50, carbon_tax: 0.5, budget_cr: 50, dpdp_locked: true }, null, [], [], NOON);
  const text = describeSituation(facts);
  assert.match(text, /No allocation has been computed yet/);
  assert.match(text, /India-only residency is on/);
});
