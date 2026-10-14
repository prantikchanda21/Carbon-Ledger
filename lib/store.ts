'use client';

import { create } from 'zustand';
import type { ControlState, ControllerEvent, DecisionLogEntry, GridNodeTelemetry, OptimizationResult, RegionId, Scenario } from './types.ts';
import { generateTelemetry } from './mockData.ts';

interface UIFlags {
  controlsOpen: boolean;
  drawerOpen: boolean;
  shortcutOpen: boolean;
  presenterMode: boolean;
  muted: boolean;
  chaosMode: 'none' | 'onnx' | 'both';
  shadowMode: boolean;
}

interface ControllerStore {
  controls: ControlState;
  telemetry: GridNodeTelemetry[];
  result: OptimizationResult | null;
  simulationTime: Date;
  simSpeed: number;
  playing: boolean;
  events: ControllerEvent[];
  scenarioA: Scenario | null;
  scenarioB: Scenario | null;
  decisionLog: DecisionLogEntry[];
  selectedRegion: RegionId | null;
  override: Record<RegionId, number> | null;
  ui: UIFlags;
  setControls: (controls: Partial<ControlState>) => void;
  setTelemetry: (telemetry: GridNodeTelemetry[]) => void;
  setResult: (result: OptimizationResult | null) => void;
  setSimulation: (time: Date, speed: number, playing: boolean) => void;
  addEvent: (event: ControllerEvent) => void;
  removeEvent: (id: string) => void;
  setScenarioA: (scenario: Scenario | null) => void;
  setScenarioB: (scenario: Scenario | null) => void;
  addDecision: (entry: DecisionLogEntry) => void;
  hydrateDecisionLog: (entries: DecisionLogEntry[]) => void;
  setSelectedRegion: (id: RegionId | null) => void;
  setUI: (patch: Partial<UIFlags>) => void;
  setOverride: (weights: Record<RegionId, number> | null) => void;
}

const now = new Date();

export const useControllerStore = create<ControllerStore>((set) => ({
  controls: { sla_ms: 25, carbon_tax: 0.5, budget_cr: 50, dpdp_locked: false },
  telemetry: generateTelemetry(now, false, true),
  result: null,
  simulationTime: now,
  simSpeed: 1440,
  playing: false,
  events: [],
  scenarioA: null,
  scenarioB: null,
  decisionLog: [],
  selectedRegion: null,
  override: null,
  ui: { controlsOpen: true, drawerOpen: false, shortcutOpen: false, presenterMode: false, muted: false, chaosMode: 'none', shadowMode: true },
  setControls: (controls) => set((state) => ({ controls: { ...state.controls, ...controls } })),
  setTelemetry: (telemetry) => set({ telemetry }),
  setResult: (result) => set({ result }),
  setSimulation: (time, speed, playing) => set({ simulationTime: new Date(time), simSpeed: speed, playing }),
  addEvent: (event) => set((state) => ({ events: [...state.events.filter((e) => e.id !== event.id), event] })),
  removeEvent: (id) => set((state) => ({ events: state.events.filter((e) => e.id !== id) })),
  setScenarioA: (scenario) => set({ scenarioA: scenario }),
  setScenarioB: (scenario) => set({ scenarioB: scenario }),
  addDecision: (entry) => set((state) => ({ decisionLog: [entry, ...state.decisionLog.filter((item) => item.id !== entry.id)].slice(0, 500) })),
  hydrateDecisionLog: (entries) => set({ decisionLog: entries.slice(0, 500) }),
  setSelectedRegion: (id) => set((state) => ({ selectedRegion: id, ui: { ...state.ui, drawerOpen: Boolean(id) } })),
  setOverride: (override) => set({ override }),
  setUI: (patch) => set((state) => ({ ui: { ...state.ui, ...patch } })),
}));
