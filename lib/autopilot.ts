import type { ControlState } from './types.ts';
import { clamp } from './controllerMath.ts';

export interface AutopilotState { active: boolean; progress: number; target: ControlState; label: string; }
export const NET_ZERO_TARGETS: ControlState = { sla_ms: 30, carbon_tax: 0.88, budget_cr: 72, dpdp_locked: false };

export function stepAutopilot(current: ControlState, target: ControlState = NET_ZERO_TARGETS, step = 0.08): { controls: ControlState; done: boolean } {
  const move = (from: number, to: number): number => {
    const delta = to - from;
    return Math.abs(delta) <= step ? to : from + Math.sign(delta) * Math.max(step, Math.abs(delta) * 0.12);
  };
  const next = {
    sla_ms: Math.round(move(current.sla_ms, target.sla_ms)),
    carbon_tax: Number(clamp(move(current.carbon_tax, target.carbon_tax), 0, 1).toFixed(3)),
    budget_cr: Math.round(move(current.budget_cr, target.budget_cr)),
    dpdp_locked: current.dpdp_locked,
  };
  const done = next.sla_ms === target.sla_ms && next.carbon_tax === target.carbon_tax && next.budget_cr === target.budget_cr;
  return { controls: next, done };
}
