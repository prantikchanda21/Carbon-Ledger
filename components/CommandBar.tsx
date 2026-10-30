'use client';

import { Share2, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import type { CommandIntent } from '@/lib/types';
import { useControllerStore } from '@/lib/store';

export default function CommandBar() {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const setControls = useControllerStore((s) => s.setControls);

  async function runCommand(): Promise<void> {
    if (!text.trim()) return;
    setBusy(true);
    try {
      const response = await fetch('/api/command', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
      const intent = await response.json() as CommandIntent;
      if (!response.ok) throw new Error((intent as unknown as { error?: string }).error ?? 'Command failed');
      setControls(intent.controls);
      toast.success(intent.message);
      setText('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Command failed');
    } finally { setBusy(false); }
  }

  function copyLink(): void {
    void navigator.clipboard.writeText(window.location.href);
    toast.success('Link copied');
  }

  return (
    <div className="sticky top-0 z-40 flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/80 p-2 backdrop-blur-2xl">
      <input
        aria-label="Describe what you want"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') void runCommand(); }}
        placeholder="Try “keep everything in India and minimise cost”"
        className="min-w-0 flex-1 bg-transparent px-3 text-sm text-slate-100 outline-none placeholder:text-slate-500"
      />
      <button type="button" onClick={() => void runCommand()} disabled={busy} className="inline-flex h-9 items-center gap-2 rounded-xl bg-cyan-400/15 px-3 text-xs font-semibold text-cyan-100 hover:bg-cyan-400/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300"><Sparkles className="h-4 w-4" />{busy ? 'Working…' : 'Apply'}</button>
      <button type="button" onClick={copyLink} className="grid h-9 w-9 place-items-center rounded-xl bg-white/5 text-slate-300 hover:text-white" aria-label="Copy link"><Share2 className="h-4 w-4" /></button>
    </div>
  );
}
