import fs from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
const root=process.cwd();
const get=(x)=>fs.readFileSync(path.join(root,x),'utf8');
const manifest=JSON.parse(get('package.json'));
const lock=JSON.parse(get('package-lock.json'));
assert.equal(manifest.name,lock.name,'package lock mismatch');
assert.equal(manifest.version,lock.version,'package lock version mismatch');
assert.ok(get('.gitignore').includes('.env*'),'Must ignore local secrets');
for (const route of ['api/quantum-lab-live','api/cooperative-allocation']) assert.ok(fs.existsSync(path.join(root,'app',route,'route.ts')),`Missing ${route}`);
for(const lib of ['lib/regions.ts','lib/mockData.ts','components/ControllerDashboard.tsx']) assert.ok(fs.existsSync(path.join(root,lib)),`Missing ${lib}`);
assert.ok(!fs.existsSync(path.join(root,'.env.local')),'Local API keys must not be packaged');
console.log('Submission smoke tests passed: project structure, routes, lockfile and secrets.');

for(const file of ['components/GridEvidencePanel.tsx','components/GridAllocationImpact.tsx','lib/gridData.ts','app/api/grid-data/route.ts']) assert.ok(!fs.existsSync(path.join(root,file)),`Retired grid feature still exists: ${file}`);
assert.ok(!get('.env.example').includes('EMBER_API_KEY'),'No Ember API variable should remain');
