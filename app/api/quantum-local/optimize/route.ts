import { NextResponse } from 'next/server';
import { runQuantumCli, type QuantumCliPayload } from '@/lib/quantumLocalServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 125;

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const result = await runQuantumCli({ ...payload, __operation: 'optimize' } as QuantumCliPayload);
    return NextResponse.json(result, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      error: `Local Qiskit simulator unavailable. Make sure start-local.bat has installed the Qiskit virtual environment. ${(error as Error).message}`,
    }, { status: 503, headers: { 'cache-control': 'no-store' } });
  }
}
