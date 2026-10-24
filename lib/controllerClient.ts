import type { ControllerErrorBody, ControllerRequest, FeedSource, GridNodeTelemetry, OptimizationResult } from './types.ts';
import { generateTelemetry } from './mockData.ts';
import { isTelemetryFeed } from './validation.ts';

const ENDPOINT = '/api/onnx-controller';

export async function requestOptimization(payload: ControllerRequest, signal?: AbortSignal): Promise<OptimizationResult> {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });
  if (!response.ok) {
    let message = `Controller returned HTTP ${response.status}`;
    const raw = await response.text().catch(() => '');
    try {
      const body = JSON.parse(raw) as Partial<ControllerErrorBody>;
      if (typeof body.error === 'string' && body.error.trim()) message = body.error;
      if (typeof body.code === 'string' && body.code.trim()) message += ` (${body.code})`;
    } catch {
      const excerpt = raw.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200);
      if (excerpt) message += `: ${excerpt}`;
    }
    throw new Error(message);
  }
  return (await response.json()) as OptimizationResult;
}

export interface TelemetryLoad {
  telemetry: GridNodeTelemetry[];
  source: Exclude<FeedSource, 'loading'>;
}

export async function loadTelemetry(signal?: AbortSignal, timeoutMs = 2500): Promise<TelemetryLoad> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const relay = (): void => controller.abort();
  signal?.addEventListener('abort', relay);
  try {
    const response = await fetch(ENDPOINT, { signal: controller.signal, cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = (await response.json()) as { telemetry?: unknown; source?: FeedSource };
    if (!isTelemetryFeed(body.telemetry)) throw new Error('Malformed telemetry feed');
    return { telemetry: body.telemetry, source: body.source === 'electricity-maps' || body.source === 'mixed' || body.source === 'modeled' ? body.source : 'api' };
  } catch {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    return { telemetry: generateTelemetry(new Date(), false, true), source: 'modeled' };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', relay);
  }
}
