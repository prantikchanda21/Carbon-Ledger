'use client';
import { sankey, sankeyLinkHorizontal } from 'd3-sankey';
import type { OptimizationResult } from '@/lib/types';
export default function TreasurySankey({result}:{result:OptimizationResult|null}) {
  const t=result?.allocations.treasury;
  const values=[t?.liquid_funds_pct??70,t?.green_bonds_pct??20,t?.carbon_futures_pct??10];
  const data={nodes:[{name:'Budget'},{name:'Liquid'},{name:'Green bonds'},{name:'Carbon futures'},{name:'Allocated capital'}],links:[{source:0,target:1,value:values[0]},{source:0,target:2,value:values[1]},{source:0,target:3,value:values[2]},{source:1,target:4,value:values[0]},{source:2,target:4,value:values[1]},{source:3,target:4,value:values[2]}]};
  const layout=sankey<{name:string},{value:number}>().nodeWidth(14).nodePadding(18).extent([[48,8],[295,125]])(data);
  const path=sankeyLinkHorizontal<{name:string},{value:number}>();
  return <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><h2 className="text-sm font-semibold text-slate-100">Treasury flow</h2><svg viewBox="0 0 440 145" className="mt-2 w-full" role="img" aria-label="Treasury capital allocation"><g>{layout.links.map((l,i)=><path key={i} d={path(l)??''} fill="none" stroke={i<3?'#34d399':'#22d3ee'} strokeOpacity={0.2+Math.min(0.6,(l.width??0)/20)} strokeWidth={Math.max(1,l.width??0)}/>)}{layout.nodes.map((n,i)=>{const x0=n.x0??0,x1=n.x1??0,y0=n.y0??0,y1=n.y1??0;return <g key={i}><rect x={x0} y={y0} width={x1-x0} height={Math.max(2,y1-y0)} rx="4" fill={i===3?'#fbbf24':i===4?'#22d3ee':'#475569'}/><text x={i===0?x0-4:x1+4} y={(y0+y1)/2} dominantBaseline="middle" textAnchor={i===0?'end':'start'} fill="#94a3b8" fontSize="9">{n.name}</text></g>;})}</g></svg><p className="text-xs text-slate-500">Projected APY <span className="text-emerald-300">{t?.projected_apy.toFixed(2)??'—'}%</span></p></section>;
}
