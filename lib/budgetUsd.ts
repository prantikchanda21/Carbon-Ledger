/** Enterprise USD treasury capital. Core model retains legacy `budget_cr` in crores for ONNX compatibility.
 * FX = fixed scenario parameter from constants.ts, NOT a live exchange rate. */
import { INR_PER_CRORE, USD_INR } from './constants.ts';
export const MIN_BUDGET_USD = 5_000_000;
export const MAX_BUDGET_USD = 100_000_000;
export const DEFAULT_BUDGET_USD = 30_000_000;
export const crToUsd = (crores:number):number => crores * INR_PER_CRORE / USD_INR;
export const usdToCr = (usd:number):number => usd * USD_INR / INR_PER_CRORE;
export const dollars = (usd:number) => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(usd);
export const budgetLabel = (crores:number) => `$${(crToUsd(crores)/1_000_000).toFixed(1).replace(/\.0$/,'')}M`;
export const budgetMillion = (crores:number) => crToUsd(crores)/1_000_000;
export const millionToCr = (million:number) => usdToCr(million*1_000_000);
