import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
export const maxDuration = 60;
export async function POST(request: NextRequest) {
  const endpoint = process.env.CLOUD_QAOA_URL;
  const key = process.env.CLOUD_QAOA_API_KEY;
  if (!endpoint || !key) return NextResponse.json({error:'Cloud compute is not configured. Local QAOA remains available.'},{status:503});
  let body: unknown;
  try { body=await request.json(); } catch {return NextResponse.json({error:'Invalid JSON'},{status:400});}
  if (!body || typeof body !== 'object' || Array.isArray(body))return NextResponse.json({error:'Invalid request'},{status:400});
  const obj=body as Record<string,unknown>;
  if (!Array.isArray(obj.costs)||!Array.isArray(obj.feasible)||obj.costs.length>4096||obj.costs.length<2||obj.feasible.length!==obj.costs.length||
      obj.costs.some(x=>typeof x!=='number'||!Number.isFinite(x))||obj.feasible.some(x=>typeof x!=='boolean')||
      !Number.isInteger(obj.depth)||Number(obj.depth)<1||Number(obj.depth)>8||
      !Number.isInteger(obj.iterations)||Number(obj.iterations)<0||Number(obj.iterations)>120||
      !Number.isInteger(obj.repeats)||Number(obj.repeats)<1||Number(obj.repeats)>16) {
    return NextResponse.json({error:'Invalid or oversized compute request'},{status:400});
  }
  const url=`${endpoint.replace(/\/$/,'')}/compute`;
  try {
    const res=await fetch(url,{method:'POST',headers:{'content-type':'application/json','x-api-key':key},body:JSON.stringify(body),signal:AbortSignal.timeout(55000),cache:'no-store'});
    const text=await res.text();
    if(!res.ok)return NextResponse.json({error:res.status===401?'Cloud worker authentication failed':`Cloud worker returned HTTP ${res.status}`},{status:502});
    return new NextResponse(text,{status:200,headers:{'content-type':'application/json','cache-control':'no-store'}});
  } catch {return NextResponse.json({error:'Cloud worker unavailable or timed out. Use the local worker.'},{status:504});}
}
