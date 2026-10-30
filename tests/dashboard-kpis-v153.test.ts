import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeDashboardKpiSnapshot } from '../lib/dashboardKpiSnapshot.ts';
import { INR_PER_CRORE, OFFSET_PRICE_USD_PER_TONNE, USD_INR } from '../lib/constants.ts';
import type { OptimizationResult } from '../lib/types.ts';

function sampleResult(): OptimizationResult {
  return {
    carbon_avoided: {
      blended_ci: 317, ci_shift_pct: -4, net_footprint_mt: 12.5,
      gross_tco2_per_day: 20, offset_pct: 30, carbon_avoided_t: 3,
      offset_roi_pct: 0, baseline_ci: 380,
    },
    allocations: { treasury: { projected_apy: 7.2, liquid_funds_pct: 30, green_bonds_pct: 60, carbon_futures_pct: 10 }, node_weights: {} as OptimizationResult['allocations']['node_weights'], hedge_pct: 0 },
    treasury_income_inr: 30 * INR_PER_CRORE * 0.072,
    latency: { weighted_network_ms: 42, sla_compliant: true, execution_ms: 1, init_ms: 0, max_used_latency_ms: 42, sla_ms: 55 },
  } as OptimizationResult;
}

test('four KPI values and APY are calculated from a completed allocation only', () => {
  const result = sampleResult();
  const output = makeDashboardKpiSnapshot(result, 'geometry', 30, [{blended: 300, apy: 7.0}, {blended: 317, apy: 7.2}]);
  const expectedNetApy = (result.treasury_income_inr - (0.3 * 20 * OFFSET_PRICE_USD_PER_TONNE * 365 * USD_INR)) / (30 * INR_PER_CRORE) * 100;
  assert.equal(output.engine, 'geometry');
  assert.equal(output.carbonIntensity, 317);
  assert.equal(output.netFootprintMt, 12.5);
  assert.equal(output.networkLatencyMs, 42);
  assert.ok(Math.abs((output.netTreasuryApy ?? 0) - expectedNetApy) < 1e-10);
  assert.deepEqual(output.carbonTrend, [300,317]);
});

test('snapshots hold immutable scalar and trend values during subsequent updates', () => {
  const original = sampleResult();
  const trend = [{blended:300,apy:7.0}];
  const captured = makeDashboardKpiSnapshot(original,'oracle',30,trend);
  original.carbon_avoided.blended_ci = 900;
  trend[0].blended = 900;
  assert.equal(captured.carbonIntensity,317);
  assert.equal(captured.carbonTrend[0],300);
  assert.equal(captured.engine,'oracle');
});

test('treasury APY safely reports unavailable when budget is zero',()=>{
  assert.equal(makeDashboardKpiSnapshot(sampleResult(),'glpk',0,[]).netTreasuryApy,null);
});

test('four KPI cards appear immediately after engine selector and before controls',()=>{
  const text=readFileSync('components/ControllerDashboard.tsx','utf8');
  const selector=text.indexOf('aria-label="Optimization engine selection"');
  const grid=text.indexOf('id="main-kpis"');
  const panel=text.indexOf('<ControlPanel />');
  const editor=text.indexOf('<AllocationEditor');
  const map=text.indexOf('id="region-atlas"');
  assert.ok(selector>=0 && selector<grid && grid<panel && panel<editor && editor<map);
  const section=text.slice(grid,panel);
  assert.equal((section.match(/<MetricCard /g)??[]).length,4);
  assert.ok(!section.includes('{cooperativeActive && <>'), 'main KPI section must not depend on calculation state');
  assert.ok(section.includes('showingPreviousKpis'), 'stale values must be visibly identified');
});

test('last completed snapshot is cached without replacing it with optimizer preview',()=>{
  const text=readFileSync('components/ControllerDashboard.tsx','utf8');
  assert.match(text,/const activeKpiSnapshot = useMemo\(\(\) => result && cooperativeActive/);
  assert.match(text,/if \(activeKpiSnapshot && !cooperativeBusy && !cooperativeError\)/);
  assert.match(text,/const shownKpis = activeKpiSnapshot \?\? lastCompletedKpis;/);
  assert.match(text,/const appliedControls = controls;/);
});
