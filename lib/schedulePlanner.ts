import {REGION_ORDER,REGIONS} from './regions.ts';
import {schedulingHour} from './schedulerHours.ts';
import type {WeatherResponse} from './weather/insights';
export type Job={id:string;name:string;duration:number;earliest:number;deadline:number;demand:number;residency:'any'|'india'|'europe'|'americas'|'asia'};
export type EngineResult={engineRequested:string;engineUsed?:string;regions:{id:string;eligible:boolean;carbon:number;price:number;latency:number}[];researchProposal?:{weights:number[];feasible:boolean};outcome:{weights:number[]};timing?:{serverComputeMs:number};runAt?:string};
type Plan={id:string;name:string;region:string;start:number;end:number;demand:number;carbon:number;cost:number;latency:number;score:number;weight:number;temp:number|null};
export type Schedule={jobs:Plan[];unscheduled:{id:string;name:string;reason:string}[];runtimeMs:number;forecastAt:string;completedAt:string;engine:string};
const regions=REGION_ORDER;
const clamp=(n:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,n));
function residencyOK(job:Job,id:string){if(job.residency==='any')return true;if(job.residency==='india')return ['mumbai','hyderabad','delhi'].includes(id);if(job.residency==='europe')return REGIONS[id as keyof typeof REGIONS].macro==='europe';if(job.residency==='asia')return REGIONS[id as keyof typeof REGIONS].macro==='asia';return ['virginia','oregon','iowa','toronto','sao_paulo'].includes(id);}
export function scheduleJobs(jobs:Job[],weather:WeatherResponse,solves:Record<number,EngineResult>,carbonWeight:number,engine:string):Schedule{
 const occupied=new Map<string,number>(); const output:Plan[]=[];const unscheduled:Schedule['unscheduled']=[];
 // EDF and largest-demand-first for deterministic, reproducible time/region assignment.
 const sorted=[...jobs].sort((a,b)=>a.deadline-b.deadline||b.demand-a.demand||a.id.localeCompare(b.id));
 for(const job of sorted){let best:Plan|null=null;
  for(let h=job.earliest;h+job.duration<=Math.min(24,job.deadline);h++){
   const slotRuns=Array.from({length:job.duration},(_,k)=>solves[schedulingHour(h+k)]);
   if(slotRuns.some(run=>!run))continue;
   for(let i=0;i<regions.length;i++){const id=regions[i];if(!residencyOK(job,id))continue;
    const hourlyRegions=slotRuns.map(run=>run.regions.find(n=>n.id===id));
    if(hourlyRegions.some(r=>!r?.eligible))continue;
    // Placement preferences are sampled for EVERY hour of the job, not just its start.
    const weights=slotRuns.map(run=>{
     const allocation=run.researchProposal?.feasible?run.researchProposal.weights:run.outcome.weights;
     return clamp(Number(allocation[i]??0),0,1);
    });
    const w=weights.reduce((sum,x)=>sum+x,0)/weights.length;
    if(w<0.00001)continue;
    // Modeled region capacity: 100 demand units per hour.
    let room=true;for(let t=h;t<h+job.duration;t++){if((occupied.get(`${id}:${t}`)||0)+job.demand>100){room=false;break;}}if(!room)continue;
    const wr=weather.regions.find(x=>x.id===id);
    const hours=Array.from({length:job.duration},(_,k)=>wr?.hours[h+k]);
    if(hours.some(x=>!x||!Number.isFinite(x.temperatureC)))continue;
    const temps=hours.map(x=>x!.temperatureC!);
    const meanTemp=temps.reduce((a,b)=>a+b,0)/temps.length;
    // API already includes weather-adjusted regional prices. Do not apply cooling twice.
    const hourlyCosts=slotRuns.map((_,k)=>hourlyRegions[k]!.price);
    const price=hourlyCosts.reduce((a,b)=>a+b,0)/hourlyCosts.length;
    const carbonPerHour=hourlyRegions.reduce((a,b)=>a+b!.carbon,0)/hourlyRegions.length;
    const latency=hourlyRegions.reduce((a,b)=>a+b!.latency,0)/hourlyRegions.length;
    const cost=job.demand*job.duration*price/100;
    const carbon=job.demand*job.duration*carbonPerHour/1000;
    const score=(carbonWeight*(carbon/Math.max(.1,job.demand*job.duration))+(1-carbonWeight)*(cost/Math.max(.1,job.demand*job.duration)))*10+latency/1000+(.12*(1-w));
    if(!best||score<best.score-1e-9||(Math.abs(score-best.score)<1e-9&&(h<best.start||h===best.start&&id<best.region)))best={id:job.id,name:job.name,region:id,start:h,end:h+job.duration,demand:job.demand,carbon,cost,latency,score,weight:w,temp:meanTemp};
   }
  }
  if(!best)unscheduled.push({id:job.id,name:job.name,reason:'No feasible engine-selected region/time window under deadline, residency, forecast, and modeled capacity constraints'});
  else {output.push(best);for(let t=best.start;t<best.end;t++)occupied.set(`${best.region}:${t}`,(occupied.get(`${best.region}:${t}`)||0)+job.demand);}
 }
 return {jobs:output,unscheduled,runtimeMs:Object.values(solves).reduce((s,r)=>s+(r.timing?.serverComputeMs||0),0),forecastAt:weather.retrievedAt,completedAt:new Date().toISOString(),engine};
}
