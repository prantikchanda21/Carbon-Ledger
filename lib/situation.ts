import type { ControlState, ControllerEvent, DecisionLogEntry, GridNodeTelemetry, OptimizationResult } from './types.ts';
import { REGIONS, REGION_ORDER } from './regions.ts';

export interface SituationFacts {
  time_utc: string;
  data_source: 'synthetic demo data' | 'live carbon feed' | 'mixed live and synthetic';
  engine: string;
  controls: ControlState;
  compliance: { status: string; residency_ok: boolean; excluded: Array<{ city: string; reason: string }> };
  top_allocations: Array<{ city: string; weight_pct: number; carbon_gco2_kwh: number; price_usd_mwh: number; latency_ms: number }>;
  cleanest: { city: string; carbon_gco2_kwh: number } | null;
  dirtiest: { city: string; carbon_gco2_kwh: number } | null;
  cheapest: { city: string; price_usd_mwh: number } | null;
  blended_carbon_gco2_kwh: number | null;
  baseline_carbon_gco2_kwh: number | null;
  carbon_shift_pct: number | null;
  blended_cost_usd_kwh: number | null;
  latency: { weighted_ms: number; sla_ms: number; compliant: boolean } | null;
  treasury: { liquid_pct: number; green_bonds_pct: number; carbon_futures_pct: number; apy_pct: number; hedge_pct: number } | null;
  net_footprint_mt_per_day: number | null;
  offset_pct: number | null;
  active_events: string[];
  manual_override: boolean;
  recent_decisions: Array<{ minutes_ago: number; summary: string; reasons: string[] }>;
}

const r1 = (n: number): number => Math.round(n * 10) / 10;
const r2 = (n: number): number => Math.round(n * 100) / 100;

/** Collects a compact, numeric snapshot of the dashboard. Everything here is calculated by the app, never by a model. */
export function buildSituation(
  telemetry: GridNodeTelemetry[], controls: ControlState, result: OptimizationResult | null,
  events: ControllerEvent[], decisions: DecisionLogEntry[], time: Date,
): SituationFacts {
  const live = telemetry.filter((t) => t.source === 'electricity-maps').length;
  const nodes = result?.nodes ?? [];
  const byWeight = [...nodes].filter((n) => n.weight > 0.005).sort((a, b) => b.weight - a.weight).slice(0, 5);
  const eligible = nodes.filter((n) => n.eligible);
  const pool = eligible.length ? eligible : nodes;
  const cleanest = pool.length ? pool.reduce((a, b) => (b.carbon_ci < a.carbon_ci ? b : a)) : null;
  const dirtiest = pool.length ? pool.reduce((a, b) => (b.carbon_ci > a.carbon_ci ? b : a)) : null;
  const cheapest = pool.length ? pool.reduce((a, b) => (b.energy_price < a.energy_price ? b : a)) : null;
  const t = result?.allocations.treasury;
  const now = time.getTime();
  const active = events.filter((e) => now - e.startedAt < e.durationHours * 3_600_000).map((e) => e.label);
  return {
    time_utc: time.toISOString().slice(0, 16).replace('T', ' ') + ' UTC',
    data_source: live === 0 ? 'synthetic demo data' : live === telemetry.length ? 'live carbon feed' : 'mixed live and synthetic',
    engine: result?.engine ?? 'not yet computed',
    controls,
    compliance: {
      status: result?.compliance.status ?? 'unknown',
      residency_ok: result?.compliance.residency_ok ?? true,
      excluded: (result?.compliance.excluded ?? []).slice(0, 6).map((x) => ({ city: REGIONS[x.region]?.city ?? x.region, reason: x.reason })),
    },
    top_allocations: byWeight.map((n) => ({ city: n.city, weight_pct: r1(n.weight * 100), carbon_gco2_kwh: r1(n.carbon_ci), price_usd_mwh: r1(n.energy_price), latency_ms: r1(n.latency_ms) })),
    cleanest: cleanest ? { city: cleanest.city, carbon_gco2_kwh: r1(cleanest.carbon_ci) } : null,
    dirtiest: dirtiest ? { city: dirtiest.city, carbon_gco2_kwh: r1(dirtiest.carbon_ci) } : null,
    cheapest: cheapest ? { city: cheapest.city, price_usd_mwh: r1(cheapest.energy_price) } : null,
    blended_carbon_gco2_kwh: result ? r1(result.carbon_avoided.blended_ci) : null,
    baseline_carbon_gco2_kwh: result ? r1(result.carbon_avoided.baseline_ci) : null,
    carbon_shift_pct: result ? r1(result.carbon_avoided.ci_shift_pct) : null,
    blended_cost_usd_kwh: result ? Math.round(result.cost.blended_unit_cost_usd_per_kwh * 10000) / 10000 : null,
    latency: result ? { weighted_ms: r1(result.latency.weighted_network_ms), sla_ms: result.latency.sla_ms, compliant: result.latency.sla_compliant } : null,
    treasury: t ? { liquid_pct: r1(t.liquid_funds_pct), green_bonds_pct: r1(t.green_bonds_pct), carbon_futures_pct: r1(t.carbon_futures_pct), apy_pct: r2(t.projected_apy), hedge_pct: r1(result?.allocations.hedge_pct ?? 0) } : null,
    net_footprint_mt_per_day: result ? r2(result.carbon_avoided.net_footprint_mt) : null,
    offset_pct: result ? r1(result.carbon_avoided.offset_pct) : null,
    active_events: active,
    manual_override: !!result?.manual_override,
    recent_decisions: decisions.slice(0, 4).map((d) => ({ minutes_ago: Math.max(0, Math.round((Date.now() - d.timestamp) / 60000)), summary: d.summary.slice(0, 160), reasons: d.reasonCodes })),
  };
}

