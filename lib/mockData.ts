import type { GridNodeTelemetry, RegionId } from './types.ts';
import { CORE_REGION_ORDER, REGION_ORDER, REGIONS } from './regions.ts';

interface Profile {
  ciBase: number; ciAmp: number; ciPeakUtc: number;
  priceBase: number; priceAmp: number; pricePeakUtc: number;
  latBase: number; latJitter: number; egress: number; phase: number;
}

const P = (ciBase: number, ciAmp: number, ciPeakUtc: number, priceBase: number, priceAmp: number, pricePeakUtc: number, latBase: number, latJitter: number, egress: number, phase: number): Profile => ({ ciBase, ciAmp, ciPeakUtc, priceBase, priceAmp, pricePeakUtc, latBase, latJitter, egress, phase });

export const PROFILES: Record<RegionId, Profile> = {
  mumbai: P(640, 70, 15, 72, 12, 14, 11, 2, 0.020, 0.7),
  hyderabad: P(560, 60, 16, 66, 10, 15, 9, 2, 0.020, 0.4),
  delhi: P(610, 65, 16, 68, 10, 15, 13, 3, 0.025, 0.9),
  singapore: P(455, 35, 16, 88, 11, 15, 20, 3, 0.065, 1.2),
  tokyo: P(420, 42, 17, 96, 18, 18, 49, 6, 0.085, 1.7),
  seoul: P(430, 48, 17, 94, 16, 18, 51, 6, 0.082, 1.8),
  sydney: P(320, 55, 6, 84, 17, 6, 32, 5, 0.075, 2.5),
  frankfurt: P(350, 80, 17, 112, 22, 17, 24, 4, 0.086, 2.1),
  dublin: P(245, 55, 17, 106, 24, 16, 27, 4, 0.070, 2.9),
  london: P(265, 50, 17, 108, 23, 17, 26, 4, 0.078, 3.1),
  stockholm: P(115, 35, 14, 102, 19, 16, 29, 4, 0.081, 3.6),
  paris: P(95, 20, 14, 104, 20, 16, 25, 4, 0.082, 3.3),
  madrid: P(170, 65, 14, 103, 21, 15, 31, 5, 0.084, 3.8),
  zurich: P(90, 18, 14, 118, 24, 16, 28, 4, 0.090, 3.9),
  virginia: P(390, 40, 22, 68, 14, 21, 41, 6, 0.090, 4.3),
  oregon: P(130, 34, 20, 72, 12, 20, 58, 7, 0.090, 4.9),
  iowa: P(280, 55, 21, 64, 11, 20, 53, 6, 0.088, 4.6),
  toronto: P(55, 22, 18, 81, 14, 18, 44, 5, 0.088, 5.1),
  sao_paulo: P(125, 60, 17, 76, 16, 16, 120, 9, 0.100, 5.4),
  johannesburg: P(720, 85, 18, 70, 13, 17, 140, 11, 0.105, 5.8),
};

const cycle = (hourUtc: number, peakUtc: number): number => Math.cos((2 * Math.PI * (hourUtc - peakUtc)) / 24);
export function hourOfDayUtc(date: Date): number { return date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600; }
export function carbonAt(id: RegionId, hourUtc: number): number { const p = PROFILES[id]; return p.ciBase + p.ciAmp * cycle(hourUtc, p.ciPeakUtc) + 8 * Math.sin(hourUtc * 3.1 + p.phase); }
export function priceAt(id: RegionId, hourUtc: number): number { const p = PROFILES[id]; return p.priceBase + p.priceAmp * cycle(hourUtc, p.pricePeakUtc) + 2 * Math.sin(hourUtc * 2.3 + p.phase); }
export function latencyAt(id: RegionId, hourUtc: number): number { const p = PROFILES[id]; return Math.max(1, p.latBase + p.latJitter * Math.sin(hourUtc * 5 + p.phase)); }
export function renewableAt(id: RegionId, hourUtc: number): number { return Math.max(0, Math.min(100, REGIONS[id].renewable_baseline_pct + 18 * Math.sin((hourUtc - 12) / 24 * 2 * Math.PI))); }

export interface SimulatedFeedHealth {
  quality: 'good' | 'watch' | 'stale';
  score: number;
}

export function simulatedFeedHealthAt(id: RegionId, hourUtc: number): SimulatedFeedHealth {
  const p = PROFILES[id];
  const signal = Math.sin(hourUtc * 0.62 + p.phase * 1.9) + 0.35 * Math.sin(hourUtc * 1.47 + p.phase);
  const score = Math.max(0, Math.min(100, Math.round(72 + signal * 24)));
  if (score < 28) return { quality: 'stale', score };
  if (score < 55) return { quality: 'watch', score };
  return { quality: 'good', score };
}
const round1 = (v: number): number => Math.round(v * 10) / 10;

export function generateTelemetry(now: Date = new Date(), dpdpLocked = false, extended = false): GridNodeTelemetry[] {
  const order = extended ? REGION_ORDER : CORE_REGION_ORDER;
  const hour = hourOfDayUtc(now);
  return order.map((id) => ({
    region: REGIONS[id].code,
    carbon_ci: round1(carbonAt(id, hour)),
    energy_price: round1(priceAt(id, hour)),
    latency_ms: round1(latencyAt(id, hour)),
    dpdp_locked: dpdpLocked,
    egress_cost_gb: PROFILES[id].egress,
    renewable_pct: round1(renewableAt(id, hour)),
    available: true,
    source: 'mock',
    timestamp: now.getTime(),
  }));
}

export interface SeriesPoint {
  label: string;
  mumbai: number;
  frankfurt: number;
  virginia: number;
  blended: number;
  apy: number;
  low?: number;
  high?: number;
}
export function generate24hSeries(weights: Partial<Record<RegionId, number>>, apyNow: number, now: Date = new Date()): SeriesPoint[] {
  const points: SeriesPoint[] = [];
  const end = new Date(now); end.setUTCMinutes(0, 0, 0);
  for (let back = 23; back >= 0; back -= 1) {
    const t = new Date(end.getTime() - back * 3_600_000);
    const hour = hourOfDayUtc(t);
    const ci: Record<RegionId, number> = Object.fromEntries(REGION_ORDER.map((id) => [id, carbonAt(id, hour)])) as Record<RegionId, number>;
    const blended = REGION_ORDER.reduce((s, id) => s + ci[id] * (weights[id] ?? 0), 0);
    points.push({
      label: `${String(t.getUTCHours()).padStart(2, '0')}:00`,
      mumbai: Math.round(ci.mumbai), frankfurt: Math.round(ci.frankfurt), virginia: Math.round(ci.virginia),
      blended: Math.round(blended), apy: Math.round((apyNow + 0.18 * Math.sin(hour / 3.2) + 0.06 * Math.cos(hour * 1.3)) * 1000) / 1000,
    });
  }
  return points;
}
