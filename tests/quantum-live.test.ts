import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

test('bounded Node quantum routes and optional Qiskit runtime are present', () => {
  assert.ok(fs.existsSync(path.join(root, 'app/api/quantum-optimize/route.ts')));
  assert.ok(fs.existsSync(path.join(root, 'app/api/quantum-status/route.ts')));
  assert.ok(fs.existsSync(path.join(root, 'python_quantum/qaoa_service.py')));
  const requirements = fs.readFileSync(path.join(root, 'requirements.txt'), 'utf8');
  assert.match(requirements, /qiskit==2\.5\.2/);
  assert.doesNotMatch(requirements, /ibm/i);
});

test('Vercel routes expose quantum optimize and status paths', () => {
  const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8')) as { rewrites?: Array<{ source: string; destination: string }>; functions?: Record<string, unknown> };
  assert.equal(vercel.rewrites?.length ?? 0, 0);
  assert.ok(vercel.functions?.['app/api/quantum-optimize/route.ts']);
  assert.ok(fs.existsSync(path.join(root, 'app/api/quantum-status/route.ts')));
});

test('environment contract includes QAOA tuning controls', () => {
  const env = fs.readFileSync(path.join(root, '.env.example'), 'utf8');
  for (const key of ['QUANTUM_MAX_CANDIDATES', 'QUANTUM_PARAMETER_GRID', 'QUANTUM_SHOTS']) {
    assert.match(env, new RegExp(`^${key}=`, 'm'));
  }
});
