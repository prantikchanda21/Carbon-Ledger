import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {readFileSync} from 'node:fs';
import {ACTIVE_ENGINES,validEngineMode} from '../lib/quantumEngineModes.ts';
import {activeEngineStudies,retiredEngineStudies} from '../lib/engineCatalog.ts';
const read=(f:string)=>readFileSync(new URL('../'+f,import.meta.url),'utf8');
test('exactly five distinct active engines with benchmark rows',()=>{assert.deepEqual([...ACTIVE_ENGINES],['glpk','oracle','geometry-curved','geometry-grover','geometry']);assert.deepEqual(activeEngineStudies.map(e=>e.id),[...ACTIVE_ENGINES]);});
test('retired engines are not routable',()=>{for(const e of retiredEngineStudies)assert.equal(validEngineMode(e.id),false);for(const e of activeEngineStudies)assert.ok(validEngineMode(e.id));});
test('dashboard, lab, history, and research agree on live and archived engines',()=>{for(const id of ACTIVE_ENGINES){assert.ok(read('components/ControllerDashboard.tsx').includes('value="'+id+'"'));assert.ok(read('app/api/cooperative-allocation/route.ts').includes(id==='glpk'?"mode==='glpk'":id==='oracle'?"mode==='oracle'":id==='geometry-curved'?'geometry-curved':id==='geometry-grover'?'geometry-grover':'geometryQuantumAllocation'));}assert.ok(read('app/history/page.tsx').includes('retiredEngineStudies'));assert.ok(read('app/research/page.tsx').includes('TopFiveResearch'));});
