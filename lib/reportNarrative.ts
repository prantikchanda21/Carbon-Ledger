import type {ReportData, ReportSection} from './siteReport';

export type ReportFocus = 'comprehensive'|'financial'|'quantum'|'sustainability'|'operations';
export type ReportAudience = 'dual'|'beginner'|'professional';
export type ReportOptions = {focus:ReportFocus; audience:ReportAudience};
export type AnalysisSection = {
  topic:string; beginner:string; professional:string;
  evidence:Array<{source:string; observation:string; implication:string}>;
  recommendations:Array<{priority:string; action:string; reason:string}>;
};
export type ReportNarrative = {
  headline:string; executiveSummary:string; methodology:string; limitations:string;
  sections:AnalysisSection[];
  glossary:Array<{term:string; meaning:string}>;
};

const clean=(s:unknown,max=4000):string=>typeof s==='string'?s.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,'').trim().slice(0,max):'';
const canon=(s:string)=>s.toLowerCase().trim().replace(/\s+/g,' ');
const known=(value:unknown, list:string[])=>list.some(x=>canon(x)===canon(String(value)));

/** Validate model output as untrusted material. Provider prose never replaces any source metrics. */
export function validateReportNarrative(raw:unknown,report:ReportData):ReportNarrative|null {
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
 const r=raw as Record<string,unknown>;
 if(!Array.isArray(r.sections)||r.sections.length<7||r.sections.length>11||!Array.isArray(r.glossary))return null;
 const sections:AnalysisSection[]=[];
 const titles=report.sections.map(s=>s.title);
 for(const entry of r.sections){
  if(!entry||typeof entry!=='object'||Array.isArray(entry))return null;
  const e=entry as Record<string,unknown>;
  const topic=clean(e.topic,100),beginner=clean(e.beginner,2800),professional=clean(e.professional,2800);
  if(topic.length<3||beginner.length<90||professional.length<90||!Array.isArray(e.evidence)||!Array.isArray(e.recommendations))return null;
  const evidence= e.evidence.slice(0,5).flatMap((value:unknown)=>{
   if(!value||typeof value!=='object')return [];
   const v=value as Record<string,unknown>;
   const source=clean(v.source,140),observation=clean(v.observation,500),implication=clean(v.implication,700);
   // Never include a fabricated citation to a report section.
   return known(source,titles)&&observation.length>=10&&implication.length>=10?[{source,observation,implication}]:[];
  });
  const recommendations=e.recommendations.slice(0,4).flatMap((value:unknown)=>{
   if(!value||typeof value!=='object')return [];
   const v=value as Record<string,unknown>;
   const priority=clean(v.priority,30),action=clean(v.action,350),reason=clean(v.reason,550);
   return action.length>=12&&reason.length>=12?[{priority,action,reason}]:[];
  });
  if(!evidence.length||!recommendations.length)return null;
  sections.push({topic,beginner,professional,evidence,recommendations});
 }
 const glossary=r.glossary.slice(0,14).flatMap((x:unknown)=>{
  if(!x||typeof x!=='object')return [];
  const v=x as Record<string,unknown>,term=clean(v.term,80),meaning=clean(v.meaning,340);
  return term&&meaning?[{term,meaning}]:[];
 });
 const headline=clean(r.headline,180),executiveSummary=clean(r.executiveSummary,2800),methodology=clean(r.methodology,2600),limitations=clean(r.limitations,2600);
 if(headline.length<12||executiveSummary.length<120||methodology.length<100||limitations.length<100||glossary.length<5)return null;
 return {headline,executiveSummary,methodology,limitations,sections,glossary};
}

/** Retains every original numeric row; model observations are explicitly labeled commentary. */
export function withReportNarrative(report:ReportData, n:ReportNarrative, options:ReportOptions):ReportData {
 const sections:ReportSection[]=[];
 const add=(title:string,explanation:string,columns:string[],rows:string[][])=>sections.push({title,explanation,columns,rows});
 add('AI 01 | Executive briefing',n.headline+' | Groq commentary based on the supplied scenario snapshot; verified source tables follow unchanged.', ['Perspective','Detailed finding'],[
  ['Executive interpretation',n.executiveSummary],['Methods and scope',n.methodology],['Limitations and evidence quality',n.limitations]
 ]);
 for(const [i,s] of n.sections.entries()){
  const prefix=`AI ${String(i+2).padStart(2,'0')} | ${s.topic}`;
  const proseRows:string[][]=[];
  if(options.audience!=='professional')proseRows.push(['Beginner explanation',s.beginner]);
  if(options.audience!=='beginner')proseRows.push(['Professional / technical assessment',s.professional]);
  add(prefix,'Interpretations are AI-authored, not independent measurements. Specific evidence and recommended next steps are documented immediately below.', ['Perspective','Analysis'],proseRows);
  add(`${prefix} — source-linked evidence`,'Only source section names that exist in the current snapshot are accepted; observations and implications are model commentary.', ['Source section','Observed finding','What it means'],s.evidence.map(e=>[e.source,e.observation,e.implication]));
  add(`${prefix} — next actions`,'Suggested investigations and controls; these actions have not been executed.', ['Priority','Recommendation','Reason'],s.recommendations.map(a=>[a.priority,a.action,a.reason]));
 }
 add('AI | Technical glossary','Definitions for newcomers; specific coefficients, methods and provenance must be confirmed from the source tables.', ['Term','Explanation'],n.glossary.map(x=>[x.term,x.meaning]));
 add('Source data / audit index','The source data below is identical to the collected browser report, with no numerical changes from Groq. Empty and missing values should not be interpreted as zero.', ['Original section','Columns','Number of source rows'],report.sections.map(s=>[s.title,s.columns.join(', '),String(s.rows.length)]));
 return {...report,introduction:`${report.introduction} | AI focus: ${options.focus}; audience: ${options.audience}. All numerical source tables are unmodified.`,sections:[...sections,...report.sections]};
}
export async function enhanceReport(report:ReportData,options:ReportOptions={focus:'comprehensive',audience:'dual'}):Promise<{report:ReportData;source:'groq'|'local';reason?:string}> {
 try {
  const response=await fetch('/api/report-narrative',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({report,options}),cache:'no-store',signal:AbortSignal.timeout(57000)});
  if(!response.ok)return {report,source:'local',reason:`HTTP ${response.status}`};
  const data=await response.json() as {source?:string;narrative?:ReportNarrative;reason?:string};
  if(data.source!=='groq')return {report,source:'local',reason:data.reason||'provider-unavailable'};
  const narrative=validateReportNarrative(data.narrative,report);
  if(!narrative)return {report,source:'local',reason:'invalid-structured-report'};
  return {report:withReportNarrative(report,narrative,options),source:'groq'};
 }catch(e){return {report,source:'local',reason:e instanceof Error?e.message:'network-error'};}
}
