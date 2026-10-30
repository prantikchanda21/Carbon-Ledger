import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=(name:string)=>fs.readFileSync(name,'utf8');
test('no Ember configuration, endpoints, or removed grid panels',()=>{
 for(const name of ['components/GridAllocationImpact.tsx','components/GridEvidencePanel.tsx','lib/gridData.ts','app/api/grid-data/route.ts'])assert.equal(fs.existsSync(name),false,name);
 assert.equal(read('.env.example').includes('EMBER_API_KEY'),false);
 const source=['components/ControllerDashboard.tsx','components/WeatherOptimizer.tsx','components/QuantumScheduler.tsx','app/api/quantum-lab-live/route.ts'].map(read).join('\n');
 for(const phrase of ['useGridData','GridEvidencePanel','GridAllocationImpact','getGridReadings','gridEvidence','gridApplied','EMBER_API_KEY'])assert.equal(source.includes(phrase),false,phrase);
});
test('modeled carbon survives grid-data removal',()=>{
 const api=read('app/api/quantum-lab-live/route.ts');
 assert.match(api,/generateTelemetry/);
 assert.match(api,/r\.carbon_ci\*carbonMultiplier/);
 assert.match(api,/applyWeather/);
 assert.match(read('lib/mockData.ts'),/ciBase/);
});
