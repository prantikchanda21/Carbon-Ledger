import test from 'node:test';
import assert from 'node:assert/strict';
import {validateReportNarrative,withReportNarrative} from '../lib/reportNarrative.ts';
import type {ReportData} from '../lib/siteReport.ts';

const source:ReportData={title:'Carbon Ledger scenario',generated:'2026-10-23',introduction:'Modeled 20 region report',sections:[
 {title:'1. Executive summary',explanation:'Current selected engine only',columns:['Metric','Value'],rows:[['Engine','geometry-curved'],['Carbon','250 gCO2/kWh']]},
 {title:'2. Financial impact',explanation:'Modeled revenue and costs',columns:['Metric','USD'],rows:[['Cloud operating','25000 USD/day'],['Gross APY','7%']]}
]};
function example(){return {headline:'Carbon Ledger provides a modeled regional allocation view',executiveSummary:'Summary of selected engine and regional metrics. '.repeat(5),methodology:'Measured values are obtained from frozen report snapshots. '.repeat(4),limitations:'Weather and cloud data are simulated, quantum advantage is not established. '.repeat(3),sections:Array.from({length:8},(_,i)=>({topic:`Topic ${i}`,beginner:'For a newcomer, this is an illustrative assessment, not a real return or production claim. '.repeat(2),professional:'For a professional, compare identical workload assumptions, allocation caps and financial calculation periods. '.repeat(2),evidence:[{source:'1. Executive summary',observation:'The selected engine is geometry-curved.',implication:'The result reflects the chosen solver, not another engine.'}],recommendations:[{priority:'High',action:'Verify deployment under controlled inputs',reason:'Ensure exact engine outputs can be reproduced independently.'}]})),glossary:Array.from({length:8},(_,i)=>({term:`Term ${i}`,meaning:'An example term used to explain the optimization context.'}))};}
test('detailed Groq response builds extensive tabular sections while preserving all source rows',()=>{
 const valid=validateReportNarrative(example(),source);assert.ok(valid);
 const out=withReportNarrative(source,valid!,{focus:'comprehensive',audience:'dual'});
 assert.ok(out.sections.length>=27);
 assert.deepEqual(out.sections.slice(-source.sections.length),source.sections);
 assert.equal(out.sections[1]!.rows[1]?.[0],'Professional / technical assessment');
 assert.ok(out.sections.some(x=>x.title.includes('source-linked evidence')));
});
test('untrusted evidence citations are dropped rather than being advertised as facts',()=>{
 const exampleReport=example();exampleReport.sections[0]!.evidence=[{source:'Invented GLPK test',observation:'GLPK beat by 55%',implication:'Unsupported advantage'}];
 assert.equal(validateReportNarrative(exampleReport,source),null);
});
test('invalid or too-short AI analysis is never passed off as detailed',()=>{
 const response=example();response.sections[1]!.professional='Very short';
 assert.equal(validateReportNarrative(response,source),null);
});
test('beginner report omits technical prose but includes quantitative source tables',()=>{
 const valid=validateReportNarrative(example(),source)!;
 const beginner=withReportNarrative(source,valid,{focus:'financial',audience:'beginner'});
 assert.equal(beginner.sections[1]!.rows.length,1);
 assert.deepEqual(beginner.sections.at(-1),source.sections[1]);
});
