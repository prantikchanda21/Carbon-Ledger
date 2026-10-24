import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ACTIVE_ENGINES,ENGINE_LABELS,validEngineMode} from '../lib/quantumEngineModes.ts';
const active=['glpk','oracle','geometry-curved','geometry-grover','geometry'];
const retired=['standard','fluid','gaseous','adiabatic','quad','geometry-xy'];
test('curated main dashboard engine values match backend whitelist',()=>{
 const ui=readFileSync('components/ControllerDashboard.tsx','utf8');
 const route=readFileSync('app/api/cooperative-allocation/route.ts','utf8');
 assert.deepEqual([...ACTIVE_ENGINES],active);
 for(const code of active){assert.equal(validEngineMode(code),true);assert.ok(ENGINE_LABELS[code as keyof typeof ENGINE_LABELS]);assert.ok(ui.includes(`value="${code}"`));}
 for(const code of retired){assert.equal(validEngineMode(code),false);assert.ok(!ui.includes(`value="${code}"`));}
 assert.match(route,/geometryQuantumAllocation/);
 assert.match(route,/validEngineMode\(mode\)/);
});
test('lab/scheduler/weather also use only approved engine modes',()=>{
 for(const component of ['components/LiveQuantumLab.tsx','components/DigitalTwin.tsx','components/QuantumScheduler.tsx']){
  const src=readFileSync(component,'utf8');
  for(const code of ['standard','fluid','gaseous','adiabatic','quad'])assert.ok(!src.includes(`'${code}'`),`${component} lists retired ${code}`);
  for(const code of active)assert.ok(src.includes(`'${code}'`),`${component} missing ${code}`);
 }
 const weather=readFileSync('components/WeatherOptimizer.tsx','utf8');
 assert.ok(weather.includes('snapshot.engine'),'Weather Optimizer must inherit dashboard engine, not maintain a second independent selector');
 assert.ok(!weather.includes('setEngine('));
 const api=readFileSync('app/api/quantum-lab-live/route.ts','utf8');
 for(const code of active)assert.ok(api.includes(`'${code}'`));
});
