import {NextResponse} from 'next/server';
import {placementQaoa} from '@/lib/quantum-v8/placement';
import type {QuantumOptimizationRequest} from '@/lib/quantumClient';
export const runtime='nodejs';
export const maxDuration=10;
const cache=new Map<string,{at:number;value:ReturnType<typeof placementQaoa>}>();
export async function POST(request:Request){
 try{const text=await request.text();if(text.length>24000)return NextResponse.json({error:'Request too large'},{status:413});const payload=JSON.parse(text) as QuantumOptimizationRequest;
 const key=JSON.stringify(payload);const hit=cache.get(key);if(hit&&Date.now()-hit.at<60000)return NextResponse.json({...hit.value,cached:true});
 const value=placementQaoa(payload);cache.set(key,{at:Date.now(),value});if(cache.size>32)cache.delete(cache.keys().next().value!);
 return NextResponse.json(value,{headers:{'cache-control':'no-store'}});
 }catch(error){return NextResponse.json({status:'error',error:error instanceof Error?error.message:'Invalid quantum request'},{status:400});}
}
