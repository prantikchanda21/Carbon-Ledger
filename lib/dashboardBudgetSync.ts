/** Shares the actual dashboard treasury capital across client workspaces. */
import {budgetMillion, millionToCr, DEFAULT_BUDGET_USD} from './budgetUsd.ts';

export const DASHBOARD_CONTROLS_STORAGE_KEY = 'carbon-controller-controls-v151-usd';
export const DEFAULT_BUDGET_MILLION = DEFAULT_BUDGET_USD / 1_000_000;
export const clampBudgetMillion = (value:number):number => Math.min(100, Math.max(5, Number.isFinite(value) ? value : DEFAULT_BUDGET_MILLION));

type Store = Pick<Storage,'getItem'|'setItem'>;
export function parseDashboardBudget(raw:string|null):number|null {
  if(!raw)return null;
  try {
    const record:unknown=JSON.parse(raw);
    if(!record||typeof record!=='object'||!('budget_cr' in record))return null;
    const crore=(record as {budget_cr:unknown}).budget_cr;
    if(typeof crore!=='number'||!Number.isFinite(crore)||crore<0)return null;
    return clampBudgetMillion(budgetMillion(crore));
  }catch{return null;}
}
export function readDashboardBudget(storage?:Store):number {
  try { const target=storage??(typeof window==='undefined'?undefined:window.localStorage);
    return parseDashboardBudget(target?.getItem(DASHBOARD_CONTROLS_STORAGE_KEY)??null)??DEFAULT_BUDGET_MILLION;
  }catch{return DEFAULT_BUDGET_MILLION;}
}
export function writeDashboardBudget(millions:number,storage?:Store):number {
  const safe=clampBudgetMillion(millions);
  const target=storage??(typeof window==='undefined'?undefined:window.localStorage);
  if(!target)return safe;
  try {
    const raw=target.getItem(DASHBOARD_CONTROLS_STORAGE_KEY);
    let previous:Record<string,unknown>={};
    if(raw){const parsed:unknown=JSON.parse(raw);if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))previous=parsed as Record<string,unknown>;}
    const controls={sla_ms:25,carbon_tax:0.5,dpdp_locked:false,...previous,budget_cr:millionToCr(safe)};
    target.setItem(DASHBOARD_CONTROLS_STORAGE_KEY,JSON.stringify(controls));
  }catch{/* Workspace remains usable even when local storage is blocked. */}
  return safe;
}
