import type { ControllerEvent, GridNodeTelemetry } from './types.ts';

export const EVENT_PRESETS: Array<Pick<ControllerEvent, 'type' | 'label' | 'durationHours' | 'intensity'>> = [
  { type: 'heatwave_mumbai', label: 'Mumbai heatwave', durationHours: 8, intensity: 1 },
  { type: 'wind_surge_frankfurt', label: 'Frankfurt wind surge', durationHours: 6, intensity: 1 },
  { type: 'virginia_outage', label: 'Virginia outage', durationHours: 4, intensity: 1 },
  { type: 'carbon_tax_double', label: 'Carbon tax ×2', durationHours: 12, intensity: 1 },
];

export function injectEvent(event: ControllerEvent, telemetry: GridNodeTelemetry[], now = Date.now(), baseCarbonTax = 0.5): GridNodeTelemetry[] {
  const ageHours = Math.max(0, (now - event.startedAt) / 3_600_000);
  const decay = Math.max(0, 1 - ageHours / event.durationHours);
  if (decay <= 0) return telemetry;
  return telemetry.map((node) => {
    const next = { ...node };
    if (event.type === 'heatwave_mumbai' && node.region === 'ap-south-1') next.carbon_ci += 260 * decay * event.intensity;
    if (event.type === 'wind_surge_frankfurt' && node.region === 'eu-central-1') next.carbon_ci = Math.max(20, node.carbon_ci - 180 * decay * event.intensity);
    if (event.type === 'virginia_outage' && node.region === 'us-east-1') { next.available = decay < 0.18; next.latency_ms += 120 * decay; }
    if (event.type === 'carbon_tax_double') next.energy_price += 0.12 * baseCarbonTax * 100 * decay;
    return next;
  });
}
export function activeEvents(events: ControllerEvent[], now = Date.now()): ControllerEvent[] {
  return events.filter((e) => now - e.startedAt < e.durationHours * 3_600_000);
}
