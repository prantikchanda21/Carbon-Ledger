import test from 'node:test';
import assert from 'node:assert/strict';
import { runOnnxPolicy } from '../lib/onnxInference.ts';
import { solveClassicalDispatch } from '../lib/classicalWasmSolver.ts';
import { generateTelemetry } from '../lib/mockData.ts';
import { assess, buildPolicyFeatures } from '../lib/controllerMath.ts';
test('bundled ONNX graph loads and produces 20 finite normalized weights',async()=>{
  const req={telemetry:generateTelemetry(new Date('2026-10-04T12:00:00Z'),false,true),sla_ms:100,carbon_tax:0.5,budget_cr:50,treasury_yield:6.8,dpdp_locked:false};
  const result=await runOnnxPolicy(buildPolicyFeatures(req,assess(req).nodes));
  assert.equal(result.raw_weights.length,20);assert.ok(result.raw_weights.every(v=>Number.isFinite(v)&&v>=0));assert.ok(Math.abs(result.raw_weights.reduce((s,v)=>s+v,0)-1)<1e-6);
});
test('real GLPK solver respects capacity and exact dispatch cost',async()=>{
  const result=await solveClassicalDispatch({ids:['mumbai','frankfurt','virginia'],costs:[1,2,3],eligible:[true,true,false],cap:0.7});
  assert.ok(Math.abs(result.weights[0]-0.7)<1e-6);assert.ok(Math.abs(result.weights[1]-0.3)<1e-6);assert.equal(result.weights[2],0);
});
