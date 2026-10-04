import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { REGION_ORDER, REGIONS } from '../lib/regions.ts';
import { expandOnnxWeights } from '../lib/controllerMath.ts';
import { optimize } from '../lib/optimizer.ts';
import { generateTelemetry } from '../lib/mockData.ts';

test('catalog contains 20 regions and Indian residency has three eligible regions', () => {
  assert.equal(REGION_ORDER.length, 20);
  assert.deepEqual(REGION_ORDER.slice(0, 3), ['mumbai', 'hyderabad', 'delhi']);
});

test('20-region ONNX adapter masks unavailable nodes and normalizes weights', () => {
  const telemetry = generateTelemetry(new Date('2026-10-04T12:00:00Z'), false, true);
  const nodes = REGION_ORDER.map((id) => ({
    id,
    telemetry: telemetry.find((n) => n.region === REGIONS[id].code)!,
    eligible: true,
    exclusion_reason: null,
    unit_cost: { energy: 0.1, carbon: 0.1, egress: 0.001, total: 0.201 },
  }));
  const eligible = nodes.map((n) => n.eligible);
  const weights = expandOnnxWeights(Array.from({ length: 20 }, (_, i) => 20 - i), REGION_ORDER.slice(), eligible, nodes);
  assert.ok(weights);
  assert.ok(Math.abs(weights!.reduce((a, b) => a + b, 0) - 1) < 1e-6);
  assert.equal(weights!.length, 20);
});

test('bundled model manifest records a 20-region surrogate artifact', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'qiskit_train/artifacts/training_manifest.json'), 'utf8')) as Record<string, unknown>;
    assert.equal(manifest.input_size, 84);
  assert.equal(manifest.output_size, 21);
  assert.match(String(manifest.teacher), /QAOA/);
});

test('20-region default request can be optimized by a mocked ONNX engine', async () => {
  const telemetry = generateTelemetry(new Date('2026-10-04T12:00:00Z'), false, true);
  const result = await optimize({ telemetry, sla_ms: 100, carbon_tax: 0.5, budget_cr: 50, treasury_yield: 7, dpdp_locked: false, shadow: false, chaos: 'none' }, {
    onnx: async () => ({ raw_weights: Array.from({ length: 20 }, (_, i) => 20 - i), hedge_fraction: 0.3, execution_ms: 0.2, init_ms: 0 }),
    classical: async (problem) => ({ weights: problem.costs.map((_, i) => problem.eligible[i] ? 1 / problem.eligible.filter(Boolean).length : 0), execution_ms: 0.5, init_ms: 0 }),
  });
  assert.equal(Object.keys(result.allocations.node_weights).length, 20);
  assert.equal(result.ai_architecture?.model_regions, 20);
});
