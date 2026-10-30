import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
const read=(p:string)=>readFileSync(p,'utf8');
test('Vercel tracing carries GLPK wasm, ONNX native and model',()=>{
 const c=read('next.config.ts');
 assert.match(c,/node_modules\/glpk\.js\/dist/);
 assert.match(c,/onnxruntime-node\/bin\/napi-v/);
 assert.match(c,/public\/models/);
 assert.ok(existsSync('public/models/quantum_controller.onnx'));
});
test('research sweep has bounded concurrency instead of unbounded Promise.all',()=>{
 const s=read('app/api/sweep/route.ts');
 assert.match(s,/Math\.min\(4, jobs\.length\)/);
 assert.match(s,/maxDuration = 60/);
});
test('deployment probe covers all 5 API engines and rejects GLPK fallback',()=>{
 const s=read('scripts/deploy-smoke.mjs');
 for(const v of ['glpk','oracle','geometry-grover','geometry','geometry-curved']) assert.ok(s.includes(`'${v}'`));
 assert.ok(s.includes('fallbackReason'));
 assert.ok(s.includes('outcome?.weights'));
});
test('Vercel ignores local OS-specific node_modules and build cache',()=>{
 const v=read('.vercelignore');
 assert.match(v,/node_modules\//);
 assert.match(v,/\.next\//);
 const p=JSON.parse(read('package.json'));
 assert.equal(p.engines.node,'22.x');
});
