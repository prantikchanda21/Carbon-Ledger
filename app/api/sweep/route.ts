import { NextResponse } from 'next/server';
import { generateTelemetry } from '@/lib/mockData';
import { parseControllerRequest } from '@/lib/validation';
import { optimize } from '@/lib/optimizer';
import { runOnnxPolicy } from '@/lib/onnxInference';
import { solveClassicalDispatch } from '@/lib/classicalWasmSolver';

export const runtime = 'nodejs';
export const maxDuration = 10;

export async function POST(request: Request): Promise<NextResponse> {
  const body = await request.json().catch(() => null) as { telemetry?: unknown; sla_values?: number[]; carbon_tax_values?: number[] };
  const telemetry = body?.telemetry ?? generateTelemetry(new Date(), false, true);
  const slaValues = body?.sla_values ?? [10,20,30,40,50,60,70,80,90,100];
  const taxValues = body?.carbon_tax_values ?? [0,0.11,0.22,0.33,0.44,0.56,0.67,0.78,0.89,1];
  const jobs = slaValues.flatMap((sla) => taxValues.map((tax) => ({ sla, tax })));
  const results = await Promise.all(jobs.map(async ({ sla, tax }) => {
    const parsed = parseControllerRequest({ telemetry, sla_ms: sla, carbon_tax: tax, budget_cr: 50, treasury_yield: 6.8, dpdp_locked: false, shadow: false });
    if (!parsed.ok) return null;
    const result = await optimize(parsed.value, { onnx: runOnnxPolicy, classical: solveClassicalDispatch });
    return { sla_ms: sla, carbon_tax: tax, cost: result.cost.blended_unit_cost_usd_per_kwh, engine: result.engine, gap: undefined };
  }));
  const cells = results.filter((cell): cell is NonNullable<typeof cell> => cell !== null);
  return NextResponse.json({ cells, generated_at: new Date().toISOString() });
}
