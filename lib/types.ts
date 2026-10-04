export type RegionId = 'mumbai' | 'hyderabad' | 'delhi' | 'singapore' | 'tokyo' | 'seoul' | 'sydney' | 'frankfurt' | 'dublin' | 'london' | 'stockholm' | 'paris' | 'madrid' | 'zurich' | 'virginia' | 'oregon' | 'iowa' | 'toronto' | 'sao_paulo' | 'johannesburg';

export interface GridNodeTelemetry {
  region: string;
  carbon_ci: number;
  energy_price: number;
  latency_ms: number;
  dpdp_locked: boolean;
  egress_cost_gb: number;
  renewable_pct?: number;
  available?: boolean;
  source?: 'electricity-maps' | 'mock' | 'stale';
  timestamp?: number;
}

export interface TreasuryAllocation {
  liquid_funds_pct: number;
  green_bonds_pct: number;
  carbon_futures_pct: number;
  projected_apy: number;
}

export type EngineKind = 'onnx' | 'glpk-wasm' | 'greedy-safe';
export type ComplianceStatus = 'COMPLIANT' | 'SLA_BREACH';

export interface ControllerRequest {
  telemetry?: GridNodeTelemetry[];
  sla_ms: number;
  carbon_tax: number;
  budget_cr: number;
  treasury_yield: number;
  dpdp_locked: boolean;
  shadow?: boolean;
  chaos?: 'none' | 'onnx' | 'both';
  evaluation_key?: string;
}

export interface ResolvedRequest extends Omit<ControllerRequest, 'telemetry'> {
  telemetry: GridNodeTelemetry[];
}

export interface UnitCost {
  energy: number;
  carbon: number;
  egress: number;
  total: number;
}

export interface NodeAssessment {
  id: RegionId;
  telemetry: GridNodeTelemetry;
  eligible: boolean;
  exclusion_reason: string | null;
  unit_cost: UnitCost;
}

export interface PolicyFeatures {
  carbon_intensity: number;
  energy_price: number;
  treasury_yield: number;
  latency_sla: number;
  model_input?: number[];
}

export interface NodeReport {
  id: RegionId;
  city: string;
  region: string;
  energy_price: number;
  carbon_ci: number;
  latency_ms: number;
  renewable_pct: number;
  unit_cost_usd_per_kwh: number;
  weight: number;
  eligible: boolean;
  exclusion_reason: string | null;
  source?: GridNodeTelemetry['source'];
}

export interface OptimizationResult {
  engine: EngineKind;
  fallback_reason: string | null;
  ai_architecture?: { model_version: string; model_regions: number; output_regions: number; training_pipeline: 'qiskit-qaoa-reference' | 'qiskit-qaoa'; };
  allocations: {
    node_weights: Record<RegionId, number>;
    treasury: TreasuryAllocation;
    hedge_pct: number;
  };
  latency: {
    execution_ms: number;
    init_ms: number;
    weighted_network_ms: number;
    max_used_latency_ms: number;
    sla_ms: number;
    sla_compliant: boolean;
  };
  carbon_avoided: {
    gross_tco2_per_day: number;
    net_footprint_mt: number;
    carbon_avoided_t: number;
    offset_pct: number;
    offset_roi_pct: number;
    blended_ci: number;
    baseline_ci: number;
    ci_shift_pct: number;
  };
  treasury_income_inr: number;
  cost: {
    blended_unit_cost_usd_per_kwh: number;
    operating_cost_usd_per_day: number;
  };
  compliance: {
    status: ComplianceStatus;
    dpdp_locked: boolean;
    residency_ok: boolean;
    excluded: Array<{ region: RegionId; reason: string }>;
    notes: string[];
  };
  nodes: NodeReport[];
  shadow?: {
    available: boolean;
    optimal_engine: EngineKind;
    optimal_cost_usd_per_kwh: number;
    surrogate_cost_usd_per_kwh: number;
    cost_gap_pct: number;
  };
  engine_race?: {
    onnx_ms: number | null;
    glpk_ms: number | null;
    target_ms: number;
  };
  evaluation_key?: string;
  /** Present when the allocation was set by hand rather than by the optimizer. */
  manual_override?: { active: true; cost_gap_pct: number; optimizer_blended_ci: number };
}

export interface ControllerErrorBody { error: string; }

export interface ControlState {
  sla_ms: number;
  carbon_tax: number;
  budget_cr: number;
  dpdp_locked: boolean;
}

export type FeedSource = 'api' | 'fallback' | 'loading' | 'electricity-maps' | 'mixed';

export interface Workload {
  id: string;
  name: string;
  dpdp_locked: boolean;
  latency_need_ms: number;
  deferrable: boolean;
  kwh: number;
  deadline_hour: number;
  preferred_region?: RegionId;
}

export interface ScheduleAssignment {
  workload_id: string;
  region: RegionId;
  hour_utc: number;
  carbon_ci: number;
  energy_price: number;
  reason: string;
}

export interface ScheduleResult {
  assignments: ScheduleAssignment[];
  total_kwh: number;
  carbon_tonnes: number;
  cost_usd: number;
  deferred_jobs: number;
  generated_at: string;
}

export type ControllerEventType = 'heatwave_mumbai' | 'wind_surge_frankfurt' | 'virginia_outage' | 'carbon_tax_double';

export interface ControllerEvent {
  id: string;
  type: ControllerEventType;
  label: string;
  startedAt: number;
  durationHours: number;
  intensity: number;
}

export interface Scenario {
  name: string;
  controls: ControlState;
  telemetry: GridNodeTelemetry[];
  createdAt: number;
  result?: OptimizationResult;
}

export interface DecisionLogEntry {
  id: string;
  timestamp: number;
  engine: EngineKind;
  reasonCodes: Array<'SLA' | 'DPDP' | 'fallback' | 'hedge_change' | 'carbon_shift' | 'scheduler' | 'event'>;
  summary: string;
  cost_usd_per_kwh: number;
  blended_ci: number;
  allocation: Record<RegionId, number>;
}

export interface RegionCatalogEntry {
  id: RegionId;
  city: string;
  code: string;
  provider: 'AWS' | 'GCP' | 'Azure';
  lat: number;
  lon: number;
  macro: 'asia' | 'europe' | 'americas';
  renewable_baseline_pct: number;
  grid_zone: string;
}

export interface CommandIntent {
  controls: Partial<ControlState>;
  message: string;
  confidence: number;
  source: 'groq' | 'deterministic';
}

export interface FeedSample {
  telemetry: GridNodeTelemetry[];
  source: FeedSource;
  fetchedAt: number;
}

export interface ForecastPoint {
  hourUtc: number;
  label: string;
  mean: number;
  low: number;
  high: number;
  price: number;
}

export interface ForecastRegion {
  region: RegionId;
  points: ForecastPoint[];
}

export interface AnomalyReport {
  ewma: number;
  zScore: number;
  spike: boolean;
  stale: boolean;
  quality: 'good' | 'watch' | 'stale';
}
