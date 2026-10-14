import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {placementQaoa} from '../lib/quantum-v8/placement.ts';
import {predictVqc} from '../lib/quantum-v8/risk.ts';
import {projectWeights} from '../lib/controllerMath.ts';
import {buildQuantumRequest} from '../lib/quantumClient.ts';
import {generateTelemetry} from '../lib/mockData.ts';


test('bounded QAOA produces normalized feasible weights and finite cost',()=>{
 const req=buildQuantumRequest(generateTelemetry(new Date('2026-10-04T12:00:00Z'),false,true),{sla_ms:100,dpdp_locked:false,carbon_tax:.5,budget_cr:50},'simulator');
 const a=placementQaoa(req),b=placementQaoa(req);assert.equal(a.status,'completed');assert.deepEqual(a.weights,b.weights);
 assert.ok(Math.abs(Object.values(a.weights!).reduce((s,w)=>s+w,0)-1)<1e-9);assert.ok(Number.isFinite(a.qaoa_cost_usd_per_kwh));assert.ok(a.optimizer_evals<=80);assert.equal(a.quantum_verified,false);
});
test('allocation cap redistributes concentrated output and preserves exclusions',()=>{
 const w=projectWeights([1,0,9],[true,true,false])!;assert.ok(Math.abs(w[0]-.7)<1e-9);assert.ok(Math.abs(w[1]-.3)<1e-9);assert.equal(w[2],0);
 assert.equal(projectWeights([0,0],[true,true]),null);
});
test('browser VQC matches saved Python reference',()=>{
 const fixture=JSON.parse(fs.readFileSync('tests/fixtures/vqc-reference.json','utf8'));
 for(const row of fixture.rows){const p=predictVqc(row.input,fixture.model);p.forEach((v,i)=>assert.ok(Math.abs(v-row.probabilities[i])<1e-10));}
});
