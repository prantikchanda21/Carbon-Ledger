/** Tests real deployed API endpoints. Usage: npm run deploy:smoke -- https://your-site.vercel.app */
const target=process.argv.slice(2).find(v=>/^https?:\/\//.test(v));
if(!target){console.error('Usage: npm run deploy:smoke -- https://YOUR-DEPLOYMENT.vercel.app');process.exit(2);}
const base=target.replace(/\/$/,'');
const names=['glpk','oracle','geometry-grover','geometry','geometry-curved'];
let bad=0;
async function call(path,body){
 const res=await fetch(`${base}${path}`,{method:body?'POST':'GET',headers:body?{'content-type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(60000),cache:'no-store'});
 const data=await res.json().catch(()=>({error:'Non-JSON response'}));
 if(!res.ok)throw Error(`HTTP ${res.status}: ${JSON.stringify(data).slice(0,400)}`);
 return data;
}
console.log(`Testing ${base} against five current engines`);
try{const h=await call('/api/health');if(h.glpk?.available!==true||h.glpk?.lp_solved!==true){bad++;console.error('FAIL GLPK health',h.glpk);}else console.log('PASS GLPK health');if(h.onnx?.model_found!==true){bad++;console.error('FAIL ONNX model missing',h.onnx);}else console.log('PASS ONNX model packaged (native inference is tested separately)');}
catch(e){bad++;console.error('FAIL health',e.message);}
if(process.argv.includes('--onnx')){
 try{
  const result=await call('/api/onnx-controller',{sla_ms:78,carbon_tax:.5,treasury_yield:6.8,budget_cr:249,dpdp_locked:false});
  if(result.engine!=='onnx' || !result.allocations?.node_weights || result.fallback_reason)throw Error(`Native ONNX did not execute: engine=${result.engine}, fallback=${result.fallback_reason}`);
  console.log('PASS ONNX model inference (native runtime loaded)');
 }catch(e){bad++;console.error('FAIL ONNX inference:',e.message);}
}
for(const engine of names){
 try{
  const t=performance.now();const result=await call('/api/quantum-lab-live',{engine,sla:78,carbon:.5,budget:30,hour:12});
  const weights=result?.outcome?.weights;
  if(result.engineUsed!==engine || !Array.isArray(weights)||weights.length!==20||weights.some(v=>typeof v!=='number'||!Number.isFinite(v)||v<-1e-8)||Math.abs(weights.reduce((a,b)=>a+b,0)-1)>1e-5||result?.outcome?.feasible!==true||result?.fallbackReason){throw Error(`Invalid allocation or unexpected fallback; engineUsed=${result.engineUsed}`);}
  if(!result.kpis?.approved || Object.values(result.kpis.approved).filter(v=>typeof v==='number').some(v=>!Number.isFinite(v)))throw Error('Missing/invalid KPI values');
  console.log(`PASS ${engine}: 20 allocations, no fallback, ${Math.round(performance.now()-t)} ms HTTP roundtrip`);
 }catch(e){bad++;console.error(`FAIL ${engine}: ${e.message}`);}
}
console.log(bad?`\nDEPLOYMENT SMOKE FAILED (${bad} issues)`:'\nDEPLOYMENT SMOKE PASSED');
if(bad)process.exitCode=1;
