import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { NET_ZERO_TARGETS, autopilotProgress, stepAutopilot } from '../lib/autopilot.ts';
import { millionToCr } from '../lib/budgetUsd.ts';
import type { ControlState } from '../lib/types.ts';

const samples: ControlState[] = [
  { sla_ms: 25, carbon_tax: 0.5, budget_cr: millionToCr(30), dpdp_locked: false },
  { sla_ms: 100, carbon_tax: 0, budget_cr: millionToCr(5), dpdp_locked: true },
  { sla_ms: 10, carbon_tax: 1, budget_cr: millionToCr(100), dpdp_locked: false },
  { sla_ms: 29, carbon_tax: 0.879, budget_cr: NET_ZERO_TARGETS.budget_cr - 0.5, dpdp_locked: true },
];

for (const [index, start] of samples.entries()) {
  test(`autopilot converges without rounding stall, scenario ${index + 1}`, () => {
    let current = start;
    let progress = autopilotProgress(current, start);
    let finished = false;
    for (let i = 0; i < 150; ++i) {
      const step = stepAutopilot(current);
      current = step.controls;
      const nextProgress = autopilotProgress(current, start);
      assert.ok(nextProgress >= progress, 'progress must never reverse');
      progress = nextProgress;
      assert.equal(current.dpdp_locked, start.dpdp_locked);
      assert.ok(current.carbon_tax >= 0 && current.carbon_tax <= 1);
      if (step.done) { finished = true; break; }
    }
    assert.ok(finished, 'autopilot must finish rather than stall');
    assert.equal(current.sla_ms, NET_ZERO_TARGETS.sla_ms);
    assert.equal(current.carbon_tax, NET_ZERO_TARGETS.carbon_tax);
    assert.equal(current.budget_cr, NET_ZERO_TARGETS.budget_cr);
    assert.equal(progress, 100);
  });
}

test('Autopilot controls panel remains outside allocation-result conditional', () => {
  const source = readFileSync('components/ControllerDashboard.tsx', 'utf8');
  const panel = source.indexOf('<ControlPanel />');
  const gatedResult = source.indexOf('{cooperativeActive && <>', panel);
  assert.ok(panel > 0 && gatedResult > panel);
});

test('Autopilot persists and live solver inputs update during operation', () => {
  const panel = readFileSync('components/ControlPanel.tsx', 'utf8');
  const dashboard = readFileSync('components/ControllerDashboard.tsx', 'utf8');
  assert.match(panel, /s\)=>s\.autopilotActive/);
  assert.match(dashboard, /const appliedControls = controls;/);
  assert.match(dashboard, /controls:appliedControls,nodes:snapshot.nodes/);
  assert.match(dashboard, /c: appliedControls/);
  assert.match(dashboard, /sla_ms: appliedControls.sla_ms/);
});
