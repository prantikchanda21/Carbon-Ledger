import type { ControlState, GridNodeTelemetry, RegionId } from './types.ts';

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b] = parts as [number, number, number, number];
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

function isLocalRuntime(): boolean {
  if (process.env.NEXT_PUBLIC_QUANTUM_LOCAL === '1') return true;
  if (typeof window === 'undefined') return false;
  const { hostname, port } = window.location;
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0' || isPrivateIpv4(hostname) || port === '3000';
}

function quantumEndpoints(): { optimize: string; status: string } {
  return isLocalRuntime()
    ? { optimize: '/api/quantum-local/optimize', status: '/api/quantum-local/status' }
    : { optimize: '/api/quantum-optimize', status: '/api/quantum-status' };
}
import { REGIONS, REGION_ORDER } from './regions.ts';

export interface QuantumOptimizationRequest {
  regions: Array<{
    id: RegionId;
    code: string;
    carbon_ci: number;
    energy_price: number;
    latency_ms: number;
    egress_cost_gb: number;
    eligible: boolean;
  }>;
  sla_ms: number;
  carbon_tax: number;
  budget_cr: number;
  treasury_yield: number;
  dpdp_locked: boolean;
  mode: 'simulator';
  shots?: number;
  benchmark?: boolean;
}

export interface QuantumOptimizationResult {
  status: 'queued' | 'completed' | 'done' | 'cancelled' | 'error' | 'failed';
  job_id: string | null;
  mode: 'qiskit-simulator';
  backend: string;
  candidate_region_ids: RegionId[];
  weights?: Partial<Record<RegionId, number>>;
  hedge_pct?: number;
  qaoa_cost_usd_per_kwh?: number;
  execution_ms?: number | null;
  penalized_circuit_energy?: number;
  decode_ms?: number;
  submitted_ms?: number;
  poll_ms?: number;
  quantum_verified?: boolean;
  error?: string;
}

export function buildQuantumRequest(telemetry: GridNodeTelemetry[], controls: ControlState, mode: QuantumOptimizationRequest['mode']): QuantumOptimizationRequest {
  const regions = REGION_ORDER.map((id) => {
    const catalog = REGIONS[id];
    const node = telemetry.find((item) => item.region === catalog.code);
    return {
      id,
      code: catalog.code,
      carbon_ci: node?.carbon_ci ?? 9999,
      energy_price: node?.energy_price ?? 9999,
      latency_ms: node?.latency_ms ?? 9999,
      egress_cost_gb: node?.egress_cost_gb ?? 0.1,
      eligible: Boolean(node?.available !== false && node?.latency_ms !== undefined && node.latency_ms <= controls.sla_ms && (!controls.dpdp_locked || ['ap-south-1', 'ap-south-2', 'asia-south2'].includes(catalog.code))),
    };
  });
  return {
    regions,
    sla_ms: controls.sla_ms,
    carbon_tax: controls.carbon_tax,
    budget_cr: controls.budget_cr,
    treasury_yield: 6.8,
    dpdp_locked: controls.dpdp_locked,
    mode,
    shots: 512,
  };
}

export async function submitQuantum(request: QuantumOptimizationRequest, signal?: AbortSignal): Promise<QuantumOptimizationResult> {
  const response = await fetch(quantumEndpoints().optimize, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(request),
    signal,
  });
  const text = await response.text();
  let body: QuantumOptimizationResult;
  try {
    body = JSON.parse(text) as QuantumOptimizationResult;
  } catch {
    throw new Error(`Quantum endpoint returned non-JSON (HTTP ${response.status}). Check the local Qiskit helper or Vercel Python route. Response: ${text.slice(0, 140)}`);
  }
  if (!response.ok && response.status !== 202) throw new Error(body.error ?? `Quantum route returned HTTP ${response.status}`);
  return body;
}

export async function pollQuantum(jobId: string, request: QuantumOptimizationRequest, signal?: AbortSignal): Promise<QuantumOptimizationResult> {
  const response = await fetch(quantumEndpoints().status, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ job_id: jobId, payload: request }),
    cache: 'no-store',
    signal,
  });
  const text = await response.text();
  let body: QuantumOptimizationResult;
  try {
    body = JSON.parse(text) as QuantumOptimizationResult;
  } catch {
    throw new Error(`Quantum status endpoint returned non-JSON (HTTP ${response.status}). Response: ${text.slice(0, 140)}`);
  }
  if (!response.ok && response.status !== 202) throw new Error(body.error ?? `Quantum status returned HTTP ${response.status}`);
  return body;
}
