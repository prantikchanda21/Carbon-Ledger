'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import ExplainButton from '@/components/ExplainButton';
import { MotionConfig } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Gauge, Landmark, Leaf, Network, ShieldCheck, Wind, Camera, Save, PlayCircle } from 'lucide-react';
import { toPng } from 'html-to-image';
import { toast } from 'sonner';
import CommandBar from '@/components/CommandBar';
import ControlPanel from '@/components/ControlPanel';
import DashboardHeader, { type SystemStatus } from '@/components/DashboardHeader';
import MetricCard from '@/components/MetricCard';
import TelemetryChart from '@/components/TelemetryChart';
import PanelErrorBoundary from '@/components/PanelErrorBoundary';
import TimeScrubber from '@/components/TimeScrubber';
import EventInjector from '@/components/EventInjector';
import WorkloadTable from '@/components/WorkloadTable';
import EngineRace from '@/components/EngineRace';
import ScenarioCompare from '@/components/ScenarioCompare';
import AllocationEditor from '@/components/AllocationEditor';
import TreasurySankey from '@/components/TreasurySankey';
import FrontierChart from '@/components/FrontierChart';
import SweepHeatmap from '@/components/SweepHeatmap';
import DecisionFeed from '@/components/DecisionFeed';
import DriftMonitor from '@/components/DriftMonitor';
import RegionDrawer from '@/components/RegionDrawer';
import BudgetBurnDown from '@/components/BudgetBurnDown';
import QuantumController from '@/components/QuantumController';
import { useControllerStore } from '@/lib/store';
import { carbonAt, generateTelemetry, generate24hSeries, hourOfDayUtc, simulatedFeedHealthAt } from '@/lib/mockData';
import { forecast24h } from '@/lib/forecast';
import { activeEvents, injectEvent } from '@/lib/events';
import { requestOptimization, loadTelemetry } from '@/lib/controllerClient';
import { assessFeedQuality } from '@/lib/anomaly';
import { SimulationClock } from '@/lib/simClock';
import { appendDecisionLog, readDecisionLog } from '@/lib/decisionLog';
import { simulateCarbonFutures } from '@/lib/monteCarlo';
import { EVALUATION_DEBOUNCE_MS } from '@/lib/constants';
import type { OptimizationResult, RegionId, Scenario } from '@/lib/types';
import { REGIONS } from '@/lib/regions';
import { applyOverride } from '@/lib/override';

const Globe3D = dynamic(() => import('@/components/Globe3D'), {
  ssr: false,
  loading: () => <div className="grid min-h-[440px] place-items-center rounded-2xl border border-white/10 bg-slate-950/80 text-sm text-slate-600">Loading globe mesh…</div>,
});

const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

