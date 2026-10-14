'use client';

import { useMemo, useState } from 'react';
import { MapPinned, RotateCcw } from 'lucide-react';
import { REGIONS } from '@/lib/regions';
import type { RegionId } from '@/lib/types';

type Node = { id: RegionId; carbon_ci: number; weight: number; eligible: boolean; latency_ms: number };
const land = [
  'M 62 104 L 94 76 123 56 166 46 196 65 216 89 191 105 178 131 152 132 142 160 118 169 100 151 72 150 56 126 Z',
  'M 166 170 L 194 186 211 219 198 260 180 298 161 282 151 248 139 217 145 185 Z',
  'M 264 99 L 297 79 318 85 337 102 332 122 312 136 290 129 276 148 261 130 Z',
  'M 300 152 L 337 145 359 174 371 213 352 269 325 276 301 236 287 188 Z',
  'M 335 87 L 376 54 420 55 442 38 496 50 542 45 580 69 639 73 672 101 651 127 607 122 585 155 548 144 519 172 488 162 465 135 439 151 408 126 380 143 353 128 Z',
  'M 554 185 L 572 204 603 210 626 193 642 215 621 234 587 229 565 214 Z',
  'M 592 253 L 629 237 664 256 675 286 648 305 611 291 Z',
  'M 206 42 L 223 27 247 34 237 57 219 64 Z',
];
const project = (lat: number, lon: number) => ({ x: (lon + 180) / 360 * 720, y: (90 - lat) / 180 * 360 });
export default function RegionMap2D({ nodes, selected, onSelect }: {nodes: Node[]; selected: RegionId | null; onSelect: (id: RegionId) => void}) {
  const [metric, setMetric] = useState<'carbon'|'allocation'|'latency'>('carbon');
  const [zoom, setZoom] = useState(1);
  const [hovered, setHovered] = useState<RegionId | null>(null);
  const active = useMemo(() => nodes.find(n => n.id === (hovered ?? selected)), [nodes, hovered, selected]);
  return <section className="atlas-card overflow-hidden" aria-label="Interactive two-dimensional cloud region map">
    <div className="atlas-card-head flex flex-wrap items-center justify-between gap-3">
      <div><h3 className="flex items-center gap-2 text-sm font-semibold text-slate-100"><MapPinned className="h-4 w-4 text-emerald-400"/> Global regions · 2D atlas</h3><p className="mt-1 text-xs text-slate-400">20 modelled regions · select a marker to inspect</p></div>
      <div className="flex flex-wrap items-center gap-1.5"><select aria-label="Map overlay" value={metric} onChange={e => setMetric(e.target.value as typeof metric)} className="atlas-select"><option value="carbon">Carbon intensity</option><option value="allocation">Allocation share</option><option value="latency">Latency</option></select><button className="atlas-tool" aria-label="Zoom out" onClick={() => setZoom(z => Math.max(1,z-.25))}>−</button><button className="atlas-tool" aria-label="Zoom in" onClick={() => setZoom(z => Math.min(2.5,z+.25))}>+</button><button className="atlas-tool" aria-label="Reset map zoom" onClick={() => setZoom(1)}><RotateCcw className="h-3.5 w-3.5"/></button></div>
    </div>
    <div className="relative overflow-hidden bg-[#071723]">
      <svg viewBox="0 0 720 360" className="block w-full" role="img" aria-label="Stylized flat world map with selectable cloud locations; not a geographic boundary reference">
        <defs><pattern id="atlasGrid" width="36" height="36" patternUnits="userSpaceOnUse"><path d="M 36 0 L 0 0 0 36" fill="none" stroke="#294859" strokeWidth=".65" opacity=".5"/></pattern><radialGradient id="atlasOcean"><stop stopColor="#113644"/><stop offset="1" stopColor="#071723"/></radialGradient><filter id="atlasGlow"><feGaussianBlur stdDeviation="4"/></filter></defs>
        <rect width="720" height="360" fill="url(#atlasOcean)"/><rect width="720" height="360" fill="url(#atlasGrid)"/>
        <g transform={`translate(${360*(1-zoom)} ${180*(1-zoom)}) scale(${zoom})`}>
          {land.map((d,i) => <path key={i} d={d} fill="#163440" stroke="#345766" strokeWidth="1.2" opacity=".94" />)}
          {nodes.map(n => { const p=project(REGIONS[n.id].lat,REGIONS[n.id].lon); const value= metric==='carbon'?n.carbon_ci:metric==='allocation'?n.weight*100:n.latency_ms; const color=!n.eligible?'#fb7185':metric==='carbon'?(value<300?'#34d399':value<550?'#fbbf24':'#f87171'):metric==='latency'?(value<80?'#34d399':value<140?'#fbbf24':'#fb7185'):'#38bdf8'; const r = 4 + (metric==='allocation'?Math.min(12,Math.max(0,value)*.18):Math.min(7,Math.max(0,n.weight)*12)); return <g key={n.id} tabIndex={0} role="button" aria-label={`${REGIONS[n.id].city}: ${Math.round(value)} ${metric}`} onClick={() => onSelect(n.id)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect(n.id);}}} onMouseEnter={()=>setHovered(n.id)} onMouseLeave={()=>setHovered(null)} className="cursor-pointer outline-none"><circle cx={p.x} cy={p.y} r={r+7} fill={color} opacity=".19" filter="url(#atlasGlow)"/><circle cx={p.x} cy={p.y} r={r} fill={color} fillOpacity=".77" stroke={selected===n.id?'white':'#cbd5e1'} strokeWidth={selected===n.id?2.5:.6}/>{selected===n.id && <circle cx={p.x} cy={p.y} r={r+5} stroke="white" strokeWidth="1" strokeDasharray="3 3" fill="none"/>}<title>{REGIONS[n.id].city} · {metric}: {value.toFixed(1)}</title></g>; })}
        </g>
      </svg>
      {active && <div className="pointer-events-none absolute bottom-2 left-2 rounded-xl border border-emerald-400/20 bg-[#061521]/95 px-3 py-2 text-xs shadow-xl"><strong className="text-emerald-300">{REGIONS[active.id].city}</strong><span className="ml-2 text-slate-300">{Math.round(active.carbon_ci)} gCO₂/kWh · {active.latency_ms.toFixed(0)} ms · {(active.weight*100).toFixed(1)}% allocation</span></div>}
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 px-4 py-2 text-[11px] text-slate-400"><span><span className="text-emerald-400">●</span> Low <span className="ml-3 text-amber-400">●</span> Medium <span className="ml-3 text-rose-400">●</span> High / restricted</span><span>Illustrative basemap · scenario-linked metrics</span></div>
  </section>;
}
