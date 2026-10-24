import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {geometryQuantumAllocation} from '../lib/geometryQuantum.ts';
import {validEngineMode,ENGINE_LABELS} from '../lib/quantumEngineModes.ts';
const example={costs:Array.from({length:20},(_,i)=>.14+i*.014),caps:Array(20).fill(.085),preferred:Array(20).fill(.05),regularization:.058};
test('v147 quantum fusion executes eight independent 10-qubit depth-three statevectors',async()=>{
 const run=await geometryQuantumAllocation(example,'fusion');
 assert.equal(run.feasible,true);assert.equal(run.batches.length,4);assert.equal(run.allBatches.length,8);
 assert.ok(Math.abs(run.weights.reduce((a,b)=>a+b,0)-1)<1e-9);
 assert.ok(run.batches.every(b=>b.qubits===10&&b.p===3));
 for(const b of run.allBatches){assert.equal(b.validBasisStates,252);assert.equal(b.trace.length,3);assert.ok(Math.abs(b.norm-1)<1e-9);assert.equal(b.classicalOptimizerUsed,false);assert.ok(b.uniformObjective>0);}
});
test('fusion selects the best quantum-measured candidate, not an injected classical optimum',async()=>{
 const [run,curved,grover]=await Promise.all([
  geometryQuantumAllocation(example,'fusion'),geometryQuantumAllocation(example,'curved'),geometryQuantumAllocation(example,'grover')]);
 assert.ok(run.objective<=curved.objective+1e-10);
 assert.ok(run.objective<=grover.objective+1e-10);
 assert.ok(run.allBatches.some(b=>Math.abs(b.objective-run.objective)<1e-10));
 assert.deepEqual((await geometryQuantumAllocation(example,'fusion')).weights,run.weights);
});
test('fusion responds to changed costs and regions',async()=>{
 const a=await geometryQuantumAllocation(example,'fusion');
 const b=await geometryQuantumAllocation({...example,costs:example.costs.toReversed(),caps:example.caps.map((cap,i)=>i===0?0:cap)},'fusion');
 assert.notDeepEqual(a.weights,b.weights);assert.equal(b.weights[0],0);
});
test('v147 is wired through dashboard engine selection and allocation route',()=>{
 const dashboard=readFileSync('components/ControllerDashboard.tsx','utf8');
 const route=readFileSync('app/api/cooperative-allocation/route.ts','utf8');
 assert.ok(validEngineMode('geometry-curved'));assert.match(ENGINE_LABELS['geometry-curved'],/Curvilinear/);
 assert.match(dashboard,/value="geometry-curved"/);
 assert.match(route,/mode==='geometry-curved'\?'fusion'/);
 assert.match(route,/weights:run.weights/);
});
test('infeasible capacity rejects independently',async()=>{
 await assert.rejects(geometryQuantumAllocation({...example,caps:Array(20).fill(.01)},'fusion'),/infeasible/);
});
