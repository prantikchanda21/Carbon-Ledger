import { getRegionalFeed } from '@/lib/feeds/registry';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
export async function GET(request:Request){
 const encoder=new TextEncoder();let timer:ReturnType<typeof setTimeout>|undefined;let closed=false;const started=Date.now();
 const stream=new ReadableStream({start(controller){
  const close=()=>{if(closed)return;closed=true;clearTimeout(timer);try{controller.close();}catch{}};
  request.signal.addEventListener('abort',close,{once:true});
  const push=async()=>{try{const feed=await getRegionalFeed();if(closed)return;controller.enqueue(encoder.encode(`event: telemetry\ndata: ${JSON.stringify({...feed,timestamp:Date.now()})}\n\n`));}catch{close();return;}if(Date.now()-started>48000)close();else if(!closed)timer=setTimeout(push,5000);};void push();
 },cancel(){closed=true;clearTimeout(timer);}});
 return new Response(stream,{headers:{'Content-Type':'text/event-stream','Cache-Control':'no-cache, no-transform'}});
}
