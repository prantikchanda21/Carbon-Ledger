import {collectSiteReport, type ReportData, type ReportSection} from './siteReport';
import {listExperiments} from './lab/persistence';
import {readQuantumExecution} from './quantumExecutionPreferences';
import {activeEngineStudies} from './engineCatalog';
import {WEATHER_DASHBOARD_SNAPSHOT_KEY} from './weatherDashboardSync';

type Obj=Record<string,unknown>;
const show=(v:unknown):string=> v===undefined||v===null?'Not available':typeof v==='number'&&!Number.isFinite(v)?'Not available':typeof v==='object'?(JSON.stringify(v) || "Not available").slice(0,400):String(v);
const asObj=(v:unknown):Obj=>v&&typeof v==='object'&&!Array.isArray(v)?v as Obj:{};
const get=(v:unknown,path:string)=>path.split('.').reduce<unknown>((o,k)=>Array.isArray(o)?o[Number(k)]:asObj(o)[k],v);
const metric=(v:unknown,path:string)=>show(get(v,path));
const sec=(title:string,explanation:string,columns:string[],rows:string[][]):ReportSection=>({title,explanation,columns,rows:rows.length?rows:[['No recorded data','Run this feature to generate real measurements']].map(r=>r.slice(0,columns.length))});
async function jsonAsset(url:string):Promise<unknown>{try{const res=await fetch(url,{cache:'no-store'});return res.ok?await res.json():null;}catch{return null;}}
const local=(key:string):unknown=>{try{return JSON.parse(localStorage.getItem(key)||'null');}catch{return null;}};
const session=(key:string):unknown=>{try{return JSON.parse(localStorage.getItem(key)||'null');}catch{return null;}};

