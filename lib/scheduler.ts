import type { ControlState, GridNodeTelemetry, RegionId, ScheduleResult, Workload } from './types.ts';
import { carbonAt, priceAt } from './mockData.ts';
import { REGION_ORDER, REGIONS } from './regions.ts';

function eligibleRegionIds(telemetry: GridNodeTelemetry[], workload: Workload, controls: ControlState): RegionId[] {
  return REGION_ORDER.filter((id) => {
    const node = telemetry.find((t) => REGIONS[id].code === t.region);
    if (!node || node.available === false) return false;
    if (node.latency_ms > Math.min(controls.sla_ms, workload.latency_need_ms)) return false;
    if (workload.dpdp_locked && !['ap-south-1', 'ap-south-2', 'asia-south2'].includes(node.region)) return false;
    return true;
  });
}

export function scheduleWorkloads(workloads: Workload[], telemetry: GridNodeTelemetry[], controls: ControlState, start = new Date()): ScheduleResult {
  const assignments = [];
  let totalKwh = 0;
  let carbonTonnes = 0;
  let costUsd = 0;
  for (const workload of workloads) {
    const regions = eligibleRegionIds(telemetry, workload, controls);
    if (!regions.length) continue;
    const currentHour = start.getUTCHours();
    const hoursUntilDeadline = (workload.deadline_hour - currentHour + 24) % 24;
    const hours = workload.deferrable
      ? Array.from({ length: hoursUntilDeadline + 1 }, (_, i) => (currentHour + i) % 24)
      : [currentHour];
    let best: { region: RegionId; hour: number; score: number; ci: number; price: number } | null = null;
    for (const hour of hours) {
      for (const region of regions) {
        const ci = carbonAt(region, hour);
        const price = priceAt(region, hour);
        const score = ci * (0.5 + controls.carbon_tax) + price * (1 - controls.carbon_tax * 0.35);
        if (!best || score < best.score) best = { region, hour, score, ci, price };
      }
    }
    if (!best) continue;
    assignments.push({
      workload_id: workload.id, region: best.region, hour_utc: best.hour,
      carbon_ci: Number(best.ci.toFixed(1)), energy_price: Number(best.price.toFixed(1)),
      reason: workload.deferrable ? 'shifted to cleanest compliant hour' : 'immediate SLA-preserving placement',
    });
    totalKwh += workload.kwh;
    carbonTonnes += (best.ci * workload.kwh) / 1_000_000;
    costUsd += best.price * workload.kwh / 1000;
  }
  return {
    assignments,
    total_kwh: Number(totalKwh.toFixed(2)),
    carbon_tonnes: Number(carbonTonnes.toFixed(4)),
    cost_usd: Number(costUsd.toFixed(2)),
    deferred_jobs: assignments.filter((a) => workloads.find((w) => w.id === a.workload_id)?.deferrable).length,
    generated_at: new Date().toISOString(),
  };
}
