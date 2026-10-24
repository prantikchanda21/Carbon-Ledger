import type { EngineMode } from './quantumEngineModes';
import type { OptimizationResult } from './types';
import { OFFSET_PRICE_USD_PER_TONNE, INR_PER_CRORE, USD_INR } from './constants.ts';

/** An immutable, completed-engine KPI snapshot for the dashboard summary cards.
 * Never compute a snapshot from an incomplete optimizer preview.
 */
export interface DashboardKpiSnapshot {
  engine: EngineMode;
  carbonIntensity: number;
  carbonShiftPct: number;
  netFootprintMt: number;
  offsetPct: number;
  grossTreasuryApy: number;
  netTreasuryApy: number | null;
  networkLatencyMs: number;
  latencySlaCompliant: boolean;
  surrogateGapPct: number | null;
  carbonTrend: number[];
  treasuryTrend: number[];
}

export function makeDashboardKpiSnapshot(
  result: OptimizationResult,
  engine: EngineMode,
  budgetCr: number,
  series: ReadonlyArray<{ blended: number; apy: number }>,
): DashboardKpiSnapshot {
  const carbon = result.carbon_avoided;
  const treasury = result.allocations.treasury;
  // Treasury return excludes cloud OPEX, which is accounted for separately.
  const netTreasuryApy = budgetCr > 0
    ? (result.treasury_income_inr - carbon.offset_pct / 100 * carbon.gross_tco2_per_day * OFFSET_PRICE_USD_PER_TONNE * 365 * USD_INR) /
      (budgetCr * INR_PER_CRORE) * 100
    : null;
  const apyDifference = netTreasuryApy === null ? 0 : treasury.projected_apy - netTreasuryApy;
  return {
    engine,
    carbonIntensity: carbon.blended_ci,
    carbonShiftPct: carbon.ci_shift_pct,
    netFootprintMt: carbon.net_footprint_mt,
    offsetPct: carbon.offset_pct,
    grossTreasuryApy: treasury.projected_apy,
    netTreasuryApy,
    networkLatencyMs: result.latency.weighted_network_ms,
    latencySlaCompliant: result.latency.sla_compliant,
    surrogateGapPct: result.shadow?.available ? result.shadow.cost_gap_pct : null,
    carbonTrend: series.map(s => s.blended),
    treasuryTrend: series.map(s => s.apy - apyDifference),
  };
}
