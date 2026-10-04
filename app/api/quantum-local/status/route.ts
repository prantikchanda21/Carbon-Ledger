import { NextResponse } from 'next/server';
import { runQuantumCli, type QuantumCliPayload } from '@/lib/quantumLocalServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 65;

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = (await request.json()) as { job_id?: string; payload?: Record<string, unknown> };
    const payload = body.payload ?? {};
    const result = await runQuantumCli({
      ...payload,
      __operation: 'status',
      __job_id: body.job_id ?? '',
    } as QuantumCliPayload);
    return NextResponse.json(result, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      error: `Local Qiskit status unavailable. ${(error as Error).message}`,
    }, { status: 503, headers: { 'cache-control': 'no-store' } });
  }
}
