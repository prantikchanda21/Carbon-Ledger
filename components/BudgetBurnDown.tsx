'use client';
import {Area,AreaChart,ResponsiveContainer,XAxis,YAxis} from 'recharts';
import {dollars} from '@/lib/budgetUsd';
import {FLEET_MWH_PER_DAY,OFFSET_PRICE_USD_PER_TONNE,OFFSET_CAPITAL_RESERVE_FRACTION} from '@/lib/constants';
/** Modeled offset expense, NOT a burn of the entire invested treasury capital. */
export default function BudgetBurnDown({budgetUsd,offsetPct,carbonTax=0.5,blendedCi=400}:{budgetUsd:number;offsetPct:number;carbonTax?:number;blendedCi?:number}){
 const grossTonnes=blendedCi*FLEET_MWH_PER_DAY/1000;
 const modeledPricePerTonne=OFFSET_PRICE_USD_PER_TONNE; // illustrative assumption, not a live market quote
 const dailyOffsetSpend=grossTonnes*Math.max(0,Math.min(100,offsetPct))/100*modeledPricePerTonne;
 const annualOffsetProvision=budgetUsd*OFFSET_CAPITAL_RESERVE_FRACTION;
 const data=Array.from({length:30},(_,i)=>({day:i+1,remaining:Math.max(0,annualOffsetProvision-(i+1)*dailyOffsetSpend)}));
 return <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><div className="flex items-center justify-between gap-2"><h2 className="text-sm font-semibold">Modeled carbon-offset allowance</h2><span className="text-xs text-slate-500">30-day view · {dollars(annualOffsetProvision)} annual allowance</span></div><p className="mt-1 text-[11px] text-slate-400">Modeled daily offset expenditure: {dollars(dailyOffsetSpend)} · carbon weight {carbonTax.toFixed(2)} · {`$${modeledPricePerTonne}/tCO₂`} illustrative price. Annual treasury capital: {dollars(budgetUsd)}.</p><div className="mt-2 h-28"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data}><XAxis dataKey="day" hide/><YAxis hide domain={[0,Math.max(1,annualOffsetProvision)]}/><Area type="monotone" dataKey="remaining" stroke="#34d399" fill="#34d399" fillOpacity={0.08} isAnimationActive={false}/></AreaChart></ResponsiveContainer></div></section>;
}
