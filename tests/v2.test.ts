import test from 'node:test';
import assert from 'node:assert/strict';
import { forecast24h } from '../lib/forecast.ts';
import { EVENT_PRESETS, injectEvent } from '../lib/events.ts';
import { detectAnomaly } from '../lib/anomaly.ts';
import { scheduleWorkloads } from '../lib/scheduler.ts';
import { generateTelemetry, simulatedFeedHealthAt } from '../lib/mockData.ts';
import { optimize } from '../lib/optimizer.ts';
import { greedyAllocation } from '../lib/controllerMath.ts';
import type { ControlState, ResolvedRequest, Workload } from '../lib/types.ts';

const controls: ControlState = { sla_ms: 60, carbon_tax: 0.6, budget_cr: 50, dpdp_locked: false };
const telemetry = generateTelemetry(new Date('2026-10-04T12:00:00Z'), false, true);

test('forecast returns 24 points and confidence band per region', () => {
  const result = forecast24h(new Date('2026-10-04T12:00:00Z'));
  assert.equal(result.length, 20);
  assert.equal(result[0]?.points.length, 24);
  assert.ok((result[0]?.points[0]?.low ?? 0) <= (result[0]?.points[0]?.mean ?? 0));
  assert.ok((result[0]?.points[0]?.high ?? 0) >= (result[0]?.points[0]?.mean ?? 0));
});

test('heatwave event increases Mumbai carbon and decays', () => {
  const base = telemetry.map((n) => ({ ...n }));
  const event = { ...EVENT_PRESETS[0], id: 'heat-test', startedAt: Date.parse('2026-10-04T12:00:00Z') };
  const peak = injectEvent(event, base, Date.parse('2026-10-04T13:00:00Z'));
  const expired = injectEvent(event, base, Date.parse('2026-10-05T00:30:00Z'));
  const mumbai = base.find((n) => n.region === 'ap-south-1');
  const peakMumbai = peak.find((n) => n.region === 'ap-south-1');
  const expiredMumbai = expired.find((n) => n.region === 'ap-south-1');
  assert.ok((peakMumbai?.carbon_ci ?? 0) > (mumbai?.carbon_ci ?? 0));
  assert.equal(expiredMumbai?.carbon_ci, mumbai?.carbon_ci);
});

test('anomaly detector flags a z-score spike and stale feed', () => {
  const report = detectAnomaly(900, [300, 320, 310, 305, 315, 290], Date.now() - 400_000);
  assert.equal(report.spike, true);
  assert.equal(report.stale, true);
  assert.equal(report.quality, 'stale');
});

test('scheduler keeps DPDP workload inside India and chooses a compliant hour', () => {
  const workloads: Workload[] = [
    { id: 'dpdp', name: 'DPDP batch', dpdp_locked: true, latency_need_ms: 60, deferrable: true, kwh: 20, deadline_hour: 20 },
    { id: 'open', name: 'Open batch', dpdp_locked: false, latency_need_ms: 60, deferrable: true, kwh: 20, deadline_hour: 20 },
  ];
  const result = scheduleWorkloads(workloads, telemetry, controls, new Date('2026-10-04T12:00:00Z'));
  const dpdp = result.assignments.find((a) => a.workload_id === 'dpdp');
  assert.ok(dpdp);
  assert.ok(['mumbai','hyderabad','delhi'].includes(dpdp!.region));
  assert.ok(result.total_kwh > 0);
});

test('shadow mode reports a non-negative surrogate cost gap', async () => {
  const request: ResolvedRequest = {
    telemetry,
    sla_ms: 60,
    carbon_tax: 0.6,
    budget_cr: 50,
    treasury_yield: 6.8,
    dpdp_locked: false,
    shadow: true,
    chaos: 'none',
  };
  const result = await optimize(request, {
    onnx: async () => ({ raw_weights: [0.2, 0.6, 0.2], hedge_fraction: 0.35, execution_ms: 0.2, init_ms: 0 }),
    classical: async (problem) => ({ weights: greedyAllocation(problem.costs, problem.eligible, problem.cap), execution_ms: 0.4, init_ms: 0 }),
  });
  assert.equal(result.engine, 'onnx');
  assert.equal(result.shadow?.available, true);
  assert.ok((result.shadow?.cost_gap_pct ?? -1) >= 0);
});

test('sweep grid shape can be generated from 10 by 10 control values', () => {
  const cells = [];
  for (let sla = 10; sla <= 100; sla += 10) {
    for (let i = 0; i < 10; i += 1) cells.push({ sla, tax: i / 9 });
  }
  assert.equal(cells.length, 100);
});


test('simulated feed quality changes with simulation time', () => {
  const samples = [0, 4, 8, 12, 16, 20, 24].map((hour) => simulatedFeedHealthAt('mumbai', hour).score);
  assert.ok(new Set(samples).size > 1);
  assert.ok(samples.every((score) => score >= 0 && score <= 100));
});
