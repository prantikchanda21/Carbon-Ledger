/**
 * Dual Groq API support: a primary and an optional backup key.
 *  - failover (default): try the primary key; on any failure (rate limit, bad key, timeout, 5xx, empty reply) try the backup.
 *  - balance: alternate which key goes first on each request, falling back to the other on failure.
 * Keys are read only on the server and are never logged or returned.
 */
export type GroqSlot = 'primary' | 'backup';
export interface GroqProvider { slot: GroqSlot; key: string; model: string }
export interface GroqRequest { messages: Array<{ role: 'system' | 'user'; content: string }>; temperature: number; max_tokens: number; response_format?: { type: 'json_object' } }
export interface GroqReply { content: string; slot: GroqSlot }

const URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = 'openai/gpt-oss-20b';
let counter = 0;

export function groqProviders(env: Record<string, string | undefined> = process.env): GroqProvider[] {
  const model = env.GROQ_MODEL?.trim() || DEFAULT_MODEL;
  const list: GroqProvider[] = [];
  const k1 = env.GROQ_API_KEY?.trim();
  const k2 = env.GROQ_API_KEY_2?.trim();
  if (k1) list.push({ slot: 'primary', key: k1, model });
  if (k2 && k2 !== k1) list.push({ slot: list.length ? 'backup' : 'primary', key: k2, model: env.GROQ_MODEL_2?.trim() || model });
  return list;
}

export function groqConfigured(env: Record<string, string | undefined> = process.env): boolean { return groqProviders(env).length > 0; }

function ordered(providers: GroqProvider[], env: Record<string, string | undefined>): GroqProvider[] {
  if (providers.length < 2 || (env.GROQ_STRATEGY ?? 'failover').toLowerCase() !== 'balance') return providers;
  const first = counter++ % providers.length;
  return [...providers.slice(first), ...providers.slice(0, first)];
}

/** Returns the first successful reply, or null when no key is configured or every key failed. */
export async function groqChat(req: GroqRequest, totalTimeoutMs = 6000, env: Record<string, string | undefined> = process.env, fetchImpl: typeof fetch = fetch): Promise<GroqReply | null> {
  const providers = ordered(groqProviders(env), env);
  if (!providers.length) return null;
  const perTry = Math.max(1500, Math.floor(totalTimeoutMs / providers.length));
  for (const p of providers) {
    try {
      const r = await fetchImpl(URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${p.key}` },
        signal: AbortSignal.timeout(perTry),
        body: JSON.stringify({ model: p.model, ...req }),
      });
      if (!r.ok) { console.error(`[groq] ${p.slot} key returned HTTP ${r.status}`); continue; }
      const data = await r.json() as { choices?: Array<{ message?: { content?: string | null } }> };
      const content = data.choices?.[0]?.message?.content;
      if (typeof content === 'string' && content.trim()) return { content, slot: p.slot };
      console.error(`[groq] ${p.slot} key returned an empty reply`);
    } catch (e) {
      console.error(`[groq] ${p.slot} key request failed: ${e instanceof Error ? e.name : 'error'}`);
    }
  }
  return null;
}
