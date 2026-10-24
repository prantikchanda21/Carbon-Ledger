import { spawn } from 'node:child_process';
import path from 'node:path';

function pythonPath(): string {
  const configured = process.env.QUANTUM_PYTHON_PATH;
  if (configured) return configured;
  const root = process.cwd();
  return process.platform === 'win32'
    ? path.join(root, 'qiskit_train', '.venv', 'Scripts', 'python.exe')
    : path.join(root, 'qiskit_train', '.venv', 'bin', 'python');
}

export interface QuantumCliPayload {
  __operation: 'optimize' | 'status';
  __job_id?: string;
  [key: string]: unknown;
}

export function runQuantumCli(payload: QuantumCliPayload, timeoutMs = 120_000): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const child = spawn(pythonPath(), ['-u', path.join(process.cwd(), 'scripts', 'quantum_cli.py')], {
      cwd: process.cwd(),
      env: process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill();
      reject(new Error(`Local Qiskit process timed out after ${timeoutMs} ms.`));
    }, timeoutMs);

    child.stdout.on('data', (chunk: Buffer | string) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk: Buffer | string) => { stderr += chunk.toString(); });
    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error(`Unable to start local Qiskit Python process: ${error.message}`));
    });
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const trimmed = stdout.trim();
      if (!trimmed) {
        reject(new Error(`Local Qiskit process exited with code ${code ?? 'unknown'}${stderr ? `: ${stderr.trim()}` : ''}`));
        return;
      }
      try {
        const parsed = JSON.parse(trimmed) as Record<string, unknown>;
        if (parsed.status === 'error' && parsed.error) {
          reject(new Error(String(parsed.error)));
          return;
        }
        resolve(parsed);
      } catch {
        reject(new Error(`Local Qiskit returned invalid JSON: ${trimmed.slice(0, 300)}${stderr ? ` | ${stderr.trim().slice(0, 300)}` : ''}`));
      }
    });

    child.stdin.on('error', () => { /* Spawn/close handlers report an unavailable Python runtime. */ });
    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();
  });
}
