import type { DecisionLogEntry, EngineKind, RegionId } from './types.ts';
import { REGION_ORDER } from './regions.ts';

const KEY = 'dual-engine-decision-log-v2';
const MAX = 500;

function newId(prefix = 'decision'): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeEntry(value: unknown, index: number): DecisionLogEntry | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Partial<DecisionLogEntry> & Record<string, unknown>;
  const engine: EngineKind = raw.engine === 'onnx' || raw.engine === 'glpk-wasm' || raw.engine === 'greedy-safe' ? raw.engine : 'greedy-safe';
  const timestamp = typeof raw.timestamp === 'number' && Number.isFinite(raw.timestamp) ? raw.timestamp : Date.now() - index;
  const reasonCodes = Array.isArray(raw.reasonCodes)
    ? raw.reasonCodes.filter((reason): reason is DecisionLogEntry['reasonCodes'][number] => ['SLA','DPDP','fallback','hedge_change','carbon_shift','scheduler','event'].includes(String(reason)))
    : [];
  const allocation: Record<RegionId, number> = Object.fromEntries(
    REGION_ORDER.map((id) => {
      const value = raw.allocation && typeof raw.allocation === 'object' ? (raw.allocation as Record<string, unknown>)[id] : undefined;
      return [id, typeof value === 'number' && Number.isFinite(value) ? value : 0];
    }),
  ) as Record<RegionId, number>;
  const rawId = typeof raw.id === 'string' && raw.id.trim() ? raw.id : undefined;
  return {
    id: rawId ?? newId(`legacy-${index}`),
    timestamp,
    engine,
    reasonCodes,
    summary: typeof raw.summary === 'string' ? raw.summary : 'Controller decision',
    cost_usd_per_kwh: typeof raw.cost_usd_per_kwh === 'number' && Number.isFinite(raw.cost_usd_per_kwh) ? raw.cost_usd_per_kwh : 0,
    blended_ci: typeof raw.blended_ci === 'number' && Number.isFinite(raw.blended_ci) ? raw.blended_ci : 0,
    allocation,
  };
}

export function readDecisionLog(): DecisionLogEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const used = new Set<string>();
    const normalized = parsed
      .map((entry, index) => normalizeEntry(entry, index))
      .filter((entry): entry is DecisionLogEntry => entry !== null)
      .map((entry) => {
        if (used.has(entry.id)) entry.id = newId('duplicate');
        used.add(entry.id);
        return entry;
      })
      .slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(normalized));
    return normalized;
  } catch {
    return [];
  }
}

export function appendDecisionLog(entry: DecisionLogEntry): DecisionLogEntry[] {
  const normalized = normalizeEntry(entry, 0);
  if (!normalized) return readDecisionLog();
  const existing = readDecisionLog().filter((item) => item.id !== normalized.id);
  const next = [normalized, ...existing].slice(0, MAX);
  if (typeof window !== 'undefined') { try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* Keep in-memory decisions when storage is full or disabled. */ } }
  return next;
}

export function decisionLogCsv(entries = readDecisionLog()): string {
  const header = 'timestamp,engine,reason_codes,summary,cost_usd_per_kwh,blended_ci';
  const rows = entries.map((e) => [
    new Date(e.timestamp).toISOString(), e.engine, e.reasonCodes.join('|'),
    `"${e.summary.replaceAll('"', '""')}"`, e.cost_usd_per_kwh, e.blended_ci,
  ].join(','));
  return [header, ...rows].join('\n');
}

export function brsrSummary(entries = readDecisionLog()): string {
  const fallback = entries.filter((e) => e.reasonCodes.includes('fallback')).length;
  const sla = entries.filter((e) => e.reasonCodes.includes('SLA')).length;
  const carbon = entries.length ? entries.reduce((s, e) => s + e.blended_ci, 0) / entries.length : 0;
  return `ESG/BRSR controller summary\nDecisions: ${entries.length}\nFallback decisions: ${fallback}\nSLA-related decisions: ${sla}\nAverage blended carbon intensity: ${carbon.toFixed(1)} gCO2/kWh`;
}
