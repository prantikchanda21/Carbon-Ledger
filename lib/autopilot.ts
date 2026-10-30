import type { ControlState } from './types.ts';
import { clamp } from './controllerMath.ts';
import { millionToCr } from './budgetUsd.ts';
import { BUDGET_MAX_CR, BUDGET_MIN_CR, SLA_MAX_MS, SLA_MIN_MS } from './constants.ts';
import type { GridNodeTelemetry } from './types.ts';

export interface AutopilotState { active: boolean; progress: number; target: ControlState; label: string; }
export const NET_ZERO_TARGETS: ControlState = { sla_ms: 30, carbon_tax: 0.88, budget_cr: millionToCr(50), dpdp_locked: false };

/** Run without an optimizer dependency. Integer controls must move by at least one unit to
 * avoid rounding stalls near the target; fractional carbon controls retain 0.001 precision. */
export function stepAutopilot(current: ControlState, target: ControlState = NET_ZERO_TARGETS): { controls: ControlState; done: boolean } {
  const moveInteger = (from: number, to: number): number => {
    const distance = Math.round(to) - Math.round(from);
    if (Math.abs(distance) <= 1) return Math.round(to);
    return Math.round(from) + Math.sign(distance) * Math.min(Math.abs(distance), Math.max(1, Math.round(Math.abs(distance) * 0.16)));
  };
  const moveDecimal = (from: number, to: number): number => {
    const distance = to - from;
    if (Math.abs(distance) <= 0.001) return Number(to.toFixed(3));
    const next = from + Math.sign(distance) * Math.min(Math.abs(distance), Math.max(0.002, Math.abs(distance) * 0.16));
    return Number(clamp(next, 0, 1).toFixed(3));
  };
  const next: ControlState = {
    sla_ms: moveInteger(current.sla_ms, target.sla_ms),
    carbon_tax: moveDecimal(current.carbon_tax, target.carbon_tax),
    budget_cr: Number((current.budget_cr + (target.budget_cr - current.budget_cr) * 0.28).toFixed(6)),
    dpdp_locked: current.dpdp_locked,
  };
  if (Math.abs(target.budget_cr - next.budget_cr) < 0.01) next.budget_cr = target.budget_cr;
  const done = next.sla_ms === target.sla_ms && next.carbon_tax === target.carbon_tax && Math.abs(next.budget_cr - target.budget_cr) < 0.01;
  if (done) next.budget_cr = target.budget_cr;
  return { controls: next, done };
}

export function autopilotProgress(current: ControlState, start: ControlState | null, target: ControlState = NET_ZERO_TARGETS): number {
  if (!start) return 0;
  const ratios = (['sla_ms', 'carbon_tax', 'budget_cr'] as const).map(key => {
    const total = Math.abs(start[key] - target[key]);
    return total < 1e-9 ? 1 : Math.min(1, Math.max(0, 1 - Math.abs(current[key] - target[key]) / total));
  });
  return Math.round((ratios.reduce((sum, value) => sum + value, 0) / ratios.length) * 100);
}

/** Live, condition-aware *simulation* policy; no external portfolio transactions.
 * Recommendations are calculated from actual incoming telemetry (which can be modeled).
 * Treasury capital changes are bounded around the operator's capital at Start.
 * Keeps residency preference untouched. Never calls the solver or uses GLPK outputs.
 */
export interface AdaptiveAutopilotRecommendation {
  target: ControlState;
  reason: string;
  conditions: { carbon: number; energyPrice: number; renewables: number; regionalLatency: number; unavailable: number };
}
const bounded = (x: number, lower: number, upper: number) => Math.min(upper, Math.max(lower, x));

export function recommendAdaptiveAutopilot(
  current: ControlState,
  starting: ControlState,
  feed: readonly GridNodeTelemetry[],
): AdaptiveAutopilotRecommendation {
  const healthy = feed.filter(r => r.available !== false && [r.carbon_ci, r.energy_price, r.latency_ms].every(Number.isFinite));
  if (!healthy.length) {
    return { target: { ...current }, reason: 'No usable regional telemetry; holding safe settings',
      conditions: { carbon: 0, energyPrice: 0, renewables: 0, regionalLatency: 0, unavailable: feed.length } };
  }
  const mean = (get: (n: GridNodeTelemetry) => number) => healthy.reduce((sum,n)=>sum+get(n),0)/healthy.length;
  const carbon = mean(n=>n.carbon_ci);
  const energyPrice = mean(n=>n.energy_price);
  const renewables = mean(n=>Number.isFinite(n.renewable_pct) ? n.renewable_pct! : 40);
  const orderedLatency=healthy.map(n=>n.latency_ms).sort((x,y)=>x-y);
  const regionalLatency=orderedLatency[Math.floor((orderedLatency.length-1)*0.7)];
  const unavailable = Math.max(0,feed.length-healthy.length);
  const offline = feed.length ? unavailable/feed.length : 0;
  const carbonStress=bounded((carbon-330)/350,-1,1);
  const priceStress=bounded((energyPrice-83)/50,-1,1);
  const renewableStrength=bounded((renewables-45)/45,-1,1);
  // Carbon penalty rises with dirty grids, while expensive electricity limits
  // the strength of the carbon preference. It is NOT a financial transaction.
  const carbonTarget=Number(bounded(.55+.30*carbonStress-.12*priceStress-.09*renewableStrength+.16*offline,.08,.95).toFixed(2));
  const slaTarget=Math.round(bounded(regionalLatency+7+offline*18,SLA_MIN_MS,SLA_MAX_MS));
  // Bounded policy adjustment to *modeled* enterprise treasury capital; keep
  // the user's originally selected capital as the reference, not the last tick.
  const capitalFactor=bounded(1-.12*priceStress-.10*offline+.06*renewableStrength,.82,1.12);
  const budgetTarget=Number(bounded(starting.budget_cr*capitalFactor,BUDGET_MIN_CR,BUDGET_MAX_CR).toFixed(4));
  const reason = `${carbon > 450 ? 'Carbon elevated' : 'Carbon moderate'} · ${energyPrice > 95 ? 'higher energy prices' : 'energy prices stable'} · ${unavailable ? `${unavailable} regions unavailable` : 'regions available'}`;
  return {
    target: {sla_ms:slaTarget,carbon_tax:carbonTarget,budget_cr:budgetTarget,dpdp_locked:current.dpdp_locked},
    reason,
    conditions:{carbon,energyPrice,renewables,regionalLatency,unavailable},
  };
}

/** Small bounded moves prevent the engine from restarting on every feed event.
 * Once stable, changes stop; monitor stays on and reacts to NEW conditions.
 */
export function stepAdaptiveAutopilot(current: ControlState, recommendation: AdaptiveAutopilotRecommendation): ControlState {
  const target=recommendation.target;
  const step=(from:number,to:number,max:number,deadband:number)=> Math.abs(to-from)<=deadband?from:from+Math.sign(to-from)*Math.min(Math.abs(to-from),max);
  const sla=step(current.sla_ms,target.sla_ms,5,1);
  const tax=step(current.carbon_tax,target.carbon_tax,.07,.015);
  const budget=step(current.budget_cr,target.budget_cr,millionToCr(2),millionToCr(.5));
  return {
    sla_ms:Math.round(bounded(sla,SLA_MIN_MS,SLA_MAX_MS)),
    carbon_tax:Number(bounded(tax,0,1).toFixed(3)),
    budget_cr:Number(bounded(budget,BUDGET_MIN_CR,BUDGET_MAX_CR).toFixed(4)),
    dpdp_locked:current.dpdp_locked,
  };
}
