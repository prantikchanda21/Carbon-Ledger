import {NextResponse} from 'next/server';
export const runtime='nodejs';
export function GET(){return NextResponse.json({available:true,mode:'statevector-simulator',backend:'TypeScript CPU statevector',hardware:false,queued_jobs:false});}
export function POST(){return NextResponse.json({status:'error',error:'The bounded simulator completes synchronously. Use the offline hardware CLI to poll hardware jobs.'},{status:400});}
