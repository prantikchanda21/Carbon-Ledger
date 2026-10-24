import { NextResponse } from 'next/server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(){
 const start=process.cpuUsage(),at=performance.now();await new Promise(resolve=>setTimeout(resolve,100));
 const cpu=process.cpuUsage(start),memory=process.memoryUsage();
 return NextResponse.json({at:new Date().toISOString(),scope:'Serving Node.js process (not your device)',cpuPercent:(cpu.user+cpu.system)/((performance.now()-at)*1000)*100,rssMiB:memory.rss/1048576,heapMiB:memory.heapUsed/1048576,uptimeSec:process.uptime(),cloudConfigured:Boolean(process.env.CLOUD_QAOA_URL&&process.env.CLOUD_QAOA_API_KEY),gpuUtilization:null},{headers:{'Cache-Control':'no-store'}});
}