/** Rule-based summary used when no Groq key is set or the request fails. Uses only the supplied facts. */
export function describeSituation(f: SituationFacts): string {
  const out: string[] = [];
  const top = f.top_allocations;
  if (top.length) {
    const lead = top.slice(0, 3).map((a) => `${a.city} (${a.weight_pct}%)`).join(', ');
    out.push(`The controller is placing most workload in ${lead}.`);
    const why: string[] = [];
    if (f.cleanest && top[0].city === f.cleanest.city) why.push(`${top[0].city} has the cleanest power right now at ${f.cleanest.carbon_gco2_kwh} gCO₂/kWh`);
    else if (f.cheapest && top[0].city === f.cheapest.city) why.push(`${top[0].city} has the lowest energy price at ${f.cheapest.price_usd_mwh} USD/MWh`);
    else why.push(`${top[0].city} gives the best mix of price, carbon and latency under your carbon tax setting of ${f.controls.carbon_tax}`);
    out.push(why[0] + '.');
  } else out.push('No allocation has been computed yet.');
  if (f.blended_carbon_gco2_kwh !== null && f.baseline_carbon_gco2_kwh !== null && f.carbon_shift_pct !== null)
    out.push(`Blended carbon intensity is ${f.blended_carbon_gco2_kwh} gCO₂/kWh against a baseline of ${f.baseline_carbon_gco2_kwh}, which is ${Math.abs(f.carbon_shift_pct)}% ${f.blended_carbon_gco2_kwh <= f.baseline_carbon_gco2_kwh ? 'cleaner' : 'dirtier'} than baseline.`);
  if (f.blended_cost_usd_kwh !== null) out.push(`Blended cost is about ${f.blended_cost_usd_kwh} USD/kWh.`);
  if (f.latency) out.push(f.latency.compliant ? `Latency is ${f.latency.weighted_ms} ms, inside your ${f.latency.sla_ms} ms limit.` : `Latency is ${f.latency.weighted_ms} ms, which breaks your ${f.latency.sla_ms} ms limit.`);
  if (f.controls.dpdp_locked) out.push('India-only residency is on, so non-Indian regions are excluded.');
  else if (f.compliance.excluded.length) out.push(`${f.compliance.excluded.length} region(s) are excluded: ${f.compliance.excluded.slice(0, 3).map((x) => `${x.city} (${x.reason})`).join('; ')}.`);
  if (f.active_events.length) out.push(`Active events: ${f.active_events.join(', ')}.`);
  if (f.manual_override) out.push('You pinned a manual allocation, so it overrides the optimizer.');
  if (f.treasury) out.push(`Treasury: ${f.treasury.liquid_pct}% liquid, ${f.treasury.green_bonds_pct}% green bonds, ${f.treasury.carbon_futures_pct}% carbon futures, projected yield ${f.treasury.apy_pct}%.`);
  out.push(`Data is ${f.data_source}.`);
  return out.join(' ');
}