export default function DashboardPage() {
  const controls = useControllerStore((s) => s.controls);
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

  const result = useMemo(() => optimizerResult && override ? applyOverride(optimizerResult, override, { budget_cr: controls.budget_cr, carbon_tax: controls.carbon_tax }) : optimizerResult, [optimizerResult, override, controls.budget_cr, controls.carbon_tax]);
  const [feed, setFeed] = useState('boot');
  // Drop a pinned override if none of its regions are eligible any more (e.g. after tightening SLA or enabling DPDP).
  useEffect(() => {
    if (override && optimizerResult && !result?.manual_override) {
      setOverride(null);
      toast.info('Manual allocation cleared: none of its regions are eligible under the current constraints', { id: 'override-cleared' });
    }
  }, [override, optimizerResult, result, setOverride]);

  const [error, setError] = useState<string | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [forecast, setForecast] = useState(() => forecast24h(simulationTime));
  const [gaps, setGaps] = useState<number[]>([]);
  const [activeMobileTab, setActiveMobileTab] = useState<'controls'|'regions'|'analytics'>('analytics');
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
    const budget = parseBounded('budget', 10, 100);
    useControllerStore.getState().setControls({
      ...(sla === null ? {} : { sla_ms: Math.round(sla) }),
      ...(tax === null ? {} : { carbon_tax: Number(tax.toFixed(2)) }),
      ...(budget === null ? {} : { budget_cr: Math.round(budget) }),
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
      t: simulationTime.toISOString().slice(0, 13),
      c: controls, e: ui.chaosMode, s: ui.shadowMode,
      telemetry: telemetry.map((n) => [n.region, n.carbon_ci, n.energy_price, n.latency_ms, n.available]),
    });
  }, [simulationTime, controls, ui.chaosMode, ui.shadowMode, telemetry]);

  useEffect(() => {
    historicalTimeRef.current = Math.abs(Date.now() - simulationTime.getTime()) > 15 * 60 * 1000;
    const clockBase = generateTelemetry(simulationTime, controls.dpdp_locked, true);
    const adjusted = activeEvents(events, simulationTime.getTime()).length
      ? activeEvents(events, simulationTime.getTime()).reduce((current, event) => injectEvent(event, current, simulationTime.getTime(), controls.carbon_tax), clockBase)
      : clockBase;
    setTelemetry(adjusted);
    setForecast(forecast24h(simulationTime));
  }, [simulationTime, events, controls.dpdp_locked, controls.carbon_tax, setTelemetry]);

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
      }, 5000);
    };
    const connect = (): void => {
      if (stopped) return;
      es = new EventSource('/api/stream');
      es.onopen = () => { stopPolling(); setFeed('stream'); retry = 1000; };
      es.addEventListener('telemetry', (event) => {
        try {
          const payload = JSON.parse((event as MessageEvent).data) as { telemetry: typeof telemetry };
          const current = useControllerStore.getState();
          const closeToNow = Math.abs(Date.now() - current.simulationTime.getTime()) < 15 * 60 * 1000;
          if (!current.playing && closeToNow && !historicalTimeRef.current) {
            setTelemetry(payload.telemetry);
            setFeed('stream');
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
    if (!telemetry.length) return;
    const controller = new AbortController();
    const key = evaluationHash();
    const cached = cache.current.get(key);
    if (cached) { setResult(cached); setEvaluating(false); return () => controller.abort(); }
    setEvaluating(true);
    const timer = window.setTimeout(() => {
      void requestOptimization({
        telemetry,
        sla_ms: controls.sla_ms,
        carbon_tax: controls.carbon_tax,
        budget_cr: controls.budget_cr,
        treasury_yield: 6.8,
        dpdp_locked: controls.dpdp_locked,
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
        if (controls.dpdp_locked) reasonCodes.push('DPDP');
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
          if (controls.dpdp_locked && !next.compliance.residency_ok) toast.error('Residency violation', { id: 'dpdp' });
          if (carbonSpike) toast.warning('Carbon spike detected', { id: 'carbon-spike', description: `${Math.round(next.carbon_avoided.blended_ci)} gCO₂/kWh at the active allocation` });
        }
      }).catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setError(reason instanceof Error ? reason.message : 'Controller error'); setEvaluating(false);
      });
    }, EVALUATION_DEBOUNCE_MS);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [telemetry, controls, ui.shadowMode, ui.chaosMode, simulationTime, events, setResult, addDecision, ui.muted, evaluationHash]);

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === '?') setUI({ shortcutOpen: !useControllerStore.getState().ui.shortcutOpen });
      if (e.key === '1') useControllerStore.getState().setControls({sla_ms:20,carbon_tax:0.8,budget_cr:60,dpdp_locked:true});
      if (e.key === '2') useControllerStore.getState().setControls({sla_ms:45,carbon_tax:0.95,budget_cr:75,dpdp_locked:false});
      if (e.key === '3') useControllerStore.getState().setControls({sla_ms:70,carbon_tax:0.1,budget_cr:40,dpdp_locked:false});
    };
    window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler);
  }, [setUI]);

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('sla', String(controls.sla_ms));
    url.searchParams.set('tax', controls.carbon_tax.toFixed(2));
    url.searchParams.set('budget', String(controls.budget_cr));
    url.searchParams.set('dpdp', controls.dpdp_locked ? '1' : '0');
    url.searchParams.set('t', simulationTime.toISOString());
    if (useControllerStore.getState().scenarioA) url.searchParams.set('a', '1');
    if (useControllerStore.getState().scenarioB) url.searchParams.set('b', '1');
    window.history.replaceState({}, '', url);
  }, [controls, simulationTime]);

  useEffect(() => {
    if (!ui.presenterMode) return;
    const presets = [
      {sla_ms:20,carbon_tax:0.8,budget_cr:60,dpdp_locked:true},
      {sla_ms:45,carbon_tax:0.95,budget_cr:75,dpdp_locked:false},
      {sla_ms:70,carbon_tax:0.1,budget_cr:40,dpdp_locked:false},
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
  const status: SystemStatus = result ? (error ? 'error' : result.engine) : 'loading';
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
  const formatInr = (n:number) => `₹${inr.format(n)}`;

  return <MotionConfig reducedMotion="user"><div id="dashboard-canvas" className="mx-auto min-h-screen max-w-[1700px] px-3 py-3 sm:px-5">
    <CommandBar />
    <main className="mt-3 space-y-3">
      <DashboardHeader status={status} />
      <Link href="/experiments" className="flex items-center justify-between rounded-xl border border-cyan-300/25 bg-cyan-300/5 px-4 py-3 text-sm text-cyan-100"><span><strong>Open experiment workspace</strong><span className="ml-3 hidden text-xs text-slate-400 sm:inline">Savings · scheduling · replay · forecasts · benchmarks · reports</span></span><span>→</span></Link>
      <PanelErrorBoundary name="explain"><ExplainButton telemetry={telemetry} controls={controls} result={result} events={events} decisions={decisionLog} time={simulationTime} /></PanelErrorBoundary>
      {error ? <div role="alert" className="rounded-xl border border-rose-400/20 bg-rose-400/5 px-3 py-2 text-xs text-rose-200">{error}</div> : null}

      <div className="grid gap-3 xl:grid-cols-[270px_minmax(0,1fr)_330px]">
        <div className={activeMobileTab==='controls'?'fixed inset-x-2 bottom-20 z-30 max-h-[70vh] overflow-auto rounded-2xl bg-slate-950/95 p-1 shadow-2xl xl:static xl:max-h-none xl:overflow-visible xl:rounded-none xl:bg-transparent xl:p-0':'hidden xl:block'}>
          <PanelErrorBoundary name="controls"><ControlPanel /></PanelErrorBoundary>
          <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={pinA} className="rounded-xl bg-white/5 px-3 py-2 text-xs text-slate-300"><Save className="mr-1 inline h-3.5 w-3.5"/>Pin A</button><button type="button" onClick={pinB} className="rounded-xl bg-cyan-400/10 px-3 py-2 text-xs text-cyan-200"><PlayCircle className="mr-1 inline h-3.5 w-3.5"/>Pin B</button></div>
          <div className="mt-3 space-y-3"><EventInjector/><EngineRace result={result}/></div>
        </div>

        <div className={activeMobileTab==='analytics' ? 'min-w-0 space-y-3 block' : 'hidden xl:block min-w-0 space-y-3'}>
          <QuantumController telemetry={telemetry} controls={controls} result={result}/>
          <div className="grid gap-2 grid-cols-2 xl:grid-cols-4">
            <MetricCard title="Grid carbon index" value={carbon?Math.round(carbon.blended_ci).toString():'—'} unit="gCO₂/kWh" icon={Wind} accent="cyan" delta={carbon?.ci_shift_pct} badge={evaluating?'evaluating…':feed} sparkline={series.map(s=>s.blended)} status={carbon&&carbon.blended_ci<350?'good':carbon&&carbon.blended_ci<550?'watch':'bad'}/>
            <MetricCard title="Treasury APY" value={treasury?treasury.projected_apy.toFixed(2):'—'} unit="%" icon={Landmark} accent="emerald" badge={treasury?formatInr(result!.treasury_income_inr):undefined} sparkline={series.map(s=>s.apy)} />
            <MetricCard title="Net footprint" value={carbon?carbon.net_footprint_mt.toFixed(2):'—'} unit="MT/day" icon={Leaf} accent={carbon&&carbon.net_footprint_mt===0?'emerald':'amber'} badge={carbon?`${carbon.offset_pct.toFixed(0)}% offset`:undefined} sparkline={series.map(s=>s.blended*0.4)} status={carbon&&carbon.net_footprint_mt===0?'good':'watch'}/>
            <MetricCard title="SLA status" value={result?result.latency.weighted_network_ms.toFixed(1):'—'} unit="ms" icon={Gauge} accent={result&&!result.latency.sla_compliant?'rose':'cyan'} badge={result?(result.latency.sla_compliant?'compliant':'breach'):undefined} detail={result?.shadow?.available?`surrogate +${result.shadow.cost_gap_pct.toFixed(2)}%`:undefined} status={result&&!result.latency.sla_compliant?'bad':'good'}/>
          </div>
          <PanelErrorBoundary name="globe"><Globe3D nodes={globeNodes} time={simulationTime} onSelect={setSelectedRegion}/></PanelErrorBoundary>
          <TelemetryChart data={series} forecast={forecast} selected={selectedId ?? 'mumbai'} />
          <div className="grid gap-3 lg:grid-cols-2"><PanelErrorBoundary name="scheduler"><WorkloadTable telemetry={telemetry} controls={controls}/></PanelErrorBoundary><ScenarioCompare/></div>
          <div className="grid gap-3 lg:grid-cols-2"><TreasurySankey result={result}/><FrontierChart data={mc}/></div>
          <div className="grid gap-3 lg:grid-cols-2"><SweepHeatmap telemetry={telemetry} controls={controls} onPick={(sla, tax) => useControllerStore.getState().setControls({ sla_ms: sla, carbon_tax: tax })}/><DriftMonitor gaps={gaps}/></div>
          <BudgetBurnDown budgetCr={controls.budget_cr} offsetPct={carbon?.offset_pct??0} carbonTax={controls.carbon_tax} blendedCi={carbon?.blended_ci??400}/>
          <DecisionFeed entries={decisionLog}/>
          <TimeScrubber/>
        </div>

        <div className={activeMobileTab==='regions'?'block':'hidden xl:block'}>
          {selectedId ? <RegionDrawer id={selectedId} result={result} carbonTax={controls.carbon_tax} hour={simulationTime.getUTCHours()} onClose={()=>setSelectedRegion(null)}/> : <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-xs text-slate-600">Click a globe pin to open its region drawer.</div>}
          <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4"><div className="flex items-center gap-2"><Network className="h-4 w-4 text-cyan-300"/><h2 className="text-sm font-semibold">Data quality</h2></div><div className="mt-3 space-y-2">{quality.map(({id,report,score})=><div key={id} className="flex items-center justify-between gap-2 text-xs"><span className="truncate text-slate-400">{id}</span><span className="text-slate-500">{telemetry.find((t) => t.region === id)?.source === 'electricity-maps' ? 'live' : 'simulation'}</span><span className={report.quality==='good'?'text-emerald-300':report.quality==='watch'?'text-amber-300':'text-rose-300'}>{report.quality} · {score}%{report.spike?' · spike':''}{report.stale?' · stale':''}</span></div>)}</div></div>
          <div className="mt-3"><AllocationEditor base={optimizerResult} result={result} override={override} onChange={setOverride}/></div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-slate-950/90 p-1 xl:hidden">
        {(['controls','regions','analytics'] as const).map((tab)=><button key={tab} type="button" onClick={()=>setActiveMobileTab(tab)} className={activeMobileTab===tab?'rounded-xl bg-cyan-400/10 py-2 text-xs text-cyan-200':'rounded-xl py-2 text-xs text-slate-500'}>{tab}</button>)}
      </div>
      <div className="flex flex-wrap items-center gap-2 px-1 text-[10px] text-slate-600"><span>Feed: {feed}</span><span>Time: {simulationTime.toISOString()}</span><span>{activeEvents(events,simulationTime.getTime()).length} active event(s)</span>{result?.shadow?.available?<span>surrogate within {result.shadow.cost_gap_pct.toFixed(2)}% of optimal</span>:null}<button type="button" onClick={()=>void snapshot()} className="ml-auto inline-flex items-center gap-1 rounded-lg bg-white/5 px-2 py-1 text-slate-400"><Camera className="h-3 w-3"/>Snapshot PNG/PDF</button><span className="inline-flex items-center gap-1"><ShieldCheck className="h-3 w-3"/>20-region · Qiskit live path</span></div>
    </main>
  </div></MotionConfig>;
}
