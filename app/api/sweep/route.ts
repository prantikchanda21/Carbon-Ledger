import { NextResponse } from 'next/server';
import { generateTelemetry } from '@/lib/mockData';
import { parseControllerRequest } from '@/lib/validation';
import { optimize } from '@/lib/optimizer';
import { runOnnxPolicy } from '@/lib/onnxInference';
import { solveClassicalDispatch } from '@/lib/classicalWasmSolver';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: Request): Promise<NextResponse> {
  const body = await request.json().catch(() => null) as { telemetry?: unknown; sla_values?: number[]; carbon_tax_values?: number[] };
  const telemetry = body?.telemetry ?? generateTelemetry(new Date(), false, true);
  const cleanList = (value: unknown, fallback: number[]): number[] => {
    if (!Array.isArray(value)) return fallback;
    const nums = value.filter((v): v is number => typeof v === 'number' && Number.isFinite(v)).slice(0, 12);
    return nums.length > 0 ? nums : fallback;
  };
  // Bounded grid (max 12 x 12) so a single request cannot exhaust the serverless function.
  const slaValues = cleanList(body?.sla_values, [10,20,30,40,50,60,70,80,90,100]);
  const taxValues = cleanList(body?.carbon_tax_values, [0,0.11,0.22,0.33,0.44,0.56,0.67,0.78,0.89,1]);
  const jobs = slaValues.flatMap((sla) => taxValues.map((tax) => ({ sla, tax })));
  // Bound concurrent ONNX/GLPK calls to avoid CPU spikes and memory pressure
  // in serverless functions. All requested grid cells are still evaluated.
  const results: Array<{ sla_ms: number; carbon_tax: number; cost: number; engine: string; gap: undefined } | null> = Array(jobs.length).fill(null);
  const concurrency = Math.min(4, jobs.length);
  let nextJob = 0;
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (nextJob < jobs.length) {
      const index = nextJob++;
      const { sla, tax } = jobs[index]!;
      const parsed = parseControllerRequest({ telemetry, sla_ms: sla, carbon_tax: tax, budget_cr: 249, treasury_yield: 6.8, dpdp_locked: false, shadow: false });
      if (!parsed.ok) continue;
      const result = await optimize(parsed.value, { onnx: runOnnxPolicy, classical: solveClassicalDispatch });
      results[index] = { sla_ms: sla, carbon_tax: tax, cost: result.cost.blended_unit_cost_usd_per_kwh, engine: result.engine, gap: undefined };
    }
  }));
  const cells = results.filter((cell): cell is NonNullable<typeof cell> => cell !== null);
  return NextResponse.json({ cells, generated_at: new Date().toISOString() });
}