/** Collect independently saved reports from dashboard, planning tools and quantum lab. No generated numbers or fabricated runs. */
export async function collectUnifiedReport():Promise<ReportData>{
 const base=collectSiteReport();const sections=base.sections.slice();
 sections.push(sec('12. Export coverage and data provenance','The report contains available saved measurements, not a scrape of invisible tabs. Unsaved or server-only results are marked unavailable. All timestamps and source labels should be read with the measurements.', ['Workspace','Captured source','Coverage'],[
 ['Main Dashboard','Current Zustand state plus locally stored cooperative/forecast runs','Current regional telemetry, allocations, controls and completed saved hybrid runs'],
 ['Planning tools','Saved experiments in IndexedDB and latest locally captured workspace snapshot','Plans, scenario settings, benchmark records and forecast accuracy where recorded'],
 ['Quantum Lab','Bundled benchmark/risk JSON and saved research evidence','Recorded quantum methods, depths, trial metrics, Pareto results and risk evaluations'],
 ['Hardware/System','Browser preferences and published metadata','Configured limits, not proof that the cloud/hardware used them']
 ]));
 const prefs=readQuantumExecution();
 sections.push(sec('13. Quantum execution settings','These are UI configuration preferences. The quantum optimizer may use fewer qubits, and a preference does not establish real quantum hardware execution.', ['Preference','Configured value'],Object.entries(prefs).map(([key,value])=>[key,show(value)])));
 let experiments:unknown[]=[];let experimentError='';
 try{experiments=await listExperiments();}catch(e){experimentError=e instanceof Error?e.message:String(e);}
 sections.push(sec('14. Saved Planning tools runs','Saved experiments persist in this browser through IndexedDB. Experiments never saved or saved on another device cannot be recovered automatically.', ['Experiment','Saved UTC','Jobs','Status','Algorithm','Objective / cost'],experiments.length?experiments.map((e,i)=>[metric(e,'input.name')||`Experiment ${i+1}`,metric(e,'savedAt'),show((get(e,'input.jobs') as unknown[]|undefined)?.length),metric(e,'plan.status'),metric(e,'benchmark.decisionEngine.algorithm'),metric(e,'comparison.optimized.cost')]):[['No saved experiment',experimentError||'No records in this browser','—','—','—','—']]));
 for(const [i,e] of experiments.slice(0,20).entries()){
  const obj=asObj(e);const input=asObj(obj.input);const controls=asObj(input.controls);const benchmark=asObj(obj.benchmark);
  sections.push(sec(`15.${i+1} Experiment: ${show(input.name)}`,'Recorded experiment details. The derived costs and comparisons belong to the saved scenario, not necessarily the current dashboard state.', ['Field','Recorded value'],[
   ['Experiment ID',show(obj.id)],['Scenario seed',show(input.seed)],['Scenario start',show(input.start)],['Forecast horizon',show(input.horizon)],['Jobs',show((input.jobs as unknown[]|undefined)?.length)],['Input regions',show((input.history as unknown[]|undefined)?.length)+' history time points'],
   ...Object.entries(controls).slice(0,16).map(([k,v])=>[`Control: ${k}`,show(v)]),
   ['Decision engine',metric(benchmark,'decisionEngine.algorithm')],['Decision status',metric(benchmark,'decisionEngine.status')],['Treasury result',show(benchmark.treasury)],['Benchmark results',show(benchmark.placement)],
   ['Reference objective',metric(obj,'comparison.baseline.cost')],['Optimized objective',metric(obj,'comparison.optimized.cost')]
  ]));
 }
 const workspace=asObj(session('carbon-ledger-unified-workspace-v1'));
 sections.push(sec('16. Current Planning tools snapshot','The currently explored scenario is captured when the Planning tools is open. This is separate from saved runs; the latest same-origin tool snapshot is shared across browser tabs.', ['Metric','Value'],[
  ['Scenario',show(workspace.name)],['Recorded at',show(workspace.at)],['Active tab',show(workspace.tab)],['Forecast region',show(workspace.region)],['Forecast model',show(workspace.forecastModel)],['Walk-forward MAE',show(workspace.forecastMAE)],['Forecast coverage',show(workspace.forecastCoverage)],['Sample count',show(workspace.forecastSamples)],['Quantum algorithm',show(workspace.quantumAlgorithm)],['Quantum status',show(workspace.quantumStatus)],['Benchmark snapshot',show(workspace.benchmark)],['Treasury scenario',show(workspace.treasury)],['Plan status',show(workspace.planStatus)]
 ]));
 const evidence=local('carbon-research-evidence');const items=Array.isArray(evidence)?evidence.slice(-8):[];
 sections.push(sec('17. Quantum Research Studio run registry','Up to eight locally saved research experiments; these measurements were produced by recorded tests, not the report generator.', ['Run','Date','Depth','Qubits','Repeats','QAOA cost','Exact reference','Runtime ms'],items.length?items.map((e:unknown)=>[metric(e,'id'),metric(e,'at'),metric(e,'options.depth'),metric(e,'options.maxQubits'),metric(e,'repeats'),metric(e,'runs.0.qaoa.cost'),metric(e,'runs.0.exact.cost'),metric(e,'wallMs')]):[['Not run','—','—','—','—','—','—','—']]));
 const [rawQuantum,rawRisk]=await Promise.all([jsonAsset('/data/quantum-lab-v8.json'),jsonAsset('/data/quantum-risk-v8.json')]);
 const q=asObj(rawQuantum),risk=asObj(rawRisk);
 sections.push(sec('18. Quantum Lab benchmark provenance','Bundled quantum benchmark data can be offline/illustrative; it must not be confused with a fresh cloud or hardware execution.', ['Field','Value'],[
 ['Scenarios',show(q.scenarios)],['Budget',show(q.budget)],['Synthetic dataset flag',show(q.synthetic)],['Checksum',show(q.sha256)],['Benchmark summary entries',show((q.summary as unknown[]|undefined)?.length)],['Stored runs',show((q.runs as unknown[]|undefined)?.length)],['Pareto trade-off entries',show((q.pareto as unknown[]|undefined)?.length)]
 ]));
 const summaries=Array.isArray(q.summary)?q.summary:[];
 sections.push(sec('19. QAOA, VQE and baseline benchmark summary','A method with lower cost may also have different feasibility, wall time or sample quality. Read each benchmark in its original experimental context.', ['Method','Depth','Feasible probability','Optimal probability','Cost gap %','Mean wall ms','Trials'],summaries.length?summaries.map(x=>[metric(x,'model'),metric(x,'depth'),metric(x,'feasible_probability.mean'),metric(x,'optimum_probability.mean'),metric(x,'gap_pct.mean'),metric(x,'wall_ms.mean'),metric(x,'trials')]):[['Unavailable','—','—','—','—','—','—']]));
 const runs=Array.isArray(q.runs)?q.runs:[];
 sections.push(sec('20. Per-run quantum measurements','The best feasible sampled solution is an observation from the stored experimental run, not a guaranteed global optimum.', ['Scenario','Model','Qubits','Depth','Feasible probability','Gap %','Best sampled objective','Exact objective'],runs.length?runs.map(x=>[metric(x,'scenario'),metric(x,'model'),metric(x,'qubits'),metric(x,'depth'),metric(x,'feasible_probability'),metric(x,'gap_pct'),metric(x,'best_sampled_cost'),metric(x,'exact_cost')]):[['Unavailable','—','—','—','—','—','—','—']]));
 const pareto=Array.isArray(q.pareto)?q.pareto:[];
 sections.push(sec('21. Quantum Lab carbon-cost Pareto comparisons','Each row is a separate carbon weight, comparing recorded reference and sampled quantum points.', ['Carbon weight','Reference cost','Reference carbon','Quantum cost','Quantum carbon'],pareto.length?pareto.map(x=>[metric(x,'carbon_weight'),metric(x,'exact.cost'),metric(x,'exact.carbon'),metric(x,'quantum.cost'),metric(x,'quantum.carbon')]):[['Unavailable','—','—','—','—']]));
 sections.push(sec('22. Risk and VQC research','These are stored risk-study measurements, not guaranteed predictions of real-world incidents.', ['Model','Metrics / details'],Array.isArray(risk.rows)&&risk.rows.length?risk.rows.map(x=>[metric(x,'model'),show({accuracy:get(x,'accuracy'),metrics:get(x,'metrics'),confusion:get(x,'confusion')})]):[['Unavailable','No bundled risk report available']]));
 sections.push(sec('23. Coverage limitations and reproducibility','Exported data is a snapshot of sources available to this browser. Hidden, unsaved, remote and device-specific data is not collected without access.', ['Topic','Explanation'],[
 ['Unsaved Quantum Lab UI interactions','Selections and unsaved slider values are not persisted across pages and are therefore not present.'],
 ['Browser isolation','An experiment saved on another device/browser is not automatically accessible.'],
 ['Remote cloud execution','Cloud Run history is not exported unless its results are saved into an accessible report source.'],
 ['Benchmark comparisons','Verify identical objective functions and constraints before claiming quantum advantage.'],
 ['AI narrative','Groq can explain the measurements but is not allowed to replace numeric result tables.'],
 ['Zero versus unavailable','An absent measurement is labeled unavailable rather than zero.']
 ]));
 const money=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)?`$${v.toLocaleString('en-US',{maximumFractionDigits:2})}`:'Not available';
 sections.push(sec('24. Five active engines - recorded common-scenario comparison','The 200-case benchmark summary was recorded in an earlier Windows CMD run; it is historical, synthetic, rounded evidence, NOT a fresh run or a hardware quantum-speedup claim. Classical fallback counts must not be interpreted as independent quantum successes.', ['Engine','Objective gap %','Median ms','Carbon score','Operating cost score','Network latency','Risk score','APY %','GLPK fallbacks'],
  activeEngineStudies.map(e=>[e.name,String(e.gap),String(e.ms),String(e.carbon),String(e.cost),String(e.latency),String(e.risk),String(e.apy),String(e.fallbacks)])));
 const fin=asObj(local('carbon-ledger-financial-impact-report-v159'));
 const currentSnapshot=asObj(local(WEATHER_DASHBOARD_SNAPSHOT_KEY));
 const freshFin=Boolean(fin.runAt&&currentSnapshot.runAt&&fin.runAt===currentSnapshot.runAt&&fin.engine===currentSnapshot.engine);
 if(freshFin){
  const selected=asObj(fin.selected),glpk=asObj(fin.glpk);
  const labels:[string,string][]=[['Operating cost USD/day','operatingDailyUsd'],['Annual cloud OPEX USD','annualCloudUsd'],['Annual modeled offset USD','annualOffsetUsd'],['Annual cloud and offset USD','annualOperatingAndOffsetUsd'],['Modeled gross APY %','grossApyPct'],['Modeled APY after offsets %','netApyPct'],['Carbon intensity gCO2/kWh','carbonIntensity'],['Network latency ms','latencyMs']];
  sections.push(sec('25. Current-scenario Financial Impact vs GLPK','These are saved results from the Financial Impact tab for the matching completed dashboard run. Values are modeled scenario estimates, not invoices. Cloud expenditure is separate from treasury investment APY.', ['Measure','Selected engine','GLPK'],[
   ['Selected engine',show(fin.engine),'GLPK reference'],
   ...labels.map(([label,key])=>[label,show(selected[key]),show(glpk[key])]),
   ['Modeled annual savings USD',money(fin.annualTotalSavingsUsd),'Baseline: $0'],
   ['Workload redistribution %',show(fin.weightShiftPct),'Comparison between 20 regional weights'],
   ['Regions with changed allocation',show(fin.regionsMoved),'All 20 regions assessed'],
   ['Captured at UTC',show(fin.capturedAt),'Current engine snapshot']
  ]));
 }else sections.push(sec('25. Financial Impact vs GLPK not yet captured','The report does not invent a GLPK baseline. Open the Financial Impact tab after a completed dashboard calculation, allow it to finish, then regenerate.', ['State','Action'],[['Not available','Generate a fresh Financial Impact comparison; prior snapshot may be stale or missing']]));
 sections.push(sec('26. AI report validation and provenance','Groq receives bounded source tables and can only add narrative, glossary, evidence references and recommendations. It cannot alter measured numerical rows. Where data is unavailable, no numeric value is inferred.', ['Safeguard','Meaning'],[
  ['Numerical source tables','Preserved verbatim in PDF/Word exports'],
  ['Source-linked evidence','Generated evidence references are accepted only when source section titles exist'],
  ['Reported quantum advantage','Not demonstrated by a classical CPU simulation'],
  ['Weather provenance','Open-Meteo forecasts mixed with modeled regional coefficients; not live grid metering'],
  ['External deployment','Production success must be verified independently']
 ]));
 return {...base,title:'CARBON LEDGER | Detailed Enterprise Intelligence Report',introduction:'Main Dashboard + Planning tools + Quantum Lab. Includes available saved experiment history, research benchmarks, forecasts and cooperative optimization. AI explanations are optional and all numeric rows are preserved.',sections};
}
