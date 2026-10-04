import type { GridNodeTelemetry } from './types.ts';
import { isIndianRegion } from './regions.ts';

export function residencyViolation(node: GridNodeTelemetry): string | null {
  if (node.dpdp_locked && !isIndianRegion(node.region)) return `DPDP residency lock: ${node.region} is outside India`;
  return null;
}
export function slaViolation(node: GridNodeTelemetry, slaMs: number): string | null {
  if (node.latency_ms > slaMs) return `Latency ${node.latency_ms.toFixed(1)} ms exceeds ${slaMs} ms SLA`;
  return null;
}
