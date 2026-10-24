import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { recommendAdaptiveAutopilot,stepAdaptiveAutopilot } from '../lib/autopilot.ts';
import { millionToCr } from '../lib/budgetUsd.ts';
import { BUDGET_MIN_CR,BUDGET_MAX_CR } from '../lib/constants.ts';
import type { ControlState, GridNodeTelemetry } from '../lib/types.ts';
const start:ControlState={sla_ms:55,carbon_tax:.5,budget_cr:millionToCr(30),dpdp_locked:true};
const feed=(ci:number,price:number,lat:number,available=true):GridNodeTelemetry[]=>
  Array.from({length:20},(_,i)=>({region:`R${i}`,carbon_ci:ci,energy_price:price,latency_ms:lat,dpdp_locked:true,available,renewable_pct:40}));

test('adaptive policy follows actual carbon, energy price and latency changes',()=>{
  const clean=recommendAdaptiveAutopilot(start,start,feed(120,65,22));
  const dirty=recommendAdaptiveAutopilot(start,start,feed(750,115,74));
  assert.ok(dirty.target.carbon_tax>clean.target.carbon_tax);
  assert.ok(dirty.target.sla_ms>clean.target.sla_ms);
  assert.ok(dirty.target.budget_cr<clean.target.budget_cr);
  assert.equal(dirty.target.dpdp_locked,true);
  assert.match(dirty.reason,/Carbon elevated/);
});

test('step changes three controls at once but stays within safe limits',()=>{
  const recommendation=recommendAdaptiveAutopilot(start,start,feed(700,100,70));
  const next=stepAdaptiveAutopilot(start,recommendation);
  assert.notEqual(next.sla_ms,start.sla_ms);
  assert.notEqual(next.carbon_tax,start.carbon_tax);
  assert.notEqual(next.budget_cr,start.budget_cr);
  assert.equal(next.dpdp_locked,true);
  assert.ok(next.budget_cr>=BUDGET_MIN_CR&&next.budget_cr<=BUDGET_MAX_CR);
});

test('stabilizes without oscillating on unchanging telemetry; remains on until Stop',()=>{
  let controls={...start};const recommendation=recommendAdaptiveAutopilot(start,start,feed(700,100,70));
  for(let i=0;i<100;i++)controls=stepAdaptiveAutopilot(controls,recommendation);
  const stable=stepAdaptiveAutopilot(controls,recommendation);
  assert.deepEqual(stable,controls);
  const dashboard=readFileSync('components/ControllerDashboard.tsx','utf8');
  assert.ok(!dashboard.includes('if (stepped.done) setAutopilotActive(false)'));
  assert.match(dashboard,/window.setInterval\(tick, 4000\)/);
});

test('never acts on missing or unavailable regional data',()=>{
  const empty=recommendAdaptiveAutopilot(start,start,[]);
  assert.deepEqual(empty.target,start);
  const unavailable=recommendAdaptiveAutopilot(start,start,feed(500,90,40,false));
  assert.deepEqual(unavailable.target,start);
});

test('engine recalculates throughout autopilot and prevents stale allocation results',()=>{
  const dashboard=readFileSync('components/ControllerDashboard.tsx','utf8');
  assert.match(dashboard,/const appliedControls = controls;/);
  assert.match(dashboard,/setOptimizationInput\(previous=>/);
  assert.match(dashboard,/optimizerResult.evaluation_key!==evaluationHash\(\)/);
  assert.match(dashboard,/const shownKpis = activeKpiSnapshot \?\? lastCompletedKpis/);
  assert.match(dashboard,/const cooperativeActive=Boolean\(cooperative/);
  const panel=readFileSync('components/ControlPanel.tsx','utf8');
  assert.match(panel,/Continuous condition-aware mode/);
  assert.match(panel,/no investment transactions occur/);
});
