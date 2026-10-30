import { NextResponse } from 'next/server';
import { REGION_ORDER, REGIONS } from '@/lib/regions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

type Hourly = { time?: string[]; temperature_2m?: (number | null)[]; wind_speed_10m?: (number | null)[]; shortwave_radiation?: (number | null)[]; cloud_cover?: (number | null)[] };
type ProviderEntry = { hourly?: Hourly; current?: { time?: string; temperature_2m?: number; wind_speed_10m?: number; cloud_cover?: number }; latitude?: number; longitude?: number };
const number = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : null;

export async function GET() {
  try {
    const params = new URLSearchParams({
      latitude: REGION_ORDER.map(id => REGIONS[id].lat).join(','),
      longitude: REGION_ORDER.map(id => REGIONS[id].lon).join(','),
      current: 'temperature_2m,wind_speed_10m,cloud_cover',
      hourly: 'temperature_2m,wind_speed_10m,shortwave_radiation,cloud_cover',
      timezone: 'UTC', forecast_days: '3', wind_speed_unit: 'kmh',
    });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 14000);
    let response: Response;
    try { response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { signal: controller.signal, next: { revalidate: 900 } }); }
    finally { clearTimeout(timeout); }
    if (!response.ok) throw new Error(`Open-Meteo returned HTTP ${response.status}`);
    const payload: unknown = await response.json();
    if (!Array.isArray(payload) || payload.length !== REGION_ORDER.length) throw new Error('Open-Meteo returned an unexpected location count');
    const regions = REGION_ORDER.map((id, idx) => {
      const entry = payload[idx] as ProviderEntry;
      const hourly = entry.hourly;
      if (!hourly?.time || !Array.isArray(hourly.temperature_2m) || !Array.isArray(hourly.shortwave_radiation)) throw new Error(`Invalid forecast series for ${id}`);
      const now = Date.now();
      const future = hourly.time.map((t, i) => ({ t, i })).filter(v => Date.parse(`${v.t}Z`) >= now - 3600000).slice(0, 24);
      const selected = future.length ? future : hourly.time.map((t,i)=>({t,i})).slice(0,24);
      return {
        id, city: REGIONS[id].city, code: REGIONS[id].code,
        current: { time: entry.current?.time ?? null, temperatureC: number(entry.current?.temperature_2m), windKmh: number(entry.current?.wind_speed_10m), cloudPct: number(entry.current?.cloud_cover) },
        hours: selected.map(({t,i}) => ({time: t, temperatureC: number(hourly.temperature_2m?.[i]), windKmh: number(hourly.wind_speed_10m?.[i]), solarWm2: number(hourly.shortwave_radiation?.[i]), cloudPct: number(hourly.cloud_cover?.[i])})),
      };
    });
    return NextResponse.json({ source: 'Open-Meteo', kind: 'forecast', retrievedAt: new Date().toISOString(), forecastHours: 24, regions }, { headers: { 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=900' } });
  } catch (err) {
    return NextResponse.json({ source: 'Open-Meteo', status: 'unavailable', error: err instanceof Error ? err.message : 'Weather service unavailable', regions: [] }, {status: 503, headers: {'Cache-Control':'no-store'}});
  }
}
