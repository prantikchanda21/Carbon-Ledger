import { generateTelemetry } from '@/lib/mockData';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(): Promise<Response> {
  const encoder = new TextEncoder();
  let timer: ReturnType<typeof setInterval> | null = null;
  const stream = new ReadableStream({
    start(controller) {
      const push = (): void => {
        const payload = JSON.stringify({ telemetry: generateTelemetry(new Date(), false, true), timestamp: Date.now() });
        controller.enqueue(encoder.encode(`event: telemetry\ndata: ${payload}\n\n`));
      };
      push();
      timer = setInterval(push, 5000);
    },
    cancel() { if (timer) clearInterval(timer); },
  });
  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive' },
  });
}
