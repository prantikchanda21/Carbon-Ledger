/** Browser-compatible, canonical, tamper-evident hash chain for decision records.
 * It is NOT tamper-proof: an attacker with storage access can replace the entire chain.
 */
export interface AuditRecord { payload: unknown; prev_hash: string; hash: string }
const STORAGE_KEY = 'carbon-ledger-audit-chain-v1';
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  return `{${Object.keys(value as Record<string, unknown>).sort().filter(k => (value as Record<string, unknown>)[k] !== undefined).map(k => `${JSON.stringify(k)}:${canonicalJson((value as Record<string, unknown>)[k])}`).join(',')}}`;
}
export async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2,'0')).join('');
}
export async function verifyAuditChain(records: readonly AuditRecord[]): Promise<{valid:boolean; index:number; head:string}> {
  let previous = 'GENESIS';
  for (let index = 0; index < records.length; index++) {
    const item = records[index];
    if (item.prev_hash !== previous || item.hash !== await sha256(previous + canonicalJson(item.payload)))
      return { valid:false, index, head:previous };
    previous = item.hash;
  }
  return { valid:true, index:records.length, head:previous };
}
export function readAuditChain(): AuditRecord[] {
  if (typeof window === 'undefined') return [];
  try { const parsed:unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item):item is AuditRecord => item && typeof item === 'object' && typeof item.hash === 'string' && typeof item.prev_hash === 'string' && 'payload' in item);
  } catch { return []; }
}
let pendingAppend: Promise<unknown> = Promise.resolve();
async function appendOne(payload: unknown): Promise<AuditRecord> {
  const chain = readAuditChain();
  const verification = await verifyAuditChain(chain);
  if (!verification.valid) throw new Error(`Audit chain invalid at record ${verification.index}; refusing to append`);
  const prev_hash = verification.head;
  const record = {payload, prev_hash, hash:await sha256(prev_hash + canonicalJson(payload))};
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...chain, record]));
  return record;
}

/** Serialize concurrent UI writes so each record has the correct predecessor. */
export function appendAuditRecord(payload: unknown): Promise<AuditRecord> {
  const next = pendingAppend.catch(() => undefined).then(() => appendOne(payload));
  pendingAppend = next;
  return next;
}
