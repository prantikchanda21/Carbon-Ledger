/** Offline-safe release preflight. With --installed, also checks installed npm modules. */
import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
const cwd=process.cwd(), require=createRequire(import.meta.url);
const failures=[], warnings=[];
const check=(cond,ok,fail)=>cond?console.log('PASS',ok):(failures.push(fail??ok),console.error('FAIL',fail??ok));
const read=(name)=>readFileSync(resolve(cwd,name),'utf8');
const p=JSON.parse(read('package.json')),lock=JSON.parse(read('package-lock.json'));
check(p.name===lock.name && p.version===lock.version,'Package and lockfile metadata match');
check(JSON.stringify(p.dependencies)===JSON.stringify(lock.packages[''].dependencies),'Dependency specs match lockfile');
check(JSON.stringify(p.devDependencies)===JSON.stringify(lock.packages[''].devDependencies),'Development specs match lockfile');
check(p.engines.node==='22.x','Node.js 22 runtime pinned');
check(existsSync('public/models/quantum_controller.onnx') && statSync('public/models/quantum_controller.onnx').size>10000,'ONNX model asset exists');
const config=read('next.config.ts');
check(config.includes('serverExternalPackages')&&config.includes("'glpk.js'")&&config.includes("'onnxruntime-node'"),'GLPK and ONNX declared server-side external packages');
check(config.includes('node_modules/glpk.js/dist')&&config.includes('node_modules/onnxruntime-node/bin')&&config.includes('public/models'),'Vercel file tracing includes runtime assets');
const v=JSON.parse(read('vercel.json'));
check(v.framework==='nextjs'&&v.installCommand.includes('npm ci'),'Vercel installs locked dependencies');
for(const route of ['cooperative-allocation','quantum-lab-live','onnx-controller','health','sweep']){
 const file=`app/api/${route}/route.ts`;
 check(existsSync(file)&&read(file).includes("runtime")&&read(file).includes("'nodejs'"),`${route} uses the Node.js runtime`);
}
const modes=read('lib/quantumEngineModes.ts');
for(const key of ['glpk','oracle','geometry-curved','geometry-grover','geometry']) check(modes.includes(`'${key}'`),`Active engine ${key} is declared`);
check(read('.gitignore').includes('node_modules'),'node_modules excluded from Git');
check(!existsSync('.env.local'),'No .env.local secrets in project');
if(process.argv.includes('--installed')){
 for(const name of ['next','react','typescript','glpk.js','onnxruntime-node']){
  try{const dest=require.resolve(`${name}/package.json`,{paths:[cwd]});check(Boolean(dest),`Installed dependency ${name}`);}
  catch(e){try{check(Boolean(require.resolve(name,{paths:[cwd]})),`Installed dependency ${name}`);}catch{check(false,`Installed dependency ${name}`,`Missing ${name}: run npm ci --include=optional`);}}
 }
}else warnings.push('Dependency installation and production build NOT tested. Run npm ci and npm run verify:deploy on a networked machine.');
for(const w of warnings)console.warn('WARN',w);
console.log(`\nDeployment preflight: ${failures.length?'FAILED':'PASSED'} (${failures.length} failures)`);
if(failures.length)process.exitCode=1;
