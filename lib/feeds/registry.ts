import type { FeedSample, GridNodeTelemetry, RegionId } from '@/lib/types';
import { generateTelemetry } from '@/lib/mockData';
import { REGION_ORDER, REGIONS } from '@/lib/regions';

const cache = new Map<string, { expiresAt: number; telemetry: GridNodeTelemetry }>();
const EVICTION_MS = 300_000;
const API_VERSION = process.env.ELECTRICITY_MAPS_API_VERSION ?? 'v4';
const ZONES: Record<RegionId, string> = Object.fromEntries(REGION_ORDER.map((id) => [id, REGIONS[id].grid_zone])) as Record<RegionId, string>;

async function electricityMaps(id: RegionId, base: GridNodeTelemetry): Promise<GridNodeTelemetry> {
  const key = process.env.ELECTRICITY_MAPS_API_KEY;
  if (!key) throw new Error('ELECTRICITY_MAPS_API_KEY is not configured');
  const zone = ZONES[id];
  const cached = cache.get(id);
  if (cached && cached.expiresAt > Date.now()) return { ...cached.telemetry };
  const requestInit = { headers: { 'auth-token': key }, next: { revalidate: 300 } } as RequestInit;
  const response = await fetch(`https://api.electricitymaps.com/${API_VERSION}/carbon-intensity/latest?zone=${encodeURIComponent(zone)}`, requestInit);
  if (!response.ok) throw new Error(`Electricity Maps HTTP ${response.status}`);
  const data = await response.json() as { carbonIntensity?: number };
  if (typeof data.carbonIntensity !== 'number') throw new Error('Electricity Maps returned no carbon intensity');
  const telemetry = { ...base, carbon_ci: data.carbonIntensity, source: 'electricity-maps' as const, timestamp: Date.now() };
  cache.set(id, { expiresAt: Date.now() + EVICTION_MS, telemetry });
  return telemetry;
}

export async function getRegionalFeed(now = new Date()): Promise<FeedSample> {
  const mock = generateTelemetry(now, false, true);
  if (!process.env.ELECTRICITY_MAPS_API_KEY) return { telemetry: mock, source: 'fallback', fetchedAt: Date.now() };
  const results = await Promise.allSettled(mock.map((node, i) => electricityMaps(REGION_ORDER[i], node)));
  const telemetry = results.map((result, i) => result.status === 'fulfilled' ? result.value : { ...mock[i], source: 'mock' as const });
  const live = results.filter((r) => r.status === 'fulfilled').length;
  return { telemetry, source: live === telemetry.length ? 'electricity-maps' : live > 0 ? 'mixed' : 'fallback', fetchedAt: Date.now() };
}
