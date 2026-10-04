import type { ForecastRegion, RegionId } from './types.ts';
import { carbonAt, priceAt } from './mockData.ts';
import { REGION_ORDER } from './regions.ts';

export function forecast24h(baseDate: Date = new Date(), regionIds: readonly RegionId[] = REGION_ORDER): ForecastRegion[] {
  const start = new Date(baseDate);
  start.setUTCMinutes(0, 0, 0);
  return regionIds.map((region) => ({
    region,
    points: Array.from({ length: 24 }, (_, index) => {
      const hourDate = new Date(start.getTime() + index * 3_600_000);
      const h = hourDate.getUTCHours() + hourDate.getUTCMinutes() / 60;
      const mean = carbonAt(region, h);
      const confidence = 18 + Math.abs(Math.sin(h * 0.7 + index)) * 24;
      return {
        hourUtc: hourDate.getUTCHours(),
        label: `${String(hourDate.getUTCHours()).padStart(2, '0')}:00`,
        mean: Math.round(mean * 10) / 10,
        low: Math.max(0, Math.round((mean - confidence) * 10) / 10),
        high: Math.round((mean + confidence) * 10) / 10,
        price: Math.round(priceAt(region, h) * 10) / 10,
      };
    }),
  }));
}
