/** One genuine optimization input snapshot per forecast hour. */
export const HOURLY_SCHEDULER_SLOTS:readonly number[]=Object.freeze(Array.from({length:24},(_,hour)=>hour));
export function schedulingHour(hour:number):number {
 if(!Number.isInteger(hour)||hour<0||hour>=24)throw new Error(`Invalid scheduling hour: ${hour}`);
 return hour;
}
/** Bound simultaneous engine calls: 24 hourly requests without a 24-way CPU stampede. */
export async function mapHourlyWithConcurrency<T>(hours:readonly number[],maxConcurrent:number,run:(hour:number)=>Promise<T>):Promise<Record<number,T>> {
 if(!Number.isInteger(maxConcurrent)||maxConcurrent<1)throw Error('Invalid concurrency');
 const output:Record<number,T>={};let next=0;
 await Promise.all(Array.from({length:Math.min(maxConcurrent,hours.length)},async()=>{
  while(next<hours.length){const hour=hours[next++];output[hour]=await run(hour);}
 }));
 return output;
}
