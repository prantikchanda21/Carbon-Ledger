import { NextResponse } from 'next/server';
import { generateTelemetry } from '@/lib/mockData';
import { scheduleWorkloads } from '@/lib/scheduler';
import type { ControlState, GridNodeTelemetry, Workload } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 8;

export async function POST(request: Request): Promise<NextResponse> {
  const body = await request.json().catch(() => null) as { workloads?: Workload[]; telemetry?: GridNodeTelemetry[]; controls?: ControlState };
  const workloads = body?.workloads ?? [];
  if (!Array.isArray(workloads)) return NextResponse.json({ error: 'workloads must be an array' }, { status: 400 });
  const telemetry = body.telemetry ?? generateTelemetry(new Date(), false, true);
  const controls = body.controls ?? { sla_ms: 25, carbon_tax: 0.5, budget_cr: 50, dpdp_locked: false };
  return NextResponse.json(scheduleWorkloads(workloads, telemetry, controls), { headers: { 'Cache-Control': 'no-store' } });
}
