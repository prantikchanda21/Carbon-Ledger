'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { CalendarClock, RefreshCw } from 'lucide-react';
import type { Workload, ScheduleResult, GridNodeTelemetry, ControlState } from '@/lib/types';
import { REGIONS } from '@/lib/regions';

const DEFAULT_WORKLOADS: Workload[] = [
  { id: 'etl-01', name: 'Nightly ETL', dpdp_locked: false, latency_need_ms: 80, deferrable: true, kwh: 180, deadline_hour: 8 },
  { id: 'risk-02', name: 'Treasury risk batch', dpdp_locked: true, latency_need_ms: 40, deferrable: true, kwh: 95, deadline_hour: 6 },
  { id: 'api-03', name: 'Live inference API', dpdp_locked: false, latency_need_ms: 25, deferrable: false, kwh: 60, deadline_hour: 23 },
  { id: 'brsr-04', name: 'ESG report generation', dpdp_locked: false, latency_need_ms: 100, deferrable: true, kwh: 70, deadline_hour: 18 },
];

export default function WorkloadTable({ telemetry, controls }: { telemetry: GridNodeTelemetry[]; controls: ControlState }) {
  const [workloads] = useState(DEFAULT_WORKLOADS);
  const [schedule, setSchedule] = useState<ScheduleResult | null>(null);
  const [busy, setBusy] = useState(false);
  const byId = useMemo(() => new Map(schedule?.assignments.map((a) => [a.workload_id, a])), [schedule]);

  async function run(): Promise<void> {
    setBusy(true);
    try {
      const response = await fetch('/api/schedule', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workloads, telemetry, controls }) });
      const payload = await response.json() as ScheduleResult | { error?: string };
      if (!response.ok) throw new Error('error' in payload && payload.error ? payload.error : `Scheduler returned HTTP ${response.status}`);
      setSchedule(payload as ScheduleResult);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Scheduler failed');
    } finally { setBusy(false); }
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="mb-3 flex items-center justify-between"><div><h2 className="text-sm font-semibold text-slate-100">Carbon-aware scheduler</h2><p className="text-xs text-slate-500">Deferrable jobs move to cleaner compliant hours.</p></div><button type="button" onClick={() => void run()} disabled={busy} className="grid h-9 w-9 place-items-center rounded-xl bg-white/5 text-slate-300" aria-label="Schedule workloads"><RefreshCw className={busy ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} /></button></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-xs"><thead className="text-slate-500"><tr><th className="pb-2">Job</th><th>DPDP</th><th>Latency</th><th>Deferred</th><th>kWh</th><th>Plan</th></tr></thead><tbody>
        {workloads.map((w) => { const a = byId.get(w.id); return <tr key={w.id} className="border-t border-white/5"><td className="py-2.5 font-medium text-slate-200">{w.name}</td><td>{w.dpdp_locked ? 'LOCKED' : 'OPEN'}</td><td>{w.latency_need_ms} ms</td><td>{w.deferrable ? 'yes' : 'no'}</td><td>{w.kwh}</td><td className="text-cyan-200">{a ? `${REGIONS[a.region].city} · ${String(a.hour_utc).padStart(2,'0')}:00Z` : '—'}</td></tr>; })}
      </tbody></table></div>
      {schedule ? <p className="mt-3 text-xs text-slate-500"><CalendarClock className="mr-1 inline h-3.5 w-3.5" />{schedule.deferred_jobs} jobs scheduled · {schedule.carbon_tonnes.toFixed(3)} tCO₂e · ${schedule.cost_usd.toFixed(2)}</p> : null}
    </section>
  );
}
