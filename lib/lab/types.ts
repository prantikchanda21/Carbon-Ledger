import type { ControlState, GridNodeTelemetry, RegionId } from '../types.ts';
export const LAB_VERSION = '5.0.0';
export interface Job {
  id: string; name: string; current: RegionId; duration: number; deadline: number; earliest: number;
  cpu: number; gpu: number; kwh: number; dataGb: number; latency: number; indiaOnly: boolean; dependencies: string[];
}
export interface Capacity { cpu: number; gpu: number }
export interface Snapshot { at: string; telemetry: GridNodeTelemetry[] }
export interface MigrationSettings { transferKwhPerGb: number; bandwidthGbPerHour: number; startupHours: number; downtimeUsdPerHour: number }
export interface LabInput {
  version: string; name: string; seed: number; start: string; controls: ControlState; jobs: Job[];
  capacity: Record<RegionId, Capacity>; migration: MigrationSettings; history: Snapshot[];
  horizon: number; carbonPriceUsdT: number;
}
export interface Choice {
  job: string; region: RegionId; start: number; finish: number; energyUsd: number; carbonKg: number;
  carbonUsd: number; transferUsd: number; downtimeUsd: number; transferKg: number; totalUsd: number;
  migrationHours: number; migrationKwh: number; breakEvenHours: number | null;
}
export interface Rejection { region: RegionId; reason: string }
export interface Schedule {
  choices: Choice[]; alternatives: Record<string, Choice[]>; rejected: Record<string, Rejection[]>; unscheduled: { job: string; reason: string }[];
  totalUsd: number; carbonKg: number; migrationUsd: number; energyKwh: number;
}
export interface Comparison { baseline: Schedule; optimized: Schedule; comparable: boolean; savingsUsd: number; avoidedKg: number }
export interface Audit { at: string; action: string; detail: string }
export interface Plan { status: 'draft'|'approved'|'executed'|'rolled-back'; fingerprint: string; audit: Audit[] }
export interface Experiment { id: string; input: LabInput; savedAt: string; comparison: Comparison; plan: Plan; benchmark?: unknown }
