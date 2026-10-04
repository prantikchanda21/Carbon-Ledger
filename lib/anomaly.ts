import type { AnomalyReport, GridNodeTelemetry } from './types.ts';

export function ewma(values: number[], alpha = 0.3): number {
  if (!values.length) return 0;
  return values.slice(1).reduce((acc, value) => alpha * value + (1 - alpha) * acc, values[0]);
}
export function zScore(value: number, values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return variance === 0 ? 0 : (value - mean) / Math.sqrt(variance);
}
export function detectAnomaly(value: number, history: number[], timestamp?: number, now = Date.now()): AnomalyReport {
  const ewmaValue = ewma([...history, value]);
  const z = zScore(value, history);
  const stale = timestamp !== undefined && now - timestamp > 300_000;
  const spike = Math.abs(z) >= 2.5 || (ewmaValue !== 0 && Math.abs(value - ewmaValue) / Math.abs(ewmaValue) > 0.3);
  return { ewma: ewmaValue, zScore: z, spike, stale, quality: stale ? 'stale' : spike ? 'watch' : 'good' };
}
export function assessFeedQuality(node: GridNodeTelemetry, history: number[] = []): AnomalyReport {
  const base = detectAnomaly(node.carbon_ci, history, node.source === 'electricity-maps' ? node.timestamp : undefined);
  if (node.available === false) return { ...base, stale: true, quality: 'stale' };
  return base;
}
