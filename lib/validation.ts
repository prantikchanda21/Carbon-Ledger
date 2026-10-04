import type { GridNodeTelemetry, RegionId, ResolvedRequest } from './types.ts';
import { DEFAULT_TREASURY_YIELD } from './constants.ts';
import { CORE_REGION_ORDER, resolveRegionId } from './regions.ts';
import { generateTelemetry } from './mockData.ts';
class ValidationError extends Error {}
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
function readNumber(source: Record<string, unknown>, key: string, fallback: number, min: number, max: number): number {
  const raw = source[key]; if (raw === undefined) return fallback;
  if (typeof raw !== 'number' || !Number.isFinite(raw)) throw new ValidationError(`${key} must be a finite number`);
  if (raw < min || raw > max) throw new ValidationError(`${key} must be between ${min} and ${max}`);
  return raw;
}
function parseNode(value: unknown, index: number): GridNodeTelemetry {
  if (!isRecord(value)) throw new ValidationError(`telemetry[${index}] must be an object`);
  const region = value.region;
  if (typeof region !== 'string' || resolveRegionId(region) === null) throw new ValidationError(`telemetry[${index}].region is not supported`);
  const num = (key: string, min: number, max: number): number => {
    const v = value[key]; if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) throw new ValidationError(`telemetry[${index}].${key} must be a number between ${min} and ${max}`);
    return v;
  };
  const locked = value.dpdp_locked;
  if (locked !== undefined && typeof locked !== 'boolean') throw new ValidationError(`telemetry[${index}].dpdp_locked must be a boolean`);
  return {
    region, carbon_ci: num('carbon_ci', 0, 2000), energy_price: num('energy_price', 0, 5000), latency_ms: num('latency_ms', 0, 5000),
    dpdp_locked: locked ?? false, egress_cost_gb: num('egress_cost_gb', 0, 10),
    renewable_pct: typeof value.renewable_pct === 'number' ? value.renewable_pct : undefined,
    available: typeof value.available === 'boolean' ? value.available : true,
    source: typeof value.source === 'string' ? value.source as GridNodeTelemetry['source'] : undefined,
    timestamp: typeof value.timestamp === 'number' ? value.timestamp : undefined,
  };
}
function parseTelemetry(value: unknown): GridNodeTelemetry[] {
  if (!Array.isArray(value)) throw new ValidationError('telemetry must be an array');
  const nodes = value.map(parseNode);
  const seen = new Set<RegionId>();
  for (const node of nodes) {
    const id = resolveRegionId(node.region)!;
    if (seen.has(id)) throw new ValidationError(`telemetry contains ${id} more than once`);
    seen.add(id);
  }
  for (const id of CORE_REGION_ORDER) if (!seen.has(id)) throw new ValidationError(`telemetry is missing region ${id}`);
  return nodes;
}
export type ParseOutcome = { ok: true; value: ResolvedRequest } | { ok: false; error: string };
export function parseControllerRequest(body: unknown): ParseOutcome {
  try {
    if (!isRecord(body)) throw new ValidationError('Request body must be a JSON object');
    const dpdp = body.dpdp_locked; if (dpdp !== undefined && typeof dpdp !== 'boolean') throw new ValidationError('dpdp_locked must be a boolean');
    const dpdp_locked = dpdp ?? false;
    const telemetry = body.telemetry === undefined ? generateTelemetry(new Date(), dpdp_locked, true) : parseTelemetry(body.telemetry);
    const shadow = body.shadow === true;
    const chaos = body.chaos === 'onnx' || body.chaos === 'both' ? body.chaos : 'none';
    return { ok: true, value: {
      sla_ms: readNumber(body, 'sla_ms', 25, 1, 1000),
      carbon_tax: readNumber(body, 'carbon_tax', 0.5, 0, 1),
      budget_cr: readNumber(body, 'budget_cr', 50, 1, 1000),
      treasury_yield: readNumber(body, 'treasury_yield', DEFAULT_TREASURY_YIELD, 0, 30),
      dpdp_locked, telemetry: telemetry.map((node) => ({ ...node, dpdp_locked })),
      shadow, chaos, evaluation_key: typeof body.evaluation_key === 'string' ? body.evaluation_key : undefined,
    }};
  } catch (error) { if (error instanceof ValidationError) return { ok: false, error: error.message }; throw error; }
}
export function isTelemetryFeed(value: unknown): value is GridNodeTelemetry[] {
  try { parseTelemetry(value); return true; } catch { return false; }
}
