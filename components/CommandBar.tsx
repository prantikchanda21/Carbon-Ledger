'use client';

import { Command, Copy, HelpCircle, Mic, Play, Share2, Sparkles, VolumeX, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import type { CommandIntent } from '@/lib/types';
import { useControllerStore } from '@/lib/store';

export default function CommandBar() {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const ui = useControllerStore((s) => s.ui);
  const setControls = useControllerStore((s) => s.setControls);
  const setUI = useControllerStore((s) => s.setUI);

  async function runCommand(): Promise<void> {
    if (!text.trim()) return;
    setBusy(true);
    try {
      const response = await fetch('/api/command', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
      const intent = await response.json() as CommandIntent;
      if (!response.ok) throw new Error((intent as unknown as { error?: string }).error ?? 'Command failed');
      setControls(intent.controls);
      toast.success(intent.message, { description: `${intent.source} parser · ${(intent.confidence * 100).toFixed(0)}% confidence` });
      setText('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Command failed');
    } finally { setBusy(false); }
  }

  function copyLink(): void {
    void navigator.clipboard.writeText(window.location.href);
    toast.success('Presenter link copied');
  }

  return (
    <div className="sticky top-0 z-40 flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/80 p-2 backdrop-blur-2xl shadow-[0_18px_60px_-25px_rgba(0,0,0,0.95)]">
      <span className="hidden h-9 w-9 place-items-center rounded-xl bg-cyan-400/10 text-cyan-300 sm:grid"><Command className="h-4 w-4" /></span>
      <input
        aria-label="Natural language controller command"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') void runCommand(); }}
        placeholder='Try “keep everything in India and minimise cost”'
        className="min-w-[200px] flex-1 bg-transparent px-2 text-sm text-slate-100 outline-none placeholder:text-slate-600"
      />
      <button type="button" onClick={() => void runCommand()} disabled={busy} className="inline-flex h-9 items-center gap-2 rounded-xl bg-cyan-400/15 px-3 text-xs font-semibold text-cyan-100 hover:bg-cyan-400/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300"><Sparkles className="h-4 w-4" />{busy ? 'Parsing…' : 'Run'}</button>
      <button type="button" onClick={() => setUI({ presenterMode: !ui.presenterMode })} className={ui.presenterMode ? 'rounded-xl bg-emerald-400/15 px-3 py-2 text-xs text-emerald-200' : 'rounded-xl bg-white/5 px-3 py-2 text-xs text-slate-300'}><Play className="mr-1 inline h-3.5 w-3.5" />Presenter</button>
      <button type="button" onClick={copyLink} className="grid h-9 w-9 place-items-center rounded-xl bg-white/5 text-slate-300 hover:text-white" aria-label="Copy link"><Share2 className="h-4 w-4" /></button>
      <button type="button" onClick={() => setUI({ shadowMode: !ui.shadowMode })} className={ui.shadowMode ? 'rounded-xl bg-amber-400/15 px-3 py-2 text-xs text-amber-200' : 'rounded-xl bg-white/5 px-3 py-2 text-xs text-slate-400'}>Shadow</button>
      <button type="button" onClick={() => setUI({ shortcutOpen: !ui.shortcutOpen })} className="grid h-9 w-9 place-items-center rounded-xl bg-white/5 text-slate-300" aria-label="Keyboard shortcuts"><HelpCircle className="h-4 w-4" /></button>
      <button type="button" onClick={() => setUI({ muted: !ui.muted })} className="grid h-9 w-9 place-items-center rounded-xl bg-white/5 text-slate-300" aria-label={ui.muted ? 'Unmute alerts' : 'Mute alerts'}>{ui.muted ? <VolumeX className="h-4 w-4" /> : <Mic className="h-4 w-4" />}</button>
      {ui.shortcutOpen ? <div className="absolute right-2 top-12 z-50 w-72 rounded-2xl border border-white/10 bg-slate-900 p-4 text-xs text-slate-300 shadow-xl">
        <div className="mb-3 flex items-center justify-between"><span className="font-semibold text-white">Shortcuts</span><button type="button" onClick={() => setUI({ shortcutOpen: false })}><X className="h-4 w-4" /></button></div>
        <p><kbd>1</kbd> Strict compliance</p><p><kbd>2</kbd> Max green</p><p><kbd>3</kbd> Min cost</p><p><kbd>?</kbd> Toggle this overlay</p>
      </div> : null}
      <button type="button" onClick={copyLink} className="sr-only" aria-label="Copy current dashboard link"><Copy /></button>
    </div>
  );
}
