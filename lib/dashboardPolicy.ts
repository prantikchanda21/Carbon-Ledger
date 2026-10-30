import {useEffect,useState} from 'react';
import {REGION_ORDER} from './regions.ts';
export const POLICY_KEY='carbon-dashboard-policy-v166';
export type DashboardPolicy={weather?:{factors:Record<string,number>;hour:number;at:string};scheduler?:{weights:Record<string,number>;at:string;label:string}};
export function parsePolicy(raw:string|null):DashboardPolicy{
 try {const x=JSON.parse(raw??'{}');const out:DashboardPolicy={};
 if(x?.weather&&x.weather.factors&&typeof x.weather.factors==='object'&&Number.isInteger(x.weather.hour)&&x.weather.hour>=0&&x.weather.hour<=23&&Object.values(x.weather.factors??{}).every(v=>typeof v==='number'&&Number.isFinite(v)&&v>=.88&&v<=1.12))out.weather=x.weather;
 if(x?.scheduler&&REGION_ORDER.every(id=>Number.isFinite(x.scheduler.weights?.[id])&&x.scheduler.weights[id]>=0)&&Math.abs(REGION_ORDER.reduce((s,id)=>s+x.scheduler.weights[id],0)-1)<1e-5)out.scheduler=x.scheduler;
 return out;}catch{return {};}
}
export function updateDashboardPolicy(patch:Partial<DashboardPolicy>){const previous=parsePolicy(localStorage.getItem(POLICY_KEY));const next={...previous,...patch};const signature=(x:DashboardPolicy)=>JSON.stringify({weather:x.weather?{hour:x.weather.hour,factors:x.weather.factors}:null,scheduler:x.scheduler?{weights:x.scheduler.weights,label:x.scheduler.label}:null});if(signature(previous)===signature(next))return;localStorage.setItem(POLICY_KEY,JSON.stringify(next));window.dispatchEvent(new Event(POLICY_KEY));}
export function useDashboardPolicy(){const [policy,setPolicy]=useState<DashboardPolicy>({});useEffect(()=>{const read=()=>setPolicy(parsePolicy(localStorage.getItem(POLICY_KEY)));read();window.addEventListener(POLICY_KEY,read);window.addEventListener('storage',read);return()=>{window.removeEventListener(POLICY_KEY,read);window.removeEventListener('storage',read);};},[]);return policy;}
