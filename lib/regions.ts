import type { RegionCatalogEntry, RegionId } from './types.ts';

export const CORE_REGION_ORDER: readonly RegionId[] = ['mumbai', 'frankfurt', 'virginia'];
export const REGION_ORDER: readonly RegionId[] = [
  'mumbai', 'hyderabad', 'delhi', 'singapore', 'tokyo', 'seoul', 'sydney',
  'frankfurt', 'dublin', 'london', 'stockholm', 'paris', 'madrid', 'zurich',
  'virginia', 'oregon', 'iowa', 'toronto', 'sao_paulo', 'johannesburg',
];

export const REGIONS: Record<RegionId, RegionCatalogEntry> = {
  mumbai: { id: 'mumbai', city: 'Mumbai', code: 'ap-south-1', provider: 'AWS', lat: 19.076, lon: 72.8777, macro: 'asia', renewable_baseline_pct: 24, grid_zone: 'IN-MUMBAI' },
  hyderabad: { id: 'hyderabad', city: 'Hyderabad', code: 'ap-south-2', provider: 'AWS', lat: 17.385, lon: 78.4867, macro: 'asia', renewable_baseline_pct: 28, grid_zone: 'IN-TELANGANA' },
  delhi: { id: 'delhi', city: 'Delhi', code: 'asia-south2', provider: 'GCP', lat: 28.6139, lon: 77.209, macro: 'asia', renewable_baseline_pct: 31, grid_zone: 'IN-NCR' },
  singapore: { id: 'singapore', city: 'Singapore', code: 'ap-southeast-1', provider: 'AWS', lat: 1.3521, lon: 103.8198, macro: 'asia', renewable_baseline_pct: 5, grid_zone: 'SG' },
  tokyo: { id: 'tokyo', city: 'Tokyo', code: 'ap-northeast-1', provider: 'AWS', lat: 35.6762, lon: 139.6503, macro: 'asia', renewable_baseline_pct: 28, grid_zone: 'JP-TOKYO' },
  seoul: { id: 'seoul', city: 'Seoul', code: 'ap-northeast-2', provider: 'AWS', lat: 37.5665, lon: 126.978, macro: 'asia', renewable_baseline_pct: 22, grid_zone: 'KR' },
  sydney: { id: 'sydney', city: 'Sydney', code: 'ap-southeast-2', provider: 'AWS', lat: -33.8688, lon: 151.2093, macro: 'asia', renewable_baseline_pct: 39, grid_zone: 'AU-NSW' },
  frankfurt: { id: 'frankfurt', city: 'Frankfurt', code: 'eu-central-1', provider: 'AWS', lat: 50.1109, lon: 8.6821, macro: 'europe', renewable_baseline_pct: 61, grid_zone: 'DE-LU' },
  dublin: { id: 'dublin', city: 'Dublin', code: 'eu-west-1', provider: 'AWS', lat: 53.3498, lon: -6.2603, macro: 'europe', renewable_baseline_pct: 74, grid_zone: 'IE' },
  london: { id: 'london', city: 'London', code: 'eu-west-2', provider: 'AWS', lat: 51.5074, lon: -0.1278, macro: 'europe', renewable_baseline_pct: 58, grid_zone: 'UK' },
  stockholm: { id: 'stockholm', city: 'Stockholm', code: 'eu-north-1', provider: 'AWS', lat: 59.3293, lon: 18.0686, macro: 'europe', renewable_baseline_pct: 91, grid_zone: 'SE' },
  paris: { id: 'paris', city: 'Paris', code: 'eu-west-3', provider: 'AWS', lat: 48.8566, lon: 2.3522, macro: 'europe', renewable_baseline_pct: 68, grid_zone: 'FR' },
  madrid: { id: 'madrid', city: 'Madrid', code: 'eu-south-2', provider: 'AWS', lat: 40.4168, lon: -3.7038, macro: 'europe', renewable_baseline_pct: 63, grid_zone: 'ES' },
  zurich: { id: 'zurich', city: 'Zurich', code: 'europe-west6', provider: 'GCP', lat: 47.3769, lon: 8.5417, macro: 'europe', renewable_baseline_pct: 96, grid_zone: 'CH' },
  virginia: { id: 'virginia', city: 'Virginia', code: 'us-east-1', provider: 'AWS', lat: 38.9072, lon: -77.0369, macro: 'americas', renewable_baseline_pct: 48, grid_zone: 'US-MIDA-PJM' },
  oregon: { id: 'oregon', city: 'Oregon', code: 'us-west-2', provider: 'AWS', lat: 45.5152, lon: -122.6784, macro: 'americas', renewable_baseline_pct: 84, grid_zone: 'US-NW' },
  iowa: { id: 'iowa', city: 'Iowa', code: 'us-central1', provider: 'GCP', lat: 41.878, lon: -93.0977, macro: 'americas', renewable_baseline_pct: 62, grid_zone: 'US-MISO' },
  toronto: { id: 'toronto', city: 'Toronto', code: 'ca-central-1', provider: 'AWS', lat: 43.6532, lon: -79.3832, macro: 'americas', renewable_baseline_pct: 88, grid_zone: 'CA-ON' },
  sao_paulo: { id: 'sao_paulo', city: 'São Paulo', code: 'sa-east-1', provider: 'AWS', lat: -23.5505, lon: -46.6333, macro: 'americas', renewable_baseline_pct: 79, grid_zone: 'BR-SE' },
  johannesburg: { id: 'johannesburg', city: 'Johannesburg', code: 'af-south-1', provider: 'AWS', lat: -26.2041, lon: 28.0473, macro: 'americas', renewable_baseline_pct: 18, grid_zone: 'ZA-GP' },
};

export const INDIAN_REGION_CODES: readonly string[] = ['ap-south-1', 'ap-south-2', 'asia-south2'];
const CODE_TO_ID: Record<string, RegionId> = Object.fromEntries(
  REGION_ORDER.flatMap((id) => [[REGIONS[id].code, id]]),
) as Record<string, RegionId>;

export function isIndianRegion(code: string): boolean {
  return INDIAN_REGION_CODES.includes(code);
}
export function resolveRegionId(code: string): RegionId | null {
  return CODE_TO_ID[code] ?? null;
}
export function regionById(id: RegionId): RegionCatalogEntry {
  return REGIONS[id];
}
export function macroForRegion(id: RegionId): 'asia' | 'europe' | 'americas' {
  return REGIONS[id].macro;
}
export const MACRO_TO_CORE: Record<'asia' | 'europe' | 'americas', RegionId> = {
  asia: 'mumbai', europe: 'frankfurt', americas: 'virginia',
};
