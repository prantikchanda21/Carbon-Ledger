import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

test('local quantum bridge exists for Next.js development', () => {
  assert.ok(fs.existsSync(path.join(root, 'scripts/quantum_cli.py')));
  assert.ok(fs.existsSync(path.join(root, 'scripts/local_quantum_server.py')));
  assert.ok(fs.existsSync(path.join(root, 'app/api/quantum-local/optimize/route.ts')));
  assert.ok(fs.existsSync(path.join(root, 'app/api/quantum-local/status/route.ts')));
  assert.ok(fs.readFileSync(path.join(root, 'lib/quantumClient.ts'), 'utf8').includes('NEXT_PUBLIC_QUANTUM_LOCAL'));
});

test('local launcher prepares Qiskit and starts Next.js without requiring a helper port', () => {
  const bat = fs.readFileSync(path.join(root, 'start-local.bat'), 'utf8');
  assert.doesNotMatch(bat, /local_quantum_server\.py/i);
  assert.match(bat, /NEXT_PUBLIC_QUANTUM_LOCAL=1/i);
  assert.match(bat, /QUANTUM_PYTHON_PATH=/i);
  assert.match(bat, /qiskit_train\\\.venv\\Scripts\\python\.exe/i);
  assert.match(bat, /npm run dev/i);
});

test('local quantum Python CLI exists and supports simulator operations', () => {
  const source = fs.readFileSync(path.join(root, 'scripts/quantum_cli.py'), 'utf8');
  assert.match(source, /optimize_live/);
  assert.match(source, /retrieve_job/);
  assert.match(source, /__operation/);
  assert.match(source, /__job_id/);
  assert.match(source, /sys\.path\.insert\(0, str\(ROOT\)\)/);
});

test('quantum client protects against HTML/invalid JSON endpoint errors', () => {
  const source = fs.readFileSync(path.join(root, 'lib/quantumClient.ts'), 'utf8');
  assert.match(source, /non-JSON/);
  assert.match(source, /quantumEndpoints\(\)\.status/);
});

test('local helper exposes a JSON health diagnostic before Qiskit is installed', () => {
  const helper = fs.readFileSync(path.join(root, 'scripts/local_quantum_server.py'), 'utf8');
  assert.match(helper, /sys\.path\.insert\(0, str\(ROOT\)\)/);
  assert.match(helper, /QISKIT_IMPORT_ERROR/);
  assert.match(helper, /['"]\/health['"]/);
});

test('production quantum status exposes synchronous simulation contract', () => {
  const status = fs.readFileSync(path.join(root, 'app/api/quantum-status/route.ts'), 'utf8');
  assert.match(status, /function POST/);
  assert.match(status, /synchronously/);
  assert.match(status, /hardware:false/);
});

test('Python local runtime is explicit opt-in; ordinary local runs use Node', () => {
  const source = fs.readFileSync(path.join(root, 'lib/quantumClient.ts'), 'utf8');
  assert.match(source, /NEXT_PUBLIC_QUANTUM_LOCAL === '1'/);
  assert.doesNotMatch(source, /window.location/);
});

test('globe uses a lightweight non-instanced particle path', () => {
  const globe = fs.readFileSync(path.join(root, 'components/Globe3D.tsx'), 'utf8');
  assert.match(globe, /function Particle\(/);
  assert.doesNotMatch(globe, /InstancedMesh/);
});

test('globe arcs use lightweight Three.js line segments', () => {
  const globe = fs.readFileSync(path.join(root, 'components/Globe3D.tsx'), 'utf8');
  assert.match(globe, /<lineSegments geometry=\{geometry\}/);
  assert.doesNotMatch(globe, /TubeGeometry/);
  assert.doesNotMatch(globe, /<Line /);
});
