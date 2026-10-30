import { NextResponse } from 'next/server';
import { placementQaoa } from '@/lib/quantum-v8/placement';
import type { QuantumOptimizationRequest } from '@/lib/quantumClient';
import { runQuantumCli, type QuantumCliPayload } from '@/lib/quantumLocalServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const CACHE_TTL_MS = 10 * 60 * 1000;
const cached = new Map<string, { at: number; result: unknown }>();
const inflight = new Map<string, Promise<unknown>>();
let busyKey: string | null = null;


export async function POST(request: Request): Promise<NextResponse> {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    if (process.env.VERCEL) return NextResponse.json(placementQaoa(payload as unknown as QuantumOptimizationRequest), { headers: { 'Cache-Control': 'no-store' } });
    const key = JSON.stringify(payload);
    const hit = cached.get(key);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return NextResponse.json(hit.result);
    let task = inflight.get(key);
    if (!task) {
      if (busyKey !== null) return NextResponse.json({ status: 'error', error: 'Quantum runtime is busy; retry shortly.' }, { status: 429 });
      busyKey = key;
      task = runQuantumCli({ ...payload, __operation: 'optimize' } as QuantumCliPayload);
      inflight.set(key, task);
    }
    let result: unknown;
    try {
      result = await task;
      cached.set(key, { at: Date.now(), result });
      if (cached.size > 50) cached.delete(cached.keys().next().value!);
    } finally {
      inflight.delete(key);
      if (busyKey === key) busyKey = null;
    }
    return NextResponse.json(result, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      error: `Local Qiskit simulator unavailable. Make sure start-local.bat has installed the Qiskit virtual environment. ${(error as Error).message}`,
    }, { status: 503, headers: { 'cache-control': 'no-store' } });
  }
}
