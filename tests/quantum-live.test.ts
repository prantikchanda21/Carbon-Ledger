import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

test('live quantum Vercel functions and Qiskit runtime contract are present', () => {
  assert.ok(fs.existsSync(path.join(root, 'api/quantum_optimize.py')));
  assert.ok(fs.existsSync(path.join(root, 'api/quantum_status.py')));
  assert.ok(fs.existsSync(path.join(root, 'python_quantum/qaoa_service.py')));
  const requirements = fs.readFileSync(path.join(root, 'requirements.txt'), 'utf8');
  assert.match(requirements, /qiskit==2\.5\.2/);
  assert.doesNotMatch(requirements, /ibm/i);
});

test('Vercel routes expose quantum optimize and status paths', () => {
  const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8')) as { rewrites?: Array<{ source: string; destination: string }>; functions?: Record<string, unknown> };
  const rewrites = vercel.rewrites ?? [];
  assert.ok(rewrites.some((r) => r.source === '/api/quantum-optimize' && r.destination.endsWith('quantum_optimize.py')));
  assert.ok(rewrites.some((r) => r.source === '/api/quantum-status' && r.destination.endsWith('quantum_status.py')));
  assert.ok(vercel.functions?.['api/quantum_optimize.py']);
  assert.ok(vercel.functions?.['api/quantum_status.py']);
});

test('environment contract includes QAOA tuning controls', () => {
  const env = fs.readFileSync(path.join(root, '.env.example'), 'utf8');
  for (const key of ['QUANTUM_MAX_CANDIDATES', 'QUANTUM_PARAMETER_GRID', 'QUANTUM_SHOTS']) {
    assert.match(env, new RegExp(`^${key}=`, 'm'));
  }
});
