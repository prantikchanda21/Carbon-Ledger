'use client';
import {DASHBOARD_CONTROLS_STORAGE_KEY} from '@/lib/dashboardBudgetSync';
import { budgetLabel, budgetMillion, millionToCr, crToUsd } from '@/lib/budgetUsd';
import {validEngineMode,type EngineMode} from '@/lib/quantumEngineModes';
import DashboardSidebar from '@/components/DashboardSidebar';
import QuantumRiskPanel from '@/components/QuantumRiskPanel';
import {useDashboardPolicy,updateDashboardPolicy} from '@/lib/dashboardPolicy';
import {riskAwareAllocation} from '@/lib/riskAwareAllocation';
import SystemStats from '@/components/SystemStats';
import {runActivity} from '@/lib/runActivity';

import dynamic from 'next/dynamic';
import { MotionConfig } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Gauge, Landmark, Leaf, Network, Wind, Camera, Save, PlayCircle, Map as MapIcon } from 'lucide-react';
import { toPng } from 'html-to-image';
import { toast } from 'sonner';
import ControlPanel from '@/components/ControlPanel';
import DashboardHeader, { type SystemStatus } from '@/components/DashboardHeader';
import MetricCard from '@/components/MetricCard';
import TelemetryChart from '@/components/TelemetryChart';
import WeatherIntelligence from '@/components/WeatherIntelligence';
import PanelErrorBoundary from '@/components/PanelErrorBoundary';
import TimeScrubber from '@/components/TimeScrubber';
import EventInjector from '@/components/EventInjector';
import WorkloadTable from '@/components/WorkloadTable';
import ScenarioCompare from '@/components/ScenarioCompare';
import AllocationEditor from '@/components/AllocationEditor';
import TreasurySankey from '@/components/TreasurySankey';
import FrontierChart from '@/components/FrontierChart';
import SweepHeatmap from '@/components/SweepHeatmap';
import DecisionFeed from '@/components/DecisionFeed';
import DriftMonitor from '@/components/DriftMonitor';
import RegionDrawer from '@/components/RegionDrawer';
import BudgetBurnDown from '@/components/BudgetBurnDown';
import FullReportExport from '@/components/FullReportExport';
import type {HybridOutcome} from '@/lib/cooperativeHybrid';
import RegionMap2D from '@/components/RegionMap2D';
import CarbonOverview from '@/components/CarbonOverview';
import TrackerWorkspace from '@/components/TrackerWorkspace';
import { useControllerStore } from '@/lib/store';
import { recommendAdaptiveAutopilot, stepAdaptiveAutopilot } from '@/lib/autopilot';
import type { ControlState } from '@/lib/types';
import { carbonAt, generateTelemetry, generate24hSeries, hourOfDayUtc, simulatedFeedHealthAt } from '@/lib/mockData';
import { forecast24h } from '@/lib/forecast';
import { activeEvents, injectEvent } from '@/lib/events';
import { requestOptimization, loadTelemetry } from '@/lib/controllerClient';
import { assessFeedQuality } from '@/lib/anomaly';
import { SimulationClock } from '@/lib/simClock';
import { appendDecisionLog, readDecisionLog } from '@/lib/decisionLog';
import { readAuditChain, verifyAuditChain } from '@/lib/auditChain';
import { simulateCarbonFutures } from '@/lib/monteCarlo';
import { EVALUATION_DEBOUNCE_MS } from '@/lib/constants';
import { makeDashboardKpiSnapshot, type DashboardKpiSnapshot } from '@/lib/dashboardKpiSnapshot';
import {WEATHER_DASHBOARD_SNAPSHOT_KEY,WEATHER_DASHBOARD_SNAPSHOT_EVENT,type DashboardWeatherSnapshot} from '@/lib/weatherDashboardSync';
import type { OptimizationResult, RegionId, Scenario } from '@/lib/types';
import { REGIONS } from '@/lib/regions';
import { applyOverride } from '@/lib/override';

const Globe3D = dynamic(() => import('@/components/Globe3D'), {
  ssr: false,
  loading: () => <div className="grid min-h-[340px] place-items-center rounded-2xl border border-white/10 bg-slate-950/80 text-sm text-slate-600">Loading globe mesh…</div>,
});



