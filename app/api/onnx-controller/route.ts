import { NextResponse } from 'next/server';
import type { ControllerErrorBody, OptimizationResult } from '@/lib/types';
import { generateTelemetry } from '@/lib/mockData';
import { parseControllerRequest } from '@/lib/validation';
import { ControllerInputError, optimize } from '@/lib/optimizer';
import { runOnnxPolicy } from '@/lib/onnxInference';
import { solveClassicalDispatch } from '@/lib/classicalWasmSolver';
import { getRegionalFeed } from '@/lib/feeds/registry';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 10;
const NO_STORE = { 'Cache-Control': 'no-store' } as const;

function fail(status: number, error: string): NextResponse<ControllerErrorBody> {
  return NextResponse.json({ error }, { status, headers: NO_STORE });
}

export async function GET(): Promise<NextResponse> {
  try {
    const feed = await getRegionalFeed();
    return NextResponse.json({ telemetry: feed.telemetry, source: feed.source, generated_at: new Date().toISOString() }, { headers: NO_STORE });
  } catch {
    return NextResponse.json({ telemetry: generateTelemetry(new Date(), false, true), source: 'fallback', generated_at: new Date().toISOString() }, { headers: NO_STORE });
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try { body = await request.json(); } catch { return fail(400, 'Request body must be valid JSON'); }
  const parsed = parseControllerRequest(body);
  if (!parsed.ok) return fail(400, parsed.error);
  try {
    const result: OptimizationResult = await optimize(parsed.value, { onnx: runOnnxPolicy, classical: solveClassicalDispatch });
    return NextResponse.json(result, { headers: NO_STORE });
  } catch (error) {
    if (error instanceof ControllerInputError) return fail(422, error.message);
    console.error('[onnx-controller] unexpected failure', error);
    return fail(500, 'Controller failed to produce an allocation');
  }
}
