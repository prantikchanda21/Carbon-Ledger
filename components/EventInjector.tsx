'use client';

import { Siren, X } from 'lucide-react';
import { EVENT_PRESETS } from '@/lib/events';
import { useControllerStore } from '@/lib/store';

export default function EventInjector() {
  const addEvent = useControllerStore((s) => s.addEvent);
  const events = useControllerStore((s) => s.events);
  const removeEvent = useControllerStore((s) => s.removeEvent);
  return <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
    <div className="mb-3 flex items-center gap-2"><Siren className="h-4 w-4 text-amber-300" /><h2 className="text-sm font-semibold text-slate-100">Event injector</h2></div>
    <div className="grid grid-cols-2 gap-2">
      {EVENT_PRESETS.map((preset) => <button key={preset.type} type="button" onClick={() => addEvent({ ...preset, id: `${preset.type}-${Date.now()}`, startedAt: Date.now() })} className="rounded-xl border border-white/10 bg-slate-900/60 px-2.5 py-2 text-left text-[11px] text-slate-300 hover:border-amber-300/30 hover:text-amber-200">{preset.label}</button>)}
    </div>
    {events.length ? <div className="mt-3 space-y-1">{events.map((e) => <div key={e.id} className="flex items-center justify-between rounded-lg bg-amber-400/5 px-2.5 py-1.5 text-[11px] text-amber-200"><span>{e.label}</span><button type="button" onClick={() => removeEvent(e.id)} aria-label={`remove ${e.label}`}><X className="h-3.5 w-3.5" /></button></div>)}</div> : null}
  </section>;
}
