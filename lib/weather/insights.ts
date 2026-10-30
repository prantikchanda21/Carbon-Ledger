import type { GridNodeTelemetry } from '@/lib/types';
export type WeatherHour = { time: string; temperatureC: number | null; windKmh: number | null; solarWm2: number | null; cloudPct: number | null };
export type WeatherRegion = { id: string; city: string; code: string; current: { time: string | null; temperatureC: number | null; windKmh: number | null; cloudPct: number | null }; hours: WeatherHour[] };
export type WeatherResponse = { source: string; retrievedAt: string; forecastHours: number; regions: WeatherRegion[] };
export type WeatherInsight = { id: string; city: string; temperatureC: number | null; coolingMultiplier: number | null; solarAverage: number | null; windAverage: number | null; basePrice: number | null; modeledPrice: number | null; carbonIntensity: number | null; weatherCostIndex: number | null };
export function modelWeatherImpacts(weather: WeatherRegion[], telemetry: GridNodeTelemetry[]): WeatherInsight[] {
  return weather.map(region => {
    const values = region.hours.filter(h=>h.temperatureC !== null);
    const avg = (numbers: (number|null)[]) => {const valid = numbers.filter((n):n is number=>n!==null && Number.isFinite(n)); return valid.length ? valid.reduce((a,b)=>a+b,0)/valid.length : null;};
    const temperature = avg(values.map(v=>v.temperatureC));
    // Explicit heuristic, not a calibrated data-center PUE/cooling model. Maximum ±12% of baseline electricity costs.
    const adjustment = temperature === null ? null : Math.max(0.88, Math.min(1.12, 1 + (temperature-20)*0.006));
    const node = telemetry.find(t=>t.region===region.code);
    const price = node?.energy_price ?? null;
    const modeled = adjustment !== null && price !== null ? price*adjustment : null;
    return {id:region.id, city:region.city, temperatureC:temperature, coolingMultiplier:adjustment, solarAverage:avg(region.hours.map(v=>v.solarWm2)),windAverage:avg(region.hours.map(v=>v.windKmh)),basePrice:price,modeledPrice:modeled,carbonIntensity:node?.carbon_ci??null,weatherCostIndex:modeled!==null&&node? modeled*(1+node.carbon_ci/1000):null};
  });
}
