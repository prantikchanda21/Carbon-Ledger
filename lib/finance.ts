import type { TreasuryAllocation } from './types.ts';
import {
  BUDGET_MAX_CR,
  BUDGET_MIN_CR,
  CARBON_FUTURES_SPREAD,
  CARBON_TAX_USD_PER_KG_AT_MAX,
  FLEET_MWH_PER_DAY,
  GREEN_BOND_SPREAD,
  INR_PER_CRORE,
  OFFSET_PRICE_INR_PER_TONNE,
  USD_INR,
} from './constants.ts';
import { clamp } from './controllerMath.ts';

const round = (value: number, digits: number): number => {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
};

/**
 * Splits the treasury budget. The model supplies the hedge fraction; a larger budget can
 * commit more capital to term instruments, and a higher carbon tax tilts hedging toward
 * carbon futures.
 */
export function allocateTreasury(
  hedgeFraction: number,
  budgetCr: number,
  carbonTax: number,
  treasuryYield: number,
): TreasuryAllocation {
  const budgetNorm = clamp((budgetCr - BUDGET_MIN_CR) / (BUDGET_MAX_CR - BUDGET_MIN_CR), 0, 1);
  const hedgeTotal = clamp(hedgeFraction * 100 * (0.85 + 0.3 * budgetNorm), 5, 85);
  const futuresShare = clamp(0.25 + 0.45 * carbonTax - 0.1 * budgetNorm, 0.15, 0.7);
  const futures = hedgeTotal * futuresShare;
  const green = hedgeTotal - futures;
  const liquid = 100 - hedgeTotal;
  const apy =
    (liquid * treasuryYield +
      green * (treasuryYield + GREEN_BOND_SPREAD) +
      futures * (treasuryYield + CARBON_FUTURES_SPREAD)) /
    100;
  return {
    liquid_funds_pct: round(liquid, 2),
    green_bonds_pct: round(green, 2),
    carbon_futures_pct: round(futures, 2),
    projected_apy: round(apy, 3),
  };
}

export interface CarbonAccounting {
  gross_tco2_per_day: number;
  net_footprint_mt: number;
  carbon_avoided_t: number;
  offset_pct: number;
  offset_roi_pct: number;
}

/**
 * Daily carbon accounting. Offsets are bought with the carbon-futures slice of the budget
 * and applied up to the gross footprint. Avoided carbon is the routing saving versus the
 * baseline mix plus the offsets applied.
 */
export function carbonAccounting(args: {
  blendedCi: number;
  baselineCi: number;
  carbonFuturesPct: number;
  budgetCr: number;
  carbonTax: number;
}): CarbonAccounting {
  const gross = (args.blendedCi * FLEET_MWH_PER_DAY) / 1000;
  const baselineGross = (args.baselineCi * FLEET_MWH_PER_DAY) / 1000;
  const routingAvoided = Math.max(0, baselineGross - gross);

  const futuresInr = args.budgetCr * INR_PER_CRORE * (args.carbonFuturesPct / 100);
  const offsetCapacity = futuresInr / OFFSET_PRICE_INR_PER_TONNE / 365;
  const applied = Math.min(gross, offsetCapacity);
  const net = Math.max(0, gross - applied);
  const avoided = routingAvoided + applied;

  const taxInrPerTonne = args.carbonTax * CARBON_TAX_USD_PER_KG_AT_MAX * 1000 * USD_INR;
  const offsetSpend = applied * OFFSET_PRICE_INR_PER_TONNE;
  const roi = offsetSpend > 0 ? ((avoided * taxInrPerTonne - offsetSpend) / offsetSpend) * 100 : 0;

  return {
    gross_tco2_per_day: gross,
    net_footprint_mt: net,
    carbon_avoided_t: avoided,
    offset_pct: gross > 0 ? (applied / gross) * 100 : 100,
    offset_roi_pct: roi,
  };
}

/** Projected 12-month interest on the budget, in INR. */
export function annualInterestInr(budgetCr: number, apyPct: number): number {
  return Math.round(budgetCr * INR_PER_CRORE * (apyPct / 100));
}
