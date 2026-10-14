import { NextResponse } from 'next/server';
import { groqChat, groqConfigured } from '@/lib/groq';
import type { CommandIntent, ControlState } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 8;

function deterministic(text: string): CommandIntent {
  const normalized = text.toLowerCase();
  const controls: Partial<ControlState> = {};
  if (/\b(india|indian|dpdp|residency)\b/.test(normalized)) controls.dpdp_locked = true;
  if (/max(imum)?\s+(green|renewable|clean)/.test(normalized) || normalized.includes('greenest')) controls.carbon_tax = 0.95;
  if (/min(imum)?\s+cost|cheapest|lowest cost/.test(normalized)) controls.carbon_tax = 0.1;
  const slaMatch = normalized.match(/(\d{1,3})\s*ms/);
  if (slaMatch) controls.sla_ms = Math.max(10, Math.min(100, Number(slaMatch[1])));
  const budgetMatch = normalized.match(/(\d{1,3})\s*(?:cr|crore)/);
  if (budgetMatch) controls.budget_cr = Math.max(10, Math.min(100, Number(budgetMatch[1])));
  if (!Object.keys(controls).length && normalized.includes('strict')) {
    controls.dpdp_locked = true; controls.sla_ms = 20; controls.carbon_tax = 0.8;
  }
  return { controls, message: Object.keys(controls).length ? `Applied ${Object.keys(controls).length} control changes.` : 'No deterministic control change was inferred.', confidence: Object.keys(controls).length ? 0.82 : 0.42, source: 'deterministic' };
}

const SYSTEM_PROMPT = 'You translate a user command into settings for a carbon/treasury controller. Respond with a single JSON object and nothing else: {"controls": {...}, "message": string, "confidence": number}. "controls" may only contain these keys: sla_ms (integer 10-100), carbon_tax (number 0-1, higher = greener routing), budget_cr (integer 10-100), dpdp_locked (boolean, true = India-only placement). Omit keys the user did not ask to change. "message" is one short sentence describing what you changed. "confidence" is 0-1.';

const num = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);

/** Never trust model output: keep only known keys and clamp them to the ranges the controller accepts. */
function sanitizeControls(input: unknown): Partial<ControlState> {
  const raw = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const controls: Partial<ControlState> = {};
  const sla = num(raw.sla_ms);
  const tax = num(raw.carbon_tax);
  const budget = num(raw.budget_cr);
  if (sla !== null) controls.sla_ms = Math.round(Math.max(10, Math.min(100, sla)));
  if (tax !== null) controls.carbon_tax = Number(Math.max(0, Math.min(1, tax)).toFixed(2));
  if (budget !== null) controls.budget_cr = Math.round(Math.max(10, Math.min(100, budget)));
  if (typeof raw.dpdp_locked === 'boolean') controls.dpdp_locked = raw.dpdp_locked;
  return controls;
}

/** Pulls the JSON object out of the reply even if a model wraps it in prose or code fences. */
function extractJson(text: string): unknown {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('no JSON object in model reply');
  return JSON.parse(text.slice(start, end + 1));
}

export async function POST(request: Request): Promise<NextResponse> {
  const body = await request.json().catch(() => null) as { text?: unknown };
  if (typeof body?.text !== 'string' || !body.text.trim()) return NextResponse.json({ error: 'text is required' }, { status: 400 });
  if (!groqConfigured()) return NextResponse.json(deterministic(body.text));
  try {
    const reply = await groqChat({
      temperature: 0, max_tokens: 600, response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: body.text.slice(0, 500) }],
    }, 6000);
    if (!reply) return NextResponse.json(deterministic(body.text));
    const raw = reply.content;
    const parsed = extractJson(raw) as { controls?: unknown; message?: unknown; confidence?: unknown };
    const controls = sanitizeControls(parsed.controls);
    const confidence = num(parsed.confidence) ?? 0.7;
    return NextResponse.json({
      controls,
      message: typeof parsed.message === 'string' && parsed.message.trim() ? parsed.message.trim().slice(0, 200) : (Object.keys(controls).length ? 'Command applied.' : 'No control change was inferred.'),
      confidence: Math.max(0, Math.min(1, confidence)),
      source: 'groq',
    } satisfies CommandIntent);
  } catch (error) {
    console.error('[command] Groq request failed, using deterministic parser:', error instanceof Error ? error.message : error);
    return NextResponse.json(deterministic(body.text));
  }
}
