import { REGIONS, REGION_ORDER } from '../regions.ts';
import { generateTelemetry } from '../mockData.ts';
import type { GridNodeTelemetry, RegionId } from '../types.ts';
import { LAB_VERSION, type LabInput, type Job, type Snapshot, type Schedule, type Choice, type Comparison, type Plan } from './types.ts';
export const HOUR = 3_600_000;
const india = new Set<RegionId>(['mumbai', 'hyderabad', 'delhi']);
export function rng(seed: number): () => number {
  let s = seed | 0;
  return () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export function demoHistory(seed = 42): Snapshot[] {
  const random = rng(seed);
  const origin = Date.parse('2026-10-01T00:00:00Z');
  return Array.from({ length: 168 }, (_, i) => {
    const date = new Date(origin + i * HOUR);
    return { at: date.toISOString(), telemetry: generateTelemetry(date, false, true).map(n => ({ ...n, source: 'mock', carbon_ci: Math.max(0, n.carbon_ci * (0.85 + random() * 0.3)), energy_price: n.energy_price * (0.9 + random() * 0.2) })) };
  });
}
export function defaultInput(): LabInput {
  return {
    version: LAB_VERSION, name: 'Carbon placement experiment', seed: 42, start: '2026-10-06T00:00:00.000Z', horizon: 24,
    controls: { sla_ms: 100, carbon_tax: 0.5, budget_cr: 50, dpdp_locked: false }, carbonPriceUsdT: 100,
    migration: { transferKwhPerGb: 0.02, bandwidthGbPerHour: 500, startupHours: 0.1, downtimeUsdPerHour: 1 },
    capacity: Object.fromEntries(REGION_ORDER.map(id => [id, { cpu: 64, gpu: 4 }])) as LabInput['capacity'], history: demoHistory(),
    jobs: [
      { id: 'etl', name: 'Customer ETL', current: 'mumbai', duration: 2, deadline: 8, earliest: 0, cpu: 8, gpu: 0, kwh: 80, dataGb: 20, latency: 100, indiaOnly: true, dependencies: [] },
      { id: 'train', name: 'Model training', current: 'virginia', duration: 4, deadline: 20, earliest: 0, cpu: 16, gpu: 2, kwh: 600, dataGb: 80, latency: 100, indiaOnly: false, dependencies: [] },
      { id: 'report', name: 'Analytics report', current: 'mumbai', duration: 1, deadline: 12, earliest: 0, cpu: 4, gpu: 0, kwh: 20, dataGb: 5, latency: 100, indiaOnly: true, dependencies: ['etl'] },
    ],
  };
}
function finite(v: unknown, min: number, max: number, label: string): asserts v is number {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) throw new Error(`${label} must be between ${min} and ${max}`);
}
export function validateHistory(value: unknown): Snapshot[] {
  if (!Array.isArray(value) || value.length < 2 || value.length > 744) throw new Error('History requires 2–744 hourly snapshots');
  const seen = new Set<number>();
  for (const row of value) {
    if (!row || typeof row.at !== 'string' || !Array.isArray(row.telemetry) || row.telemetry.length !== 20) throw new Error('Each snapshot needs an ISO timestamp and all 20 regions');
    const t = Date.parse(row.at);
    if (!Number.isFinite(t) || t % HOUR || seen.has(t)) throw new Error('Timestamps must be unique, valid UTC hours');
    seen.add(t);
    const regions = new Set<string>();
    for (const n of row.telemetry) {
      if (!n || !REGION_ORDER.some(id => REGIONS[id].code === n.region) || regions.has(n.region)) throw new Error('Unknown or duplicate telemetry region');
      regions.add(n.region);
      finite(n.carbon_ci, 0, 10000, 'Carbon intensity'); finite(n.energy_price, 0, 100000, 'Energy USD/MWh');
      finite(n.latency_ms, 0, 10000, 'Latency'); finite(n.egress_cost_gb, 0, 1000, 'Egress USD/GB');
      if (n.available !== undefined && typeof n.available !== 'boolean') throw new Error('Availability must be boolean');
      if (n.source !== undefined && !['mock','electricity-maps','stale'].includes(n.source)) throw new Error('Unknown telemetry source');
    }
  }
  const sorted = [...value].sort((a, b) => Date.parse(a.at) - Date.parse(b.at)) as Snapshot[];
  if (sorted.some((s, i) => i > 0 && Date.parse(s.at) - Date.parse(sorted[i - 1].at) !== HOUR)) throw new Error('History must be contiguous hourly snapshots; fill gaps explicitly');
  return sorted;
}
export function validateInput(raw: unknown): LabInput {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid experiment');
  const x = raw as LabInput;
  if (x.version !== LAB_VERSION) throw new Error('Unsupported experiment version');
  if (typeof x.name !== 'string' || !x.name.trim() || x.name.length > 120) throw new Error('Name must contain 1–120 characters');
  if (!Number.isFinite(Date.parse(x.start)) || Date.parse(x.start) % HOUR) throw new Error('Start must be a UTC hour');
  finite(x.seed, 0, 2147483647, 'Seed'); finite(x.horizon, 1, 48, 'Horizon');
  if (!Number.isInteger(x.horizon)) throw new Error('Horizon must be whole hours');
  finite(x.carbonPriceUsdT, 0, 10000, 'Carbon price');
  finite(x.controls?.sla_ms, 1, 10000, 'SLA'); finite(x.controls?.carbon_tax, 0, 1, 'Carbon tax'); finite(x.controls?.budget_cr, 0, 10000, 'Budget');
  if (typeof x.controls.dpdp_locked !== 'boolean') throw new Error('Residency setting must be boolean');
  finite(x.migration?.bandwidthGbPerHour, 1, 100000, 'Transfer bandwidth'); finite(x.migration?.startupHours, 0, 24, 'Startup hours');
  finite(x.migration?.transferKwhPerGb, 0, 100, 'Transfer energy'); finite(x.migration?.downtimeUsdPerHour, 0, 100000, 'Downtime cost');
  for (const id of REGION_ORDER) { finite(x.capacity?.[id]?.cpu, 0, 100000, 'CPU capacity'); finite(x.capacity?.[id]?.gpu, 0, 10000, 'GPU capacity'); }
  if (!Array.isArray(x.jobs) || !x.jobs.length || x.jobs.length > 50) throw new Error('Use 1–50 jobs');
  const ids = new Set<string>();
  for (const j of x.jobs) {
    if (!j || typeof j.id !== 'string' || !/^[a-z][a-z0-9-]{0,39}$/.test(j.id) || ids.has(j.id)) throw new Error('Job IDs must be unique lowercase slugs');
    ids.add(j.id);
    if (typeof j.name !== 'string' || !j.name.trim() || j.name.length > 120 || !REGION_ORDER.includes(j.current)) throw new Error('Invalid job name or current region');
    finite(j.duration, 1, 48, 'Job duration'); finite(j.earliest, 0, 47, 'Earliest hour'); finite(j.deadline, 1, 48, 'Deadline');
    if (![j.duration,j.earliest,j.deadline].every(Number.isInteger) || j.deadline > x.horizon || j.earliest >= j.deadline) throw new Error('Use whole-hour jobs inside the horizon');
    finite(j.cpu, 1, 100000, 'Job CPU'); finite(j.gpu, 0, 10000, 'Job GPU'); finite(j.kwh, 0.001, 1000000, 'Job kWh');
    finite(j.dataGb, 0, 1000000, 'Job data'); finite(j.latency, 1, 10000, 'Job SLA');
    if (typeof j.indiaOnly !== 'boolean' || !Array.isArray(j.dependencies) || j.dependencies.length > 50 || !j.dependencies.every(d => typeof d === 'string')) throw new Error('Invalid job constraints');
  }
  for (const j of x.jobs) if (j.dependencies.some(d => !ids.has(d) || d === j.id)) throw new Error('Dependencies must reference other existing jobs');
  const done = new Set<string>();
  for (let i = 0; i < x.jobs.length; i++) for (const j of x.jobs) if (j.dependencies.every(d => done.has(d))) done.add(j.id);
  if (done.size !== x.jobs.length) throw new Error('Dependency cycle detected');
  const history = validateHistory(x.history);
  return { ...x, history };
}
export function nodeAt(history: Snapshot[], region: RegionId, at: number): GridNodeTelemetry | undefined {
  return history.find(s => Date.parse(s.at) === at)?.telemetry.find(n => n.region === REGIONS[region].code);
}
/** Seasonal persistence, trained exclusively on observations strictly before the forecast origin. */
export function predictNode(history: Snapshot[], region: RegionId, at: number, origin: number): GridNodeTelemetry | undefined {
  const train = history.filter(s => Date.parse(s.at) < origin);
  const hour = new Date(at).getUTCHours();
  const seasonal = train.filter(s => new Date(s.at).getUTCHours() === hour).slice(-7);
  const pool = seasonal.length ? seasonal : train.slice(-6);
  const nodes = pool.map(s => s.telemetry.find(n => n.region === REGIONS[region].code)).filter((n): n is GridNodeTelemetry => !!n);
  const last = train.at(-1)?.telemetry.find(n => n.region === REGIONS[region].code);
  if (!last || !nodes.length) return undefined;
  return { ...last, carbon_ci: nodes.reduce((s,n)=>s+n.carbon_ci,0)/nodes.length, energy_price: nodes.reduce((s,n)=>s+n.energy_price,0)/nodes.length };
}
export function migrationCost(job: Job, from: GridNodeTelemetry, to: GridNodeTelemetry, settings: LabInput['migration'], moving: boolean) {
  const hours = moving ? job.dataGb / settings.bandwidthGbPerHour + settings.startupHours : 0;
  const kwh = moving ? job.dataGb * settings.transferKwhPerGb : 0;
  return { hours, kwh, usd: moving ? job.dataGb * from.egress_cost_gb + kwh * (from.energy_price + to.energy_price) / 2000 : 0, kg: kwh * (from.carbon_ci + to.carbon_ci) / 2000, downtime: hours * settings.downtimeUsdPerHour };
}
export function schedule(input: LabInput, policy: 'baseline'|'optimized', actual = false): Schedule {
  const origin = Date.parse(input.start);
  const nodeCache=new Map<string,GridNodeTelemetry|undefined>();
  const get = (r:RegionId,h:number) => { const key=r+':'+h; if(!nodeCache.has(key))nodeCache.set(key,actual?nodeAt(input.history,r,origin+h*HOUR):predictNode(input.history,r,origin+h*HOUR,origin));return nodeCache.get(key); };
  const alternatives: Record<string,Choice[]> = {};
  const choices: Choice[] = [], unscheduled: Schedule['unscheduled'] = [], rejected: Schedule['rejected'] = {};
  const occupancy = Object.fromEntries(REGION_ORDER.map(id=>[id, Array.from({length:input.horizon},()=>({cpu:0,gpu:0}))])) as Record<RegionId,{cpu:number;gpu:number}[]>;
  const pending = [...input.jobs].sort((a,b)=>a.deadline-b.deadline || a.id.localeCompare(b.id));
  while (pending.length) {
    const ix = pending.findIndex(j=>j.dependencies.every(d=>choices.some(c=>c.job===d)||unscheduled.some(u=>u.job===d)));
    if(ix<0) { unscheduled.push(...pending.map(j=>({job:j.id,reason:'Dependency cycle or missing dependency'}))); break; }
    const job = pending.splice(ix,1)[0]; rejected[job.id]=[];
    if(job.dependencies.some(d=>unscheduled.some(u=>u.job===d))) { unscheduled.push({job:job.id,reason:'A dependency could not be scheduled'}); continue; }
    const earliest = Math.max(job.earliest, ...job.dependencies.map(d=>choices.find(c=>c.job===d)!.finish));
    const candidates: Choice[]=[];
    for(const region of policy==='baseline' ? [job.current] : REGION_ORDER) {
      let reason = 'No capacity or deadline-feasible window'; let found=false;
      if((job.indiaOnly||input.controls.dpdp_locked)&&!india.has(region)) { rejected[job.id].push({region,reason:'India-only residency constraint'}); continue; }
      for(let start=earliest; start+job.duration<=Math.min(input.horizon,job.deadline);start++) {
        const from=get(job.current,start), first=get(region,start);
        if(!from||!first) {reason='Missing historical/forecast data';continue;}
        const migration=migrationCost(job,from,first,input.migration,region!==job.current);
        const reserve = Math.ceil(migration.hours);
        const finish=start+reserve+job.duration;
        if(finish>job.deadline||finish>input.horizon) {reason='Transfer/startup plus runtime exceeds deadline';continue;}
        let energyUsd=0, carbonKg=0, valid=true;
        for(let h=start;h<finish;h++) {
          const node=get(region,h);
          if(!node||node.available===false) {reason='Region unavailable or data missing during window';valid=false;break;}
          if(node.latency_ms>Math.min(job.latency,input.controls.sla_ms)) {reason='Latency exceeds job/controller SLA';valid=false;break;}
          const used=occupancy[region][h]; const cap=input.capacity[region];
          if(used.cpu+job.cpu>cap.cpu||used.gpu+job.gpu>cap.gpu) {reason='Insufficient shared CPU/GPU capacity';valid=false;break;}
          if(h>=start+reserve) { energyUsd+=job.kwh/job.duration*node.energy_price/1000;carbonKg+=job.kwh/job.duration*node.carbon_ci/1000; }
        }
        if(!valid) continue;
        const carbonUsd=(carbonKg+migration.kg)*input.carbonPriceUsdT/1000;
        const hourlyBefore=job.kwh/job.duration*(from.energy_price/1000+from.carbon_ci*input.carbonPriceUsdT/1e6);
        const hourlyAfter=(energyUsd+carbonKg*input.carbonPriceUsdT/1000)/job.duration;
        const overhead=migration.usd+migration.downtime+migration.kg*input.carbonPriceUsdT/1000;
        candidates.push({job:job.id,region,start,finish,energyUsd,carbonKg,carbonUsd,transferUsd:migration.usd,downtimeUsd:migration.downtime,transferKg:migration.kg,totalUsd:energyUsd+carbonUsd+migration.usd+migration.downtime,migrationHours:migration.hours,migrationKwh:migration.kwh,breakEvenHours: hourlyBefore>hourlyAfter ? overhead/(hourlyBefore-hourlyAfter) : null});
        found=true;
        if(policy==='baseline') break; // baseline stays and starts at the first feasible hour
      }
      if(!found) rejected[job.id].push({region,reason});
    }
    candidates.sort((a,b)=>a.totalUsd-b.totalUsd||a.finish-b.finish||a.region.localeCompare(b.region));
    alternatives[job.id]=candidates.filter((c,i,all)=>all.findIndex(v=>v.region===c.region)===i);
    const best=candidates[0];
    if(!best) {unscheduled.push({job:job.id,reason:rejected[job.id].map(r=>`${REGIONS[r.region].city}: ${r.reason}`).join('; ')});continue;}
    choices.push(best);
    for(let h=best.start;h<best.finish;h++) {occupancy[best.region][h].cpu+=job.cpu;occupancy[best.region][h].gpu+=job.gpu;}
  }
  return {choices,alternatives,rejected,unscheduled,totalUsd:choices.reduce((s,c)=>s+c.totalUsd,0),carbonKg:choices.reduce((s,c)=>s+c.carbonKg+c.transferKg,0),migrationUsd:choices.reduce((s,c)=>s+c.transferUsd+c.downtimeUsd,0),energyKwh:choices.reduce((s,c)=>s+input.jobs.find(j=>j.id===c.job)!.kwh+c.migrationKwh,0)};
}
export function compare(input: LabInput): Comparison {
  const baseline=schedule(input,'baseline'), optimized=schedule(input,'optimized');
  const comparable=baseline.unscheduled.length===0&&optimized.unscheduled.length===0;
  return {baseline,optimized,comparable,savingsUsd:baseline.totalUsd-optimized.totalUsd,avoidedKg:baseline.carbonKg-optimized.carbonKg};
}
export function fingerprint(input: LabInput): string {
  const raw=JSON.stringify(input); let hash=2166136261;
  for(let i=0;i<raw.length;i++) hash=Math.imul(hash^raw.charCodeAt(i),16777619);
  return (hash>>>0).toString(16).padStart(8,'0');
}
export function transition(plan: Plan, action: 'approve'|'execute'|'rollback', hash: string, feasible: boolean, at=new Date().toISOString()): Plan {
  if(plan.fingerprint!==hash) throw new Error('Inputs changed. Create a new plan before approval.');
  const next = action==='approve'&&plan.status==='draft'&&feasible ? 'approved' : action==='execute'&&plan.status==='approved'&&feasible ? 'executed' : action==='rollback'&&plan.status==='executed' ? 'rolled-back' : null;
  if(!next) throw new Error('Invalid plan transition or unscheduled jobs remain');
  return {...plan,status:next,audit:[...plan.audit,{at,action,detail:action==='execute'?'Dry-run execution recorded; no cluster was changed':action==='rollback'?'Dry-run rollback recorded; no cluster was changed':'Approved this exact scenario fingerprint'}]};
}