export default function DashboardPage({view='overview'}:{view?:string}) {
  useEffect(()=>{
    const key=DASHBOARD_CONTROLS_STORAGE_KEY;
    const apply=(raw:string|null)=>{if(!raw)return;try{const c=JSON.parse(raw);if(Number.isFinite(c.sla_ms)&&c.sla_ms>0&&Number.isFinite(c.carbon_tax)&&c.carbon_tax>=0&&c.carbon_tax<=1&&Number.isFinite(c.budget_cr)&&c.budget_cr>=0&&typeof c.dpdp_locked==='boolean')useControllerStore.getState().setControls(c);}catch{}};
    try{apply(localStorage.getItem(key));}catch{}
    const scenarioKey='carbon-controller-comparisons-v151-usd';
    const loadScenarios=(raw:string|null)=>{if(!raw)return;try{const v=JSON.parse(raw);const valid=(x:Scenario|null)=>x===null||(typeof x==='object'&&Array.isArray(x.telemetry)&&x.controls&&typeof x.name==='string');if(valid(v.a)&&valid(v.b)){useControllerStore.setState({scenarioA:v.a,scenarioB:v.b});}}catch{}};
    try{loadScenarios(localStorage.getItem(scenarioKey));}catch{}
    const stopScenarios=useControllerStore.subscribe((state,previous)=>{if(state.scenarioA===previous.scenarioA&&state.scenarioB===previous.scenarioB)return;try{const raw=JSON.stringify({a:state.scenarioA,b:state.scenarioB});if(localStorage.getItem(scenarioKey)!==raw)localStorage.setItem(scenarioKey,raw);}catch{}});
    const unsubscribe=useControllerStore.subscribe((state,previous)=>{if(state.controls===previous.controls)return;try{const raw=JSON.stringify(state.controls);if(localStorage.getItem(key)!==raw)localStorage.setItem(key,raw);}catch{}});
    const sync=(e:StorageEvent)=>{if(e.key===key)apply(e.newValue);if(e.key===scenarioKey)loadScenarios(e.newValue);};window.addEventListener('storage',sync);
    return()=>{unsubscribe();stopScenarios();window.removeEventListener('storage',sync);};
  },[]);
  const controls = useControllerStore((s) => s.controls);
  const autopilotActive = useControllerStore((s) => s.autopilotActive);
  const setAutopilotActive = useControllerStore((s) => s.setAutopilotActive);
  const setControls = useControllerStore((s) => s.setControls);

  // Autopilot remains mounted while engines recalculate. The telemetry-driven
  // policy stays ON until Stop: it adjusts all control knobs in bounded steps,
  // waits for results, and reacts again when input conditions change.
  useEffect(() => {
    if (!autopilotActive) return;
    const tick = () => {
      const state = useControllerStore.getState();
      if (!state.autopilotActive || state.telemetry.length === 0) return;
      const recommendation = recommendAdaptiveAutopilot(state.controls, state.autopilotStart ?? state.controls, state.telemetry);
      const next = stepAdaptiveAutopilot(state.controls, recommendation);
      if (next.sla_ms !== state.controls.sla_ms || next.carbon_tax !== state.controls.carbon_tax || next.budget_cr !== state.controls.budget_cr) {
        setControls(next);
      }
    };
    tick();
    const timer = window.setInterval(tick, 4000);
    return () => window.clearInterval(timer);
  }, [autopilotActive, setControls]);

  // Each bounded Autopilot adjustment is a real solver input. Requests are
  // debounced and abort old results; the KPI cards keep the last valid snapshot.
  const appliedControls = controls;
  const telemetry = useControllerStore((s) => s.telemetry);
  const optimizerResult = useControllerStore((s) => s.result);
  const override = useControllerStore((s) => s.override);
  const setOverride = useControllerStore((s) => s.setOverride);
  const simulationTime = useControllerStore((s) => s.simulationTime);
  const events = useControllerStore((s) => s.events);
  const selectedRegion = useControllerStore((s) => s.selectedRegion);
  const decisionLog = useControllerStore((s) => s.decisionLog);
  const ui = useControllerStore((s) => s.ui);
  const setTelemetry = useControllerStore((s) => s.setTelemetry);
  const setSimulation = useControllerStore((s) => s.setSimulation);
  const setResult = useControllerStore((s) => s.setResult);
  const setSelectedRegion = useControllerStore((s) => s.setSelectedRegion);
  const setScenarioA = useControllerStore((s) => s.setScenarioA);
  const setScenarioB = useControllerStore((s) => s.setScenarioB);
  const addDecision = useControllerStore((s) => s.addDecision);
  const hydrateDecisionLog = useControllerStore((s) => s.hydrateDecisionLog);
  const setUI = useControllerStore((s) => s.setUI);

  const [engineMode,setEngineMode]=useState<EngineMode>('glpk');
  const [runRevision,setRunRevision]=useState(0);
  const [executedEngine,setExecutedEngine]=useState('');
  useEffect(()=>{try{const stored=localStorage.getItem('carbon-engine-mode-v86');if(validEngineMode(stored))setEngineMode(stored);}catch{}},[]);
  const chooseEngine=(next:EngineMode)=>{if(next===engineMode)return;setEngineMode(next);setCooperative(null);setOverride(null);setCooperativeError('');try{localStorage.setItem('carbon-engine-mode-v86',next);}catch{}};

  // One immutable optimization input snapshot per selected engine, settings, or explicit rerun.
  // Live telemetry updates the monitor; Autopilot snapshots the current feed on each controlled policy change.
  const [optimizationInput,setOptimizationInput]=useState<{telemetry:typeof telemetry;time:Date}|null>(null);
  useEffect(()=>{const current=useControllerStore.getState();if(current.telemetry.length===20)setOptimizationInput({telemetry:current.telemetry.map(t=>({...t})),time:new Date(current.simulationTime)});},[engineMode,appliedControls,ui.shadowMode,ui.chaosMode,runRevision]);
  useEffect(()=>{if(!optimizationInput&&telemetry.length===20)setOptimizationInput({telemetry:telemetry.map(t=>({...t})),time:new Date(simulationTime)});},[optimizationInput,telemetry,simulationTime]);
  // Autopilot also reruns the chosen engine when grid conditions change,
  // even if SLA, penalty and capital are already within their deadbands.
  // Commit *one frozen telemetry snapshot* per tick; never stream directly
  // into a running solver request or interrupt an in-flight response.
  useEffect(() => {
    if (!autopilotActive) return;
    const refreshFromConditions=()=>{
      const current=useControllerStore.getState();
      if(!current.autopilotActive || current.telemetry.length!==20) return;
      const next=current.telemetry;
      setOptimizationInput(previous=>{
        const old=previous?.telemetry;
        if(old && old.length===next.length && next.every((node,index)=>
          old[index].region===node.region &&
          old[index].available===node.available &&
          Math.abs(old[index].carbon_ci-node.carbon_ci)<3 &&
          Math.abs(old[index].energy_price-node.energy_price)<0.5 &&
          Math.abs(old[index].latency_ms-node.latency_ms)<1)) return previous;
        return {telemetry:next.map(n=>({...n})),time:new Date(current.simulationTime)};
      });
    };
    refreshFromConditions();
    const timer=window.setInterval(refreshFromConditions,4000);
    return ()=>window.clearInterval(timer);
  },[autopilotActive]);
  const dashboardPolicy=useDashboardPolicy();
  const optimizationTelemetry=useMemo(()=>(optimizationInput?.telemetry??[]).map(t=>({...t,energy_price:t.energy_price*(dashboardPolicy.weather?.factors[t.region]??1)})),[optimizationInput,dashboardPolicy.weather]);
  const optimizationTime=optimizationInput?.time??simulationTime;
  const [cooperative, setCooperative] = useState<{key:string;outcome:HybridOutcome;snapshot:OptimizationResult; proposal?:{weights:number[];selectedRegion:string;objective:number;deltaVsGlpk:number;feasible:boolean;changedFromGlpk:boolean;candidateMethod:string};fallbackReason?:string|null;timing?:{serverComputeMs:number;qaoaMs?:number}}|null>(null);
  const [cooperativeError,setCooperativeError]=useState('');
  const [cooperativeBusy,setCooperativeBusy]=useState(false);
  // Stable per-scenario key. Live telemetry is committed on controlled Autopilot adjustments;
  // evaluationKey prevents stale controller results from reaching the selected quantum engine.
  const cooperativeKey=useMemo(()=>JSON.stringify({engineMode,controls:appliedControls,runRevision,hour:optimizationTime.toISOString().slice(0,13),evaluationKey:optimizerResult?.evaluation_key,eligible:optimizerResult?.nodes.map(n=>n.eligible),telemetry:optimizationTelemetry.map(t=>[t.region,t.carbon_ci,t.energy_price,t.latency_ms,t.available])}),[engineMode,appliedControls,runRevision,optimizationInput,optimizationTelemetry,optimizerResult?.nodes,optimizerResult?.evaluation_key]);
  const stableKeyRef=useRef('');
  useEffect(()=>{
    if(!optimizerResult||optimizationTelemetry.length!==20||!optimizerResult.nodes.length||optimizerResult.evaluation_key!==evaluationHash())return;
    if(stableKeyRef.current===cooperativeKey)return;
    stableKeyRef.current=cooperativeKey;
    const abort=new AbortController();
    const snapshot=optimizerResult;
    const payload={telemetry:optimizationTelemetry,controls:appliedControls,nodes:snapshot.nodes,engine:engineMode};
    setCooperativeBusy(true);setCooperativeError('');
    const timer=window.setTimeout(()=>{
      void fetch('/api/cooperative-allocation',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,researchDiagnostics:true}),signal:abort.signal})
       .then(async response=>{const data=await response.json();if(!response.ok)throw Error(data.error||`Server returned ${response.status}`);return data as {outcome:HybridOutcome;engineUsed:string;fallbackReason?:string;researchProposal?:{weights:number[];selectedRegion:string;objective:number;deltaVsGlpk:number;feasible:boolean;changedFromGlpk:boolean;candidateMethod:string};timing?:{serverComputeMs:number;qaoaMs?:number}};})
       .then(({outcome,engineUsed,fallbackReason,researchProposal,timing})=>{if(!abort.signal.aborted){if(!outcome?.feasible || !Array.isArray(outcome.weights) || outcome.weights.length!==snapshot.nodes.length || outcome.weights.some(w=>!Number.isFinite(w) || w<0))throw Error('Engine returned no valid feasible allocation');setCooperative({key:cooperativeKey,outcome,snapshot,proposal:researchProposal,fallbackReason,timing});setExecutedEngine(engineUsed+(fallbackReason?` (fallback: ${fallbackReason})`:''));setCooperativeBusy(false);}})
       .catch(err=>{if(!abort.signal.aborted){setCooperativeError(err instanceof Error?err.message:String(err));setCooperativeBusy(false);}});
    },750);
    return()=>{window.clearTimeout(timer);abort.abort();if(stableKeyRef.current===cooperativeKey)stableKeyRef.current='';};
    // The snapshot is intentionally frozen for the entire server optimisation request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[cooperativeKey,optimizerResult?.evaluation_key,optimizationTelemetry.length]);
  const cooperativeActive=Boolean(cooperative?.outcome.feasible && cooperative.key===cooperativeKey); // Never display a stale allocation from a previously selected engine or scenario.
  const hybridResult=useMemo(()=>{
    // Do not expose the classical preview (or a previous engine result) before this run completes.
    if(!optimizerResult||!cooperativeActive||!cooperative)return null;
    const proposed=engineMode!=='glpk'&&cooperative.proposal?.feasible&&cooperative.proposal.weights.length===optimizerResult.nodes.length;
    const weights=proposed?cooperative.proposal!.weights:cooperative.outcome.weights;
    const allocation=Object.fromEntries(optimizerResult.nodes.map((n,i)=>[n.id,weights[i]??0]));
    const adjusted=applyOverride(optimizerResult,allocation,{budget_cr:appliedControls.budget_cr,carbon_tax:appliedControls.carbon_tax});
    return {...adjusted,manual_override:undefined,compliance:{...adjusted.compliance,notes:[...adjusted.compliance.notes.filter(note=>note!=='Manual allocation override active'),`Selected engine: ${engineMode}; displayed allocation: ${proposed?'engine-specific feasible research allocation':engineMode!=='glpk'?'independent quantum allocation':'GLPK classical baseline'}; research allocations are not claims of production optimality.`]}};
  },[optimizerResult,cooperative,cooperativeActive,appliedControls.budget_cr,appliedControls.carbon_tax,executedEngine,engineMode]);
  const [riskThreshold,setRiskThreshold]=useState(15);
  const [riskEnabled,setRiskEnabled]=useState(true);
  const [riskHydrated,setRiskHydrated]=useState(false);
  useEffect(()=>{try{const saved=JSON.parse(localStorage.getItem('carbon-risk-policy-v166')??'null');if(saved&&[1,2,3,5,8,10,15,20].includes(saved.threshold)){setRiskThreshold(saved.threshold);setRiskEnabled(saved.enabled!==false);}}catch{}setRiskHydrated(true);},[]);
  useEffect(()=>{if(riskHydrated)try{localStorage.setItem('carbon-risk-policy-v166',JSON.stringify({threshold:riskThreshold,enabled:riskEnabled}));}catch{}},[riskThreshold,riskEnabled,riskHydrated]);
  const schedulerEvaluation=useMemo(()=>{
    if(!hybridResult || !dashboardPolicy.scheduler)return null;
    const original=hybridResult.allocations.node_weights;
    const demand=dashboardPolicy.scheduler.weights;
    const context={budget_cr:appliedControls.budget_cr,carbon_tax:appliedControls.carbon_tax};
    // Preserve the 50% preference strength, but backtrack when the full change breaks the SLA.
    // Never claim an adjustment was applied if caps/eligibility projection removes its effect.
    let best: OptimizationResult = hybridResult;
    let strength=0;
    const changes=(weights:Record<string,number>)=>hybridResult.nodes.reduce((sum,node)=>sum+Math.abs((weights[node.id]??0)-(original[node.id]??0)),0)/2;
    const proposedWeights=Object.fromEntries(hybridResult.nodes.map(node=>[node.id,.5*(original[node.id]??0)+.5*(demand[node.id]??0)]));
    const proposed=applyOverride(hybridResult,proposedWeights,context);
    const proposalMovement=changes(proposed.allocations.node_weights);
    // Largest feasible prefix of the line joining engine weights and scheduler weights.
    // Backtracking also works when a 50% mix violates the SLA but a smaller mix does not.
    for(const factor of [1,.75,.5,.25,.125,.0625,.03125,.015625]){
      const candidate=factor===1?proposed:applyOverride(hybridResult,Object.fromEntries(hybridResult.nodes.map(node=>[node.id,(1-.5*factor)*(original[node.id]??0)+.5*factor*(demand[node.id]??0)])),context);
      if(candidate.latency.sla_compliant && changes(candidate.allocations.node_weights)>1e-6){best=candidate;strength=.5*factor;break;}
    }
    return {result:best,proposal:proposed,proposalMovement,appliedMovement:changes(best.allocations.node_weights),strength,status:strength>0?'applied':proposalMovement<1e-6?'no-change':'blocked' as 'applied'|'no-change'|'blocked'};
  },[hybridResult,dashboardPolicy.scheduler,appliedControls.budget_cr,appliedControls.carbon_tax]);
  const scheduledResult=schedulerEvaluation?.result??hybridResult;
  const baseResult=useMemo(()=>scheduledResult&&override?applyOverride(scheduledResult,override,{budget_cr:appliedControls.budget_cr,carbon_tax:appliedControls.carbon_tax}):scheduledResult,[scheduledResult,override,appliedControls.budget_cr,appliedControls.carbon_tax]);
  const riskDecision=useMemo(()=>baseResult&&riskEnabled?riskAwareAllocation(baseResult,appliedControls,riskThreshold,cooperativeKey):null,[baseResult,riskEnabled,appliedControls,riskThreshold,cooperativeKey]);
  const result=riskDecision?.result??baseResult;
  const schedulerFinalDelta=useMemo(()=>{
    if(!hybridResult||!result||!dashboardPolicy.scheduler)return null;
    const diffs=hybridResult.nodes.map(n=>({id:n.id,change:100*((result.allocations.node_weights[n.id]??0)-(hybridResult.allocations.node_weights[n.id]??0))}));
    return {total:diffs.reduce((sum,d)=>sum+Math.abs(d.change),0)/2,top:diffs.sort((a,b)=>Math.abs(b.change)-Math.abs(a.change)).slice(0,5)};
  },[hybridResult,result,dashboardPolicy.scheduler]);

  // Share a verified, completed controller snapshot with the Decisions inspector.
  // Never publish placeholder/classical-preview data or a stale prior-engine run.
  useEffect(() => {
    const storageKey = 'carbon-ledger-completed-engine-decision-v1';
    if (!result || !cooperativeActive || cooperative?.key !== cooperativeKey || cooperativeBusy || cooperativeError) {
      try { localStorage.removeItem(storageKey); } catch {}
      return;
    }
    const proposalUsed = engineMode !== 'glpk' && cooperative.proposal?.feasible === true;
    try {
      localStorage.setItem(storageKey, JSON.stringify({
        schema: 1, at: new Date().toISOString(), requestedEngine: engineMode,
        executedEngine, proposalUsed, fallbackReason: cooperative.fallbackReason ?? null,
        scenarioKey: cooperativeKey, source: proposalUsed ? 'Engine-specific feasible proposal' : 'Completed allocation / fallback',
        controls: {sla_ms: appliedControls.sla_ms, dpdp_locked: appliedControls.dpdp_locked, carbon_tax: appliedControls.carbon_tax},
        weights: result.allocations.node_weights,
        nodes: result.nodes.map(n=>({id:n.id,city:n.city,eligible:n.eligible,exclusion_reason:n.exclusion_reason,carbon_ci:n.carbon_ci,latency_ms:n.latency_ms,unit_cost_usd_per_kwh:n.unit_cost_usd_per_kwh,weight:result.allocations.node_weights[n.id]??0})),
        summary: {weightedCarbon: result.carbon_avoided.blended_ci, footprint: result.carbon_avoided.net_footprint_mt, latency: result.latency.weighted_network_ms, dailyCost: result.cost.operating_cost_usd_per_day},
      }));
    } catch {}
  }, [result, cooperativeActive, cooperative, cooperativeKey, cooperativeBusy, cooperativeError, engineMode, executedEngine, appliedControls.sla_ms, appliedControls.dpdp_locked, appliedControls.carbon_tax]);
  const optimizationSource=riskDecision?.changed?'Risk-aware reassignment (classical candidate search + ideal IQAE risk gate)':override?'Manual allocation override':cooperativeActive?`${engineMode}: ${engineMode!=='glpk'&&cooperative?.proposal?.feasible?'engine-specific feasible allocation':engineMode!=='glpk'?'Independent quantum simulation allocation':'GLPK baseline'} (${executedEngine || engineMode})`:cooperativeBusy?`${engineMode} · calculating`:cooperativeError?'Selected engine calculation failed':'Preparing cooperative allocation';
  const [feed, setFeed] = useState('boot');
  const telemetrySourceLabel = feed === 'electricity-maps' ? 'Live API' : feed === 'mixed' ? 'Mixed live / modeled' : feed === 'cached' ? 'Cached' : feed === 'boot' ? 'Loading' : feed === 'unavailable' ? 'Unavailable' : feed === 'fallback' || feed === 'modeled' || feed === 'mock' ? 'Modeled' : feed === 'stream' || feed === 'polling' || feed === 'api' ? 'API / model feed' : 'Modeled';
  const [auditStatus, setAuditStatus] = useState('');
  // Drop a pinned override if none of its regions are eligible any more (e.g. after tightening SLA or enabling DPDP).
  useEffect(() => {
    if (override && optimizerResult && !result?.manual_override) {
      setOverride(null);
      toast.info('Manual allocation cleared: none of its regions are eligible under the current constraints', { id: 'override-cleared' });
    }
  }, [override, optimizerResult, result, setOverride]);

  const [error, setError] = useState<string | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  useEffect(()=>{runActivity('controller',evaluating,'Allocation model');return()=>runActivity('controller',false,'Allocation model');},[evaluating]);
  const [forecast, setForecast] = useState(() => forecast24h(simulationTime));
  const [gaps, setGaps] = useState<number[]>([]);
  const [mapMode, setMapMode] = useState<'2d'|'3d'>('2d');

  const cache = useRef(new Map<string, OptimizationResult>());
  const lastDecisionKey = useRef('');
  const previousBlendedCi = useRef<number | null>(null);
  const playing = useControllerStore((s) => s.playing);
  const simSpeed = useControllerStore((s) => s.simSpeed);
  const clockRef = useRef<SimulationClock | null>(null);
  const historicalTimeRef = useRef(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    const parsedTime = url.searchParams.get('t');
    const initialTime = parsedTime ? new Date(parsedTime) : null;
    const validTime = initialTime && Number.isFinite(initialTime.getTime()) ? initialTime : simulationTime;
    historicalTimeRef.current = Math.abs(Date.now() - validTime.getTime()) > 15 * 60 * 1000;

    const parseBounded = (key: string, min: number, max: number): number | null => {
      const raw = url.searchParams.get(key);
      if (raw === null) return null;
      const value = Number(raw);
      return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : null;
    };
    const sla = parseBounded('sla', 10, 100);
    const tax = parseBounded('tax', 0, 1);
    const budget = parseBounded('budget', 5, 100);
    useControllerStore.getState().setControls({
      ...(sla === null ? {} : { sla_ms: Math.round(sla) }),
      ...(tax === null ? {} : { carbon_tax: Number(tax.toFixed(2)) }),
      ...(budget === null ? {} : { budget_cr: millionToCr(Math.round(budget)) }),
      ...(url.searchParams.has('dpdp') ? { dpdp_locked: url.searchParams.get('dpdp') === '1' } : {}),
    });
    useControllerStore.getState().setSimulation(validTime, useControllerStore.getState().simSpeed, false);

    const clock = new SimulationClock(validTime);
    clockRef.current = clock;
    const unsubscribe = clock.subscribe((time, speed, isPlaying) => setSimulation(time, speed, isPlaying));
    hydrateDecisionLog(readDecisionLog());
    return () => { unsubscribe(); clock.dispose(); clockRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const clock = clockRef.current;
    if (!clock) return;
    clock.setSpeed(simSpeed);
    if (playing) clock.play(); else clock.pause();
  }, [playing, simSpeed]);
  useEffect(() => {
    const clock = clockRef.current;
    if (!clock) return;
    const current = clock.getState().time.getTime();
    if (Math.abs(current - simulationTime.getTime()) > 1000) clock.setTime(simulationTime);
  }, [simulationTime]);

  const evaluationHash = useCallback((): string => {
    return JSON.stringify({
      t: optimizationTime.toISOString().slice(0, 13),
      c: appliedControls, e: ui.chaosMode, s: ui.shadowMode, runRevision,
      telemetry: optimizationTelemetry.map((n) => [n.region, n.carbon_ci, n.energy_price, n.latency_ms, n.available]),
    });
  }, [optimizationInput, optimizationTelemetry, appliedControls, ui.chaosMode, ui.shadowMode, runRevision]);

  useEffect(() => {
    historicalTimeRef.current = Math.abs(Date.now() - simulationTime.getTime()) > 15 * 60 * 1000;
    const clockBase = generateTelemetry(simulationTime, controls.dpdp_locked, true);
    const adjusted = activeEvents(events, simulationTime.getTime()).length
      ? activeEvents(events, simulationTime.getTime()).reduce((current, event) => injectEvent(event, current, simulationTime.getTime(), useControllerStore.getState().controls.carbon_tax), clockBase)
      : clockBase;
    setTelemetry(adjusted);
    setForecast(forecast24h(simulationTime));
  }, [simulationTime, events, controls.dpdp_locked, setTelemetry]);

  useEffect(() => {
    if (historicalTimeRef.current) return;
    const controller = new AbortController();
    void loadTelemetry(controller.signal).then((loaded) => { setTelemetry(loaded.telemetry); setFeed(loaded.source); }).catch(() => {});
    return () => controller.abort();
  }, [setTelemetry]);

  useEffect(() => {
    let es: EventSource | null = null;
    let retry = 1000;
    let stopped = false;
    let pollTimer: number | null = null;
    let reconnectTimer: number | null = null;
    const stopPolling = (): void => { if (pollTimer !== null) { window.clearInterval(pollTimer); pollTimer = null; } };
    const startPolling = (): void => {
      if (pollTimer !== null) return;
      pollTimer = window.setInterval(() => {
        const current = useControllerStore.getState();
        const closeToNow = Math.abs(Date.now() - current.simulationTime.getTime()) < 15 * 60 * 1000;
        if (current.playing || !closeToNow || historicalTimeRef.current) return;
        void loadTelemetry().then((loaded) => { setTelemetry(loaded.telemetry); setFeed('polling'); }).catch(() => {});
      }, 30000);
    };
    const connect = (): void => {
      if (stopped) return;
      es = new EventSource('/api/stream');
      es.onopen = () => { stopPolling(); setFeed('stream'); retry = 1000; };
      es.addEventListener('telemetry', (event) => {
        try {
          const payload = JSON.parse((event as MessageEvent).data) as { telemetry: typeof telemetry; source?: string };
          const current = useControllerStore.getState();
          const closeToNow = Math.abs(Date.now() - current.simulationTime.getTime()) < 15 * 60 * 1000;
          if (!current.playing && closeToNow && !historicalTimeRef.current) {
            setTelemetry(payload.telemetry);
            setFeed(payload.source??'stream');
          }
        } catch {}
      });
      es.onerror = () => {
        es?.close();
        startPolling();
        if (!stopped) { reconnectTimer = window.setTimeout(connect, retry); retry = Math.min(15000, retry * 2); }
      };
    };
    connect();
    return () => { stopped = true; es?.close(); stopPolling(); if (reconnectTimer !== null) window.clearTimeout(reconnectTimer); };
  }, [setTelemetry]);

  useEffect(() => {
    if (optimizationTelemetry.length!==20) return;
    const controller = new AbortController();
    const key = evaluationHash();
    const cached = cache.current.get(key);
    if (cached) { setResult(cached); setEvaluating(false); return () => controller.abort(); }
    setEvaluating(true);
    const timer = window.setTimeout(() => {
      void requestOptimization({
        telemetry:optimizationTelemetry,
        sla_ms: appliedControls.sla_ms,
        carbon_tax: appliedControls.carbon_tax,
        budget_cr: appliedControls.budget_cr,
        treasury_yield: 6.8,
        dpdp_locked: appliedControls.dpdp_locked,
        shadow: ui.shadowMode,
        chaos: ui.chaosMode,
        evaluation_key: key,
      }, controller.signal).then((next) => {
        if (controller.signal.aborted) return;
        cache.current.set(key, next);
        if (cache.current.size > 250) cache.current.delete(cache.current.keys().next().value as string);
        setResult(next); setError(null); setEvaluating(false);
        if (next.shadow?.available) setGaps((g) => [...g.slice(-99), next.shadow!.cost_gap_pct]);
        const reasonCodes: Array<'SLA'|'DPDP'|'fallback'|'hedge_change'|'carbon_shift'|'event'|'scheduler'> = [];
        if (!next.latency.sla_compliant) reasonCodes.push('SLA');
        if (appliedControls.dpdp_locked) reasonCodes.push('DPDP');
        if (next.engine !== 'onnx') reasonCodes.push('fallback');
        if (next.allocations.hedge_pct !== 0) reasonCodes.push('hedge_change');
        const carbonSpike = previousBlendedCi.current !== null && next.carbon_avoided.blended_ci > 500 && next.carbon_avoided.blended_ci > previousBlendedCi.current * 1.15;
        if (carbonSpike) reasonCodes.push('carbon_shift');
        previousBlendedCi.current = next.carbon_avoided.blended_ci;
        if (activeEvents(events, simulationTime.getTime()).length) reasonCodes.push('event');
        if (key !== lastDecisionKey.current) {
          lastDecisionKey.current = key;
          const entry = {
            id: `decision-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`, timestamp: Date.now(), engine: next.engine, reasonCodes,
            summary: `${next.engine} routed ${Math.round((next.allocations.node_weights.mumbai ?? 0)*100)}% Mumbai · ${Math.round(next.carbon_avoided.blended_ci)} gCO₂/kWh`,
            cost_usd_per_kwh: next.cost.blended_unit_cost_usd_per_kwh, blended_ci: next.carbon_avoided.blended_ci,
            allocation: next.allocations.node_weights,
          };
          addDecision(entry);
          appendDecisionLog(entry);
        }
        if (!ui.muted) {
          if (!next.latency.sla_compliant) toast.error('SLA breach', { id: 'sla' });
          if (appliedControls.dpdp_locked && !next.compliance.residency_ok) toast.error('Residency violation', { id: 'dpdp' });
          if (carbonSpike) toast.warning('Carbon spike detected', { id: 'carbon-spike', description: `${Math.round(next.carbon_avoided.blended_ci)} gCO₂/kWh at the active allocation` });
        }
      }).catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setError(reason instanceof Error ? reason.message : 'Controller error'); setEvaluating(false);
      });
    }, EVALUATION_DEBOUNCE_MS);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [optimizationInput, appliedControls, ui.shadowMode, ui.chaosMode, runRevision, setResult, addDecision, evaluationHash]);

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === '?') setUI({ shortcutOpen: !useControllerStore.getState().ui.shortcutOpen });
      if (e.key === '1') useControllerStore.getState().setControls({sla_ms:20,carbon_tax:0.8,budget_cr:millionToCr(20),dpdp_locked:true});
      if (e.key === '2') useControllerStore.getState().setControls({sla_ms:45,carbon_tax:0.95,budget_cr:millionToCr(60),dpdp_locked:false});
      if (e.key === '3') useControllerStore.getState().setControls({sla_ms:70,carbon_tax:0.1,budget_cr:millionToCr(10),dpdp_locked:false});
    };
    window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler);
  }, [setUI]);

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('sla', String(controls.sla_ms));
    url.searchParams.set('tax', controls.carbon_tax.toFixed(2));
    url.searchParams.set('budget', String(Math.round(budgetMillion(controls.budget_cr))));
    url.searchParams.set('dpdp', controls.dpdp_locked ? '1' : '0');
    url.searchParams.set('t', simulationTime.toISOString());
    if (useControllerStore.getState().scenarioA) url.searchParams.set('a', '1');
    if (useControllerStore.getState().scenarioB) url.searchParams.set('b', '1');
    window.history.replaceState({}, '', url);
  }, [controls, simulationTime]);

  useEffect(() => {
    if (!ui.presenterMode) return; // Explicit presenter mode is the only automatic scenario-change exception.
    const presets = [
      {sla_ms:20,carbon_tax:0.8,budget_cr:millionToCr(20),dpdp_locked:true},
      {sla_ms:45,carbon_tax:0.95,budget_cr:millionToCr(60),dpdp_locked:false},
      {sla_ms:70,carbon_tax:0.1,budget_cr:millionToCr(10),dpdp_locked:false},
    ] as const;
    let index = 0;
    const timer = window.setInterval(() => { useControllerStore.getState().setControls(presets[index % presets.length]); toast.info(['Strict compliance','Max green','Min cost'][index%3], {id:'presenter'}); index += 1; }, 6500);
    return () => window.clearInterval(timer);
  }, [ui.presenterMode]);

  function pinA(): void {
    if (!result) return;
    const scenario: Scenario = { name: 'A · pinned', controls, telemetry, createdAt: Date.now(), result };
    setScenarioA(scenario); toast.success('Scenario A pinned');
  }
  function pinB(): void {
    if (!result) return;
    const scenario: Scenario = { name: 'B · current', controls, telemetry, createdAt: Date.now(), result };
    setScenarioB(scenario); toast.success('Scenario B pinned');
  }

  async function snapshot(): Promise<void> {
    try {
      const element = document.getElementById('dashboard-canvas');
      if (!element) throw new Error('Dashboard canvas is not available');
      const dataUrl = await toPng(element, { cacheBust: true, pixelRatio: 1.5, backgroundColor: '#0a0118' });
      const a = document.createElement('a'); a.download = 'carbon-ledger-dashboard.png'; a.href = dataUrl; a.click();
      const win = window.open('', '_blank');
      if (win) {
        win.document.write(`<html><body style="margin:0;background:#020617"><img style="width:100%" src="${dataUrl}" onload="window.print();setTimeout(()=>window.close(),300)"/></body></html>`);
        win.document.close();
        toast.success('PNG exported · print dialog opened for PDF');
      } else {
        toast.success('PNG exported');
      }
    } catch (snapshotError) {
      toast.error(snapshotError instanceof Error ? snapshotError.message : 'Snapshot failed');
    }
  }

  const series = useMemo(() => result ? generate24hSeries(result.allocations.node_weights, result.allocations.treasury.projected_apy, simulationTime) : [], [result, simulationTime]);
  const globeNodes = useMemo(() => result?.nodes.map((n) => ({ id:n.id, carbon_ci:n.carbon_ci, weight:n.weight, eligible:n.eligible, latency_ms:n.latency_ms })) ?? telemetry.map((t) => {
    const meta = Object.values(REGIONS).find((r) => r.code === t.region);
    return meta ? { id:meta.id, carbon_ci:t.carbon_ci, weight:0, eligible:t.available !== false, latency_ms:t.latency_ms } : null;
  }).filter((n): n is {id:RegionId;carbon_ci:number;weight:number;eligible:boolean;latency_ms:number} => n !== null), [result, telemetry]);
  const carbon = result?.carbon_avoided;
  const treasury = result?.allocations.treasury;
  // Keep the last *completed* engine KPIs mounted while a new engine or controls
  // are recalculating. Never substitute a classical preview or misattribute an older
  // engine snapshot to the currently selected engine.
  const activeKpiSnapshot = useMemo(() => result && cooperativeActive
    ? makeDashboardKpiSnapshot(result, engineMode, appliedControls.budget_cr, series)
    : null, [result, cooperativeActive, engineMode, appliedControls.budget_cr, series]);
  const [lastCompletedKpis, setLastCompletedKpis] = useState<DashboardKpiSnapshot | null>(null);
  useEffect(() => {
    if (activeKpiSnapshot && !cooperativeBusy && !cooperativeError) {
      setLastCompletedKpis(activeKpiSnapshot);
    }
  }, [activeKpiSnapshot, cooperativeBusy, cooperativeError]);
  // Publish only a completed, fully selected, engine-specific dashboard allocation.
  // Weather Optimizer uses these exact weights and telemetry as its baseline.
  useEffect(()=>{
    if(!result||!cooperativeActive||cooperativeBusy||cooperativeError||!activeKpiSnapshot||optimizationTelemetry.length!==20||result.nodes.length!==20)return;
    const payload:DashboardWeatherSnapshot={
      version:1,engine:engineMode,engineUsed:executedEngine||engineMode,scenarioKey:cooperativeKey,
      runAt:new Date().toISOString(),simulationTime:optimizationTime.toISOString(),
      controls:{...appliedControls},telemetry:optimizationTelemetry.map(t=>({...t})),
      weatherFactors:dashboardPolicy.weather?.factors,
      nodes:result.nodes.map(n=>({...n})),
      weights:{...result.allocations.node_weights},
      hedgeFraction:result.allocations.hedge_pct/100,
      allocationSource:override?'manual':'engine',
      baseline:{blendedCarbon:activeKpiSnapshot.carbonIntensity,netTonnes:activeKpiSnapshot.netFootprintMt,
        weightedLatency:activeKpiSnapshot.networkLatencyMs,
        operatingUsdDaily:result.cost.operating_cost_usd_per_day,
        netApy:activeKpiSnapshot.netTreasuryApy??result.allocations.treasury.projected_apy},
    };
    try{localStorage.setItem(WEATHER_DASHBOARD_SNAPSHOT_KEY,JSON.stringify(payload));window.dispatchEvent(new CustomEvent(WEATHER_DASHBOARD_SNAPSHOT_EVENT,{detail:payload}));}catch{}
  },[result,cooperativeActive,cooperativeBusy,cooperativeError,activeKpiSnapshot,optimizationTelemetry,optimizationTime,appliedControls,engineMode,executedEngine,cooperativeKey,override]);
  const shownKpis = activeKpiSnapshot ?? lastCompletedKpis;
  const showingPreviousKpis = !activeKpiSnapshot && lastCompletedKpis !== null;
  const kpiIsUpdating = autopilotActive || cooperativeBusy || evaluating || showingPreviousKpis;
  const status: SystemStatus = result ? (error ? 'error' : cooperative && cooperative.key===cooperativeKey && !override ? 'cooperative' : result.engine) : 'loading';
  const quality = telemetry.map((node) => {
    const meta = Object.values(REGIONS).find((r) => r.code === node.region);
    const id = meta?.id as RegionId | undefined;
    const history: number[] = id
      ? Array.from({ length: 12 }, (_, index) => {
          const t = new Date(simulationTime.getTime() - (12 - index) * 3_600_000);
          let sample = carbonAt(id, hourOfDayUtc(t));
          const historicalEvents = events.filter((event) => t.getTime() >= event.startedAt && t.getTime() < event.startedAt + event.durationHours * 3_600_000);
          for (const event of historicalEvents) {
            const generated = generateTelemetry(t, controls.dpdp_locked, true);
            const adjusted = injectEvent(event, generated, t.getTime(), controls.carbon_tax);
            const match = adjusted.find((candidate) => candidate.region === node.region);
            if (match) sample = match.carbon_ci;
          }
          return sample;
        })
      : [];
    const anomalyReport = node.available === false
      ? { ...assessFeedQuality(node, history), stale: true, quality: 'stale' as const }
      : assessFeedQuality(node, history);
    const simulatedHealth = id && node.source !== 'electricity-maps' ? simulatedFeedHealthAt(id, hourOfDayUtc(simulationTime)) : null;
    const report = anomalyReport.quality === 'stale' || simulatedHealth?.quality === 'stale'
      ? { ...anomalyReport, stale: true, quality: 'stale' as const }
      : anomalyReport.quality === 'watch' || simulatedHealth?.quality === 'watch'
        ? { ...anomalyReport, quality: 'watch' as const }
        : anomalyReport;
    return { id: node.region, report, score: simulatedHealth?.score ?? 100 };
  });
  const selectedId = selectedRegion;
  const mcApy = treasury?.projected_apy;
  const mcCi = carbon?.blended_ci;
  const mc = useMemo(() => simulateCarbonFutures(42, 120, { baseApy: mcApy, carbonTax: controls.carbon_tax, blendedCi: mcCi }), [mcApy, mcCi, controls.carbon_tax]);
  useEffect(()=>{try{localStorage.setItem('carbon-dashboard-snapshot-v151-usd',JSON.stringify({telemetry,controls,simulationTime:simulationTime.toISOString()}));}catch{}},[telemetry,controls,simulationTime]);


  return <MotionConfig reducedMotion="user"><div id="dashboard-canvas" className="carbon-workspace mx-auto min-h-screen max-w-[2000px] px-2 py-2 sm:px-3">
    {view==='overview'&&<SystemStats initiallyExpanded={false}/>}
    <main className="mt-2 space-y-2">
      <DashboardHeader status={status} />
      {(dashboardPolicy.weather||dashboardPolicy.scheduler)&&<div className="atlas-card p-3 text-xs text-cyan-200">Active dashboard inputs: {dashboardPolicy.weather?`Weather +${dashboardPolicy.weather.hour}h · `:''}{dashboardPolicy.scheduler?'Scheduler demand (50% placement preference, capacity/SLA checked)':''}<button className="ml-3 underline" onClick={()=>updateDashboardPolicy({weather:undefined,scheduler:undefined})}>Clear weather & scheduler inputs</button></div>}
      {view==='overview'&&dashboardPolicy.scheduler&&schedulerEvaluation&&schedulerFinalDelta&&<section className="atlas-card p-3 text-xs" aria-label="Quantum scheduler allocation impact" data-testid="scheduler-impact">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-semibold text-white">Scheduler impact on dashboard</h2><span className={`rounded-full px-2 py-1 font-semibold ${schedulerEvaluation.status==='applied'?'bg-emerald-400/15 text-emerald-200':'bg-amber-400/15 text-amber-200'}`}>{schedulerEvaluation.status==='applied'?'SLA-compliant adjustment applied':schedulerEvaluation.status==='blocked'?'Scheduler proposal rejected by SLA':'No eligible allocation change'}</span></div>
        <div className="mt-2 grid gap-2 sm:grid-cols-4"><div><span className="text-slate-400">Proposed shift</span><p className="font-semibold text-white">{(schedulerEvaluation.proposalMovement*100).toFixed(2)} pp</p></div><div><span className="text-slate-400">Applied before IQAE</span><p className="font-semibold text-white">{(schedulerEvaluation.appliedMovement*100).toFixed(2)} pp</p></div><div><span className="text-slate-400">Final shift vs engine</span><p className="font-semibold text-white">{schedulerFinalDelta.total.toFixed(2)} pp</p></div><div><span className="text-slate-400">Scheduler preference applied</span><p className="font-semibold text-white">{(schedulerEvaluation.strength*100).toFixed(2)}%</p></div></div>
        <p className="mt-2 text-slate-300">{riskDecision?.changed?'IQAE risk feedback subsequently modified the scheduled allocation.':override?'A manual override may also affect the final allocation.':'Final allocation reflects the scheduler subject to feasibility checks.'} Proposal and final change are measured relative to the selected engine allocation.</p>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-slate-300">{schedulerFinalDelta.top.map(item=><span key={item.id}>{item.id}: {item.change>=0?'+':''}{item.change.toFixed(2)} pp</span>)}</div>
      </section>}
      {view!=='overview'&&<div className="atlas-card px-5 py-4"><p className="text-xs font-bold uppercase tracking-widest text-emerald-200">Carbon Ledger · Quantum-classical controller</p><h1 className="mt-2 text-xl font-semibold capitalize">{view}</h1><p className="mt-2 text-xs leading-6 text-slate-300">{view==='analytics'?'Environmental trends, weather intelligence and modeled carbon impact across 20 regions.':view==='operations'?'Review controller decisions, telemetry quality and audit events.':view==='reports'?'Export allocation evidence, reports and explanations from the guarded hybrid controller.':view==='system'?'Monitor the application runtime, background activity and infrastructure health.':'Explore scenario details using the current controller settings.'} IBM Quantum validation is recorded separately in Benchmarks; live allocation uses local QAOA simulation and GLPK refinement.</p></div>}
      {error ? <div role="alert" className="rounded-xl border border-rose-400/20 bg-rose-400/5 px-3 py-2 text-xs text-rose-200">{error}</div> : null}

      <div className="grid gap-2"><DashboardSidebar/><div className="min-w-0 space-y-2">
        <div id="overview" className="min-w-0 space-y-2">

          {view==='overview'&&<>
          <section className="atlas-card flex flex-wrap items-center gap-2 p-2" aria-label="Optimization engine selection"><label htmlFor="dashboard-engine-mode" className="text-sm font-semibold text-white">Optimization engine</label><select id="dashboard-engine-mode" value={engineMode} onChange={e=>chooseEngine(e.target.value as EngineMode)} className="min-w-[280px] rounded-lg border border-emerald-400/40 bg-slate-900 px-3 py-2 text-sm font-medium text-white shadow-lg outline-none ring-0 focus:border-emerald-300" style={{colorScheme:'dark'}}><option style={{backgroundColor:'#f8fafc',color:'#0f172a'}} value="glpk">GLPK · classical reference</option><option style={{backgroundColor:'#f8fafc',color:'#0f172a'}} value="oracle">Quantum Oracle · 7q p=3</option><option style={{backgroundColor:'#f8fafc',color:'#0f172a'}} value="geometry-curved">Curvilinear Fusion · 10q p=3</option><option style={{backgroundColor:'#f8fafc',color:'#0f172a'}} value="geometry-grover">Adaptive Grover · 10q p=3</option><option style={{backgroundColor:'#f8fafc',color:'#0f172a'}} value="geometry">Geometry-Aware Quantum Walk · 10q p=3</option></select><span className="text-[11px] font-semibold text-emerald-200">Enterprise treasury capital: {budgetLabel(controls.budget_cr)} / year</span><span className="text-[11px] text-cyan-200">Settings auto-apply · adaptive Autopilot recomputes during operation</span><span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2 py-1 text-[11px] font-semibold text-emerald-100">{engineMode!=='glpk'?'CPU quantum-statevector simulation · no GLPK allocation fallback':'Classical GLPK · no quantum execution'}</span><span role="status" className="text-xs text-slate-400">{cooperativeBusy?'Updating quietly…':cooperativeActive?`Executed: ${executedEngine}`:cooperativeError?`Calculation failed: ${cooperativeError}`:'Awaiting result'}</span></section>
          {cooperativeActive && result && <QuantumRiskPanel engine={engineMode} weights={result.allocations.node_weights} carbon={result.carbon_avoided.blended_ci} latency={result.latency.weighted_network_ms} sla={appliedControls.sla_ms} scenarioKey={cooperativeKey} threshold={riskThreshold} onThresholdChange={setRiskThreshold} enabled={riskEnabled} onEnabledChange={setRiskEnabled} decision={riskDecision}/>}
          <section id="main-kpis" aria-label="Four main dashboard statistics" className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs">
              <p className="font-semibold text-emerald-100">Live optimization summary</p>
              <p role="status" aria-live="polite" className={showingPreviousKpis ? 'text-amber-200' : 'text-slate-400'}>
                {showingPreviousKpis
                  ? `Last completed: ${shownKpis?.engine ?? 'unknown'} · ${engineMode !== shownKpis?.engine ? `switching to ${engineMode}` : 'recalculating'}${autopilotActive ? ' · Autopilot running' : ''}`
                  : activeKpiSnapshot
                    ? `${engineMode} · ${autopilotActive ? 'Adaptive Autopilot · latest completed result' : kpiIsUpdating ? 'Last completed result · updating' : 'Completed engine result'}`
                    : 'Waiting for the first completed allocation'}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 xl:grid-cols-4" data-testid="main-dashboard-kpi-grid">
              <MetricCard title="Carbon intensity" value={shownKpis ? Math.round(shownKpis.carbonIntensity).toString() : '—'} unit="gCO₂/kWh" icon={Wind} accent="cyan" delta={shownKpis?.carbonShiftPct} badge={showingPreviousKpis ? 'Previous result' : kpiIsUpdating ? 'Updating · snapshot' : shownKpis ? 'Result snapshot' : 'Awaiting data'} sparkline={shownKpis?.carbonTrend ?? []} status={!shownKpis ? 'watch' : shownKpis.carbonIntensity < 350 ? 'good' : shownKpis.carbonIntensity < 550 ? 'watch' : 'bad'}/>
              <MetricCard title="Treasury APY (after offsets)" value={shownKpis?.netTreasuryApy == null ? '—' : shownKpis.netTreasuryApy.toFixed(2)} unit="%" icon={Landmark} accent="emerald" badge={shownKpis ? `Gross APY ${shownKpis.grossTreasuryApy.toFixed(2)}%` : 'Awaiting data'} sparkline={shownKpis?.treasuryTrend ?? []}/>
              <MetricCard title="Net footprint" value={shownKpis ? shownKpis.netFootprintMt.toFixed(2) : '—'} unit="MT/day" icon={Leaf} accent={shownKpis && shownKpis.netFootprintMt === 0 ? 'emerald' : 'amber'} badge={shownKpis ? `${shownKpis.offsetPct.toFixed(0)}% offset` : 'Awaiting data'} sparkline={shownKpis?.carbonTrend.map(v=>v*0.4) ?? []} status={shownKpis && shownKpis.netFootprintMt === 0 ? 'good' : 'watch'}/>
              <MetricCard title="Latency" value={shownKpis ? shownKpis.networkLatencyMs.toFixed(1) : '—'} unit="ms" icon={Gauge} accent={shownKpis && !shownKpis.latencySlaCompliant ? 'rose' : 'cyan'} badge={shownKpis ? shownKpis.latencySlaCompliant ? 'compliant' : 'breach' : 'Awaiting data'} detail={shownKpis?.surrogateGapPct != null ? `surrogate +${shownKpis.surrogateGapPct.toFixed(2)}%` : undefined} status={shownKpis && !shownKpis.latencySlaCompliant ? 'bad' : 'good'}/>
            </div>
          </section>
          <div role="status" aria-live="polite" className="atlas-card flex flex-wrap items-center gap-x-5 gap-y-1 px-3 py-2 text-xs text-slate-300"><span className="font-semibold text-cyan-200">{optimizationSource}</span><span>Data: {telemetrySourceLabel}</span>{(()=>{const top=Object.entries(result?.allocations.node_weights??{}).sort((a,b)=>b[1]-a[1])[0];return top&&top[1]>0?<span>Top region: <span className="text-white">{top[0]}</span> ({(top[1]*100).toFixed(0)}%)</span>:null;})()}</div>
          {engineMode.startsWith('geometry') && <p className="text-xs text-cyan-200">Selected 10-qubit research engine: four independent CPU statevector workers, depth p=3. Adaptive Grover prioritizes quality and speed; Curvilinear Fusion combines nonlinear evolution, XY mixing and adaptive Grover in two passes. Both independently generate capacity-feasible allocations and dashboard KPIs, with no GLPK-allocated fallback. Historical objective gaps are compared with SciPy HiGHS, not verified GLPK timings. Quantum advantage is not proven.</p>}
          {!cooperativeActive && <p role="status" className="text-xs text-slate-400">{cooperativeError?`Unable to calculate: ${cooperativeError}`:'Initializing engine; results will appear when ready.'}</p>}
          {autopilotActive && <p role="status" className="rounded-lg border border-cyan-400/20 bg-cyan-400/5 px-3 py-2 text-xs text-cyan-200">Adaptive Autopilot is continuously monitoring regional conditions. Controls, allocations and all four KPI values update in repeated, bounded solver cycles. Completed snapshots remain visible during each calculation. Stop Autopilot to hold the current settings.</p>}
          <section id="controller-settings" aria-label="Controls and allocation" className="grid min-w-0 gap-3 lg:grid-cols-2"><div className="min-w-0">
          <PanelErrorBoundary name="controls"><ControlPanel /></PanelErrorBoundary>
          <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={pinA} className="rounded-xl bg-white/5 px-3 py-2 text-xs text-slate-300"><Save className="mr-1 inline h-3.5 w-3.5"/>Pin A</button><button type="button" onClick={pinB} className="rounded-xl bg-cyan-400/10 px-3 py-2 text-xs text-cyan-200"><PlayCircle className="mr-1 inline h-3.5 w-3.5"/>Pin B</button></div>
          <div className="mt-3"><ScenarioCompare/></div>

        </div>
          <div className="min-w-0 space-y-3"><PanelErrorBoundary name="allocation"><AllocationEditor base={hybridResult} result={result} override={override} onChange={setOverride} controls={controls}/></PanelErrorBoundary><EventInjector/></div>
        </section>
          {cooperativeActive && <>
        <div id="region-atlas" className="atlas-card"><div className="atlas-card-head flex flex-wrap items-center justify-between gap-3"><div><h2 className="atlas-heading"><MapIcon className="h-4 w-4 text-emerald-400"/> Regions</h2></div><div className="inline-flex rounded-lg border border-emerald-500/20 bg-[#0a1d2a] p-1">{(['2d','3d'] as const).map(mode=><button key={mode} onClick={()=>setMapMode(mode)} className={`rounded-md px-3 py-1.5 text-xs font-medium ${mapMode===mode?'bg-emerald-500/20 text-emerald-200':'text-slate-400 hover:text-white'}`}>{mode==='2d'?'2D map':'3D globe'}</button>)}</div></div></div>
          <div className={'grid gap-2'}>{mapMode==='2d'&&<RegionMap2D nodes={globeNodes} selected={selectedId} onSelect={setSelectedRegion}/>} {mapMode==='3d'&&<PanelErrorBoundary name="globe"><Globe3D nodes={globeNodes} time={simulationTime} onSelect={setSelectedRegion}/></PanelErrorBoundary>}</div>

          <details className="atlas-card p-3"><summary className="cursor-pointer text-sm font-semibold text-slate-200">Regional carbon intelligence & historical trend</summary><div className="mt-3"><CarbonOverview nodes={globeNodes} time={simulationTime} onSelect={setSelectedRegion}/><TelemetryChart data={series} forecast={forecast} selected={selectedId ?? 'mumbai'} /><TimeScrubber/></div></details></> }</>}
          {view==='analytics'&&<><div className="atlas-card flex flex-wrap items-center justify-between gap-3 p-4"><div><p className="text-sm font-semibold text-emerald-200">Analytics, weather & forecasts</p><p className="text-xs text-slate-400">Live telemetry and atmospheric context here; historical forecasting tools in the linked research view.</p></div><a href="/tools/forecasts" className="rounded-lg border border-emerald-400/20 px-3 py-2 text-xs text-emerald-200">Forecasts</a></div><WeatherIntelligence telemetry={telemetry} selected={selectedId} onSelect={setSelectedRegion}/>
          <TrackerWorkspace telemetry={telemetry} result={result} time={simulationTime} feed={feed} onRegion={setSelectedRegion}/>
          <TelemetryChart data={series} forecast={forecast} selected={selectedId ?? 'mumbai'} />
          <PanelErrorBoundary name="scheduler"><WorkloadTable telemetry={telemetry} controls={controls}/></PanelErrorBoundary>
          <div className="grid gap-3 lg:grid-cols-2"><TreasurySankey result={result}/><FrontierChart data={mc}/></div>
          <div className="grid gap-3 lg:grid-cols-2"><SweepHeatmap telemetry={telemetry} controls={controls} onPick={(sla, tax) => useControllerStore.getState().setControls({ sla_ms: sla, carbon_tax: tax })}/><DriftMonitor gaps={gaps}/></div>
          <BudgetBurnDown budgetUsd={crToUsd(controls.budget_cr)} offsetPct={carbon?.offset_pct??0} carbonTax={controls.carbon_tax} blendedCi={carbon?.blended_ci??400}/>
          </>}
          {view==='operations'&&<><div id="decision-feed"><DecisionFeed entries={decisionLog}/></div>
          <TimeScrubber/></>}
        </div>

        <div className="min-w-0">
          {view==='overview'&&selectedId ? <RegionDrawer id={selectedId} result={result} carbonTax={controls.carbon_tax} hour={simulationTime.getUTCHours()} onClose={()=>setSelectedRegion(null)}/> : null}
          {view==='operations'&&<div id="data-quality" className="mt-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4"><div className="flex items-center gap-2"><Network className="h-4 w-4 text-cyan-300"/><h2 className="text-sm font-semibold">Data quality</h2></div><div className="mt-3 space-y-2">{quality.map(({id,report,score})=><div key={id} className="flex items-center justify-between gap-2 text-xs"><span className="truncate text-slate-400">{id}</span><span className="text-slate-500">{telemetry.find((t) => t.region === id)?.carbonStatus ?? (telemetry.find((t) => t.region === id)?.source === 'electricity-maps' ? 'Live' : telemetry.find((t) => t.region === id)?.source === 'stale' ? 'Cached' : 'Simulated')}</span><span className={report.quality==='good'?'text-emerald-300':report.quality==='watch'?'text-amber-300':'text-rose-300'}>{report.quality} · {score}%{report.spike?' · spike':''}{report.stale?' · stale':''}</span></div>)}</div></div>}
        </div>
        {view==='reports'&&<><FullReportExport/><div className="atlas-card flex flex-wrap gap-3 p-4"><p className="w-full text-sm font-bold">Benchmark evidence and research exports</p><a className="lab-button" href="/data/ibm-hardware-v93.json" download>IBM hardware evidence JSON</a><a className="lab-button" href="/data/engines-v92.json" download>Four-engine timing evidence</a><a className="lab-button" href="/data/quality-v93.json" download>Allocation quality audit</a></div></>}
        {view==='system'&&<SystemStats/>}
        </div>
      </div>


      
      {view==='operations'&&<div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 p-2 text-xs"><button type="button" onClick={() => void verifyAuditChain(readAuditChain()).then(v => setAuditStatus(v.valid ? `Verified ${v.index} records` : `Log changed at record ${v.index}`)).catch(() => setAuditStatus('Verification unavailable'))} className="rounded-lg bg-teal-900 px-3 py-2 text-teal-100 focus-visible:outline focus-visible:outline-2">Verify decision log</button><span role="status" className="text-slate-300">{auditStatus || 'Checks that the decision log has not been changed'}</span></div>}
      <div className="flex justify-end px-1"><button type="button" onClick={()=>void snapshot()} className="inline-flex items-center gap-1 rounded-lg bg-white/5 px-3 py-1.5 text-xs text-slate-300"><Camera className="h-3.5 w-3.5"/>Save snapshot</button></div>
    </main>
  </div></MotionConfig>;
}
