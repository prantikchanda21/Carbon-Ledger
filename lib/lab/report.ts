import { LAB_VERSION, type Experiment } from './types.ts';
import { REGIONS } from '../regions.ts';
import { fingerprint } from './engine.ts';
import { backtest, scoreForecast } from './analytics.ts';
/** Small standalone PDF writer: ASCII text, wrapped lines, automatic pagination, byte-correct xref. */
export function reportPdf(experiment:Experiment):Uint8Array {
  const {input,comparison:c,plan}=experiment;
  const replay=backtest(input); const accuracy=scoreForecast(input.history, input.jobs[0].current);
  const lines=[
    'CARBON & TREASURY | EXPERIMENT REPORT',`Version ${LAB_VERSION} | ${experiment.savedAt}`,input.name,
    `Scenario fingerprint: ${fingerprint(input)} | Seed: ${input.seed}`,`Start: ${input.start} | Horizon: ${input.horizon} hours`,
    'Model: seasonal history forecast + deadline-first greedy scheduling (not a global optimum).',
    `Data: ${input.history.length} hourly snapshots. Sources: ${[...new Set(input.history.flatMap(s=>s.telemetry.map(n=>n.source??'unspecified')))].join(', ')}`,
    'Carbon source labels do not imply live energy prices or latency. Costs are scenario estimates.',
    `Carbon price: USD ${input.carbonPriceUsdT}/tCO2 | SLA: ${input.controls.sla_ms}ms | India only: ${input.controls.dpdp_locked}`,
    '', 'BASELINE VS OPTIMIZED',
    `Baseline cost USD ${c.baseline.totalUsd.toFixed(2)} | Optimized USD ${c.optimized.totalUsd.toFixed(2)}`,
    `Baseline kgCO2 ${c.baseline.carbonKg.toFixed(2)} | Optimized kgCO2 ${c.optimized.carbonKg.toFixed(2)}`,
    c.comparable?`Net saving USD ${c.savingsUsd.toFixed(2)} | Avoided kgCO2 ${c.avoidedKg.toFixed(2)}`:'Savings comparison invalid: not all jobs were served in both plans.',
    `Migration cost USD ${c.optimized.migrationUsd.toFixed(2)} | Energy ${c.optimized.energyKwh.toFixed(2)} kWh`,
    '', 'OPTIMIZED JOBS',
    ...c.optimized.choices.flatMap(v=>[`${v.job}: ${REGIONS[v.region].city}, start +${v.start}h, finish +${v.finish}h`,`  Total USD ${v.totalUsd.toFixed(2)}; energy ${v.energyUsd.toFixed(2)}; carbon ${v.carbonUsd.toFixed(2)}; transfer ${v.transferUsd.toFixed(2)}; downtime ${v.downtimeUsd.toFixed(2)}; CO2 ${(v.carbonKg+v.transferKg).toFixed(2)}kg`]),
    '', 'UNSCHEDULED',...c.optimized.unscheduled.map(u=>`${u.job}: ${u.reason}`),
    '', 'ASSUMPTIONS',JSON.stringify(input.migration),
    'Transfer reserves whole hours; energy is spread uniformly across runtime. No compute rental fees.',
    'Carbon charge is a scenario assumption; no regulatory compliance certification is implied.',
    '', 'HISTORICAL REPLAY',...replay.map(r=>`${r.at}: saving ${r.savingsUsd===null?'not comparable':r.savingsUsd.toFixed(2)} USD, avoided ${r.avoidedKg===null?'not comparable':r.avoidedKg.toFixed(2)} kg, constraint-violation job-hours B/O ${r.baseline.violations}/${r.optimized.violations}`),
    '', `FORECAST ACCURACY (${input.jobs[0].current})`, `Walk-forward MAE: ${accuracy.mae?.toFixed(2)??'insufficient history'} gCO2/kWh; coverage: ${accuracy.coverage===null?'unavailable':(accuracy.coverage*100).toFixed(1)+'%'}; scored ${accuracy.rows.length} observations`,
    '', 'INPUT JOBS',...input.jobs.map(j=>JSON.stringify(j)),
    '', 'CAPACITY',...Object.entries(input.capacity).map(([id,v])=>`${id}: ${v.cpu} CPU, ${v.gpu} GPU`),
    '', 'APPROVAL AUDIT (LOCAL, NOT TAMPER-PROOF)',`Status: ${plan.status}; dry run only`,...plan.audit.map(a=>`${a.at} | ${a.action}: ${a.detail}`),
    '', 'BENCHMARK SNAPSHOT',experiment.benchmark?JSON.stringify(experiment.benchmark):'Not run / not attached.',
    '', 'Reproduce with the companion JSON export containing full telemetry and versioned inputs.'
  ];
  const wrapped=lines.flatMap(s=>{const ascii=s.normalize('NFKD').replace(/[^\x20-\x7E]/g,' ');const chunks=[];for(let i=0;i<ascii.length;i+=95)chunks.push(ascii.slice(i,i+95));return chunks.length?chunks:[''];});
  const pages=[];for(let i=0;i<wrapped.length;i+=48)pages.push(wrapped.slice(i,i+48));
  const objects:string[]=['<< /Type /Catalog /Pages 2 0 R >>','', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  const kids:number[]=[];
  for(let i=0;i<pages.length;i++) {
    const pageId=objects.length+1,streamId=pageId+1;kids.push(pageId);
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${streamId} 0 R >>`);
    const escaped=(s:string)=>s.replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');
    const stream=`BT /F1 10 Tf 40 748 Td 14 TL\n${pages[i].map((l,j)=>`${j?'T* ':''}(${escaped(l)}) Tj`).join('\n')}\nET\nBT /F1 9 Tf 40 30 Td (Page ${i+1} of ${pages.length}) Tj ET`;
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  }
  objects[1]=`<< /Type /Pages /Kids [${kids.map(k=>`${k} 0 R`).join(' ')}] /Count ${pages.length} >>`;
  let pdf='%PDF-1.4\n';const offsets=[0];objects.forEach((o,i)=>{offsets.push(pdf.length);pdf+=`${i+1} 0 obj\n${o}\nendobj\n`;});
  const xref=pdf.length;pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`+offsets.slice(1).map(n=>`${String(n).padStart(10,'0')} 00000 n \n`).join('')+`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}
export function kubernetesPlan(experiment:Experiment,rollback=false):string {
  const input=experiment.input;
  return JSON.stringify({apiVersion:'v1',kind:'List',items:experiment.comparison.optimized.choices.map(c=>{
    const job=input.jobs.find(j=>j.id===c.job)!;
    return {apiVersion:'batch/v1',kind:'Job',metadata:{name:`ct-${job.id}-${fingerprint(input)}${rollback?'-rollback':''}`,annotations:{'carbon-controller/start-at':new Date(Date.parse(input.start)+c.start*3600000).toISOString(),'carbon-controller/mode':'dry-run-export','carbon-controller/rollback-note':rollback?'New job in original region; does not undo completed work':'No automatic execution'}},spec:{suspend:true,backoffLimit:0,template:{spec:{restartPolicy:'Never',nodeSelector:{'topology.kubernetes.io/region':REGIONS[rollback?job.current:c.region].code},containers:[{name:'workload',image:'REPLACE_WITH_YOUR_WORKLOAD_IMAGE',resources:{requests:{cpu:String(job.cpu),...(job.gpu?{'nvidia.com/gpu':String(job.gpu)}:{})},limits:{cpu:String(job.cpu),...(job.gpu?{'nvidia.com/gpu':String(job.gpu)}:{})}}}]}}}};
  })},null,2);
}
