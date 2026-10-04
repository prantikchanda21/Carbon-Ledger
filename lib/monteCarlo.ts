export interface MonteCarloPoint { coverage: number; mean: number; low: number; high: number; }
function mulberry32(seed: number): () => number {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export interface MonteCarloParams { baseApy?: number; carbonTax?: number; blendedCi?: number; }
export function simulateCarbonFutures(seed = 42, runs = 120, params: MonteCarloParams = {}): MonteCarloPoint[] {
  const base = params.baseApy ?? 6.8;
  const slope = 1.2 + (params.carbonTax ?? 0.5) * 1.8;
  const vol = 0.25 + Math.min(0.6, Math.max(0, ((params.blendedCi ?? 400) - 200) / 800));
  const rnd = mulberry32(seed);
  return Array.from({ length: 21 }, (_, i) => {
    const coverage = i / 20;
    const samples = Array.from({ length: runs }, () => base + coverage * slope + (rnd() - 0.5) * (vol + coverage * 0.4));
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    const sorted = [...samples].sort((a, b) => a - b);
    return { coverage, mean, low: sorted[Math.floor(runs * 0.1)], high: sorted[Math.floor(runs * 0.9)] };
  });
}
