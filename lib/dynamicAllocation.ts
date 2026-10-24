import type {ControlState, NodeReport} from './types';
import { BUDGET_MIN_CR, BUDGET_MAX_CR } from './constants.ts';
/** Dimensionless, scenario-responsive regional priority (lower is preferred).
 * Price and carbon are normalised across eligible regions, while SLA remains
 * a hard eligibility rule. Budget changes price pressure; it is NOT a hard
 * budget cap because total workload kWh and consistent cost units are absent.
 */
export function dynamicAllocationScores(nodes:NodeReport[],controls:ControlState):number[]{
 const eligible=nodes.filter(n=>n.eligible);
 const normalize=(value:number,min:number,max:number)=>max>min?(value-min)/(max-min):0;
 const minPrice=Math.min(...eligible.map(n=>n.energy_price));
 const maxPrice=Math.max(...eligible.map(n=>n.energy_price));
 const minCarbon=Math.min(...eligible.map(n=>n.carbon_ci));
 const maxCarbon=Math.max(...eligible.map(n=>n.carbon_ci));
 const tax=Math.max(0,Math.min(1,controls.carbon_tax));
 // Budget is an annual treasury-capital scenario ($5M-$100M). Smaller budgets
 // emphasize operating cost; larger budgets allow more carbon-focused trade-offs.
 // This is a *soft objective weight*, NOT a claim of a hard cloud spending cap.
 const budgetFraction=Math.max(0,Math.min(1,(controls.budget_cr-BUDGET_MIN_CR)/(BUDGET_MAX_CR-BUDGET_MIN_CR)));
 const budgetPressure=2.6-2.05*budgetFraction;
 const total=budgetPressure+tax*2+.25;
 return nodes.map(n=>!n.eligible?1e9:(budgetPressure*normalize(n.energy_price,minPrice,maxPrice)+2*tax*normalize(n.carbon_ci,minCarbon,maxCarbon)+.25*Math.min(1,n.latency_ms/Math.max(1,controls.sla_ms)))/total);
}
