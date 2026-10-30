import { NextResponse } from 'next/server';
import { onnxHealth } from '@/lib/onnxInference';
import { solveClassicalDispatch } from '@/lib/classicalWasmSolver';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 15;

const within = async <T>(job: Promise<T>, ms: number): Promise<T> => {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([job, new Promise<T>((_, reject) => { timeout = setTimeout(() => reject(new Error('health check timeout')), ms); })]);
  } finally { if (timeout) clearTimeout(timeout); }
};
export async function GET(): Promise<NextResponse> {
  const health: Record<string, unknown> = {
    version: process.env.npm_package_version ?? '27.1.0',
    node: process.version,
    default_engine: process.env.ENGINE_DEFAULT === 'glpk' ? 'glpk' : 'onnx',
    timestamp: new Date().toISOString(),
  };
  try { health.onnx = await within(onnxHealth(), 1200); }
  catch (error) { health.onnx = { model_found: false, error: String(error) }; }
  try {
    const result = await within(solveClassicalDispatch({ costs: [1, 2], eligible: [true, true], cap: 1, ids: ['mumbai', 'frankfurt'] }), 8000);
    health.glpk = { available: true, lp_solved: Math.abs(result.weights.reduce((a,b) => a+b, 0) - 1) < 1e-6, init_ms: result.init_ms };
  } catch (error) { health.glpk = { available: false, lp_solved: false, error: String(error) }; }
  const pythonUrl = process.env.VERCEL ? undefined : process.env.QUANTUM_LOCAL_PYTHON_URL;
  if (pythonUrl) {
    try {
      const endpoint = new URL(pythonUrl);
      if (!['http:', 'https:'].includes(endpoint.protocol)) throw new Error('Unsupported protocol');
      const response = await fetch(endpoint, { signal: AbortSignal.timeout(1200), cache: 'no-store' });
      health.quantum = { configured: true, reachable: response.status < 500, status: response.status };
    } catch (error) { health.quantum = { configured: true, reachable: false, error: String(error) }; }
  } else health.quantum = { configured: false, reachable: false, detail: 'No local Python worker configured; precomputed quantum results remain usable' };
  return NextResponse.json(health, { headers: { 'Cache-Control': 'no-store' } });
}
