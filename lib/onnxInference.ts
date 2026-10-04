import { access } from 'node:fs/promises';
import path from 'node:path';
import type { InferenceSession } from 'onnxruntime-node';
import type { PolicyFeatures } from './types.ts';
import type { OnnxPolicyOutput } from './optimizer.ts';

type OrtModule = typeof import('onnxruntime-node');

interface LoadedModel {
  ort: OrtModule;
  session: InferenceSession;
  init_ms: number;
}

const FAILURE_COOLDOWN_MS = 30_000;

let loading: Promise<LoadedModel> | null = null;
let lastFailure: { at: number; message: string } | null = null;
let reportedInit = false;

/** Resolved safely against the project root; bundled via outputFileTracingIncludes. */
export function modelPath(): string {
  return path.join(process.cwd(), 'public/models/quantum_controller.onnx');
}

async function loadModel(): Promise<LoadedModel> {
  const started = performance.now();
  const file = modelPath();
  await access(file);
  // Dynamic import so a native-binding failure is catchable and triggers the glpk.js fallback.
  const ort = await import('onnxruntime-node');
  const session = await ort.InferenceSession.create(file, {
    executionProviders: ['cpu'],
    graphOptimizationLevel: 'all',
    intraOpNumThreads: 1,
    interOpNumThreads: 1,
  });
  return { ort, session, init_ms: performance.now() - started };
}

async function getModel(): Promise<LoadedModel> {
  if (lastFailure !== null && Date.now() - lastFailure.at < FAILURE_COOLDOWN_MS) {
    throw new Error(lastFailure.message);
  }
  if (loading === null) {
    loading = loadModel().catch((error: unknown) => {
      loading = null;
      const message = error instanceof Error ? error.message : String(error);
      lastFailure = { at: Date.now(), message };
      throw error;
    });
  }
  return loading;
}

/**
 * Runs the QAOA surrogate policy.
 * v3 input tensor [1, 84]: 20 regions × [carbon, price, latency, egress] + [yield, carbon tax, SLA, budget].
 * Legacy 4-element inputs remain supported by callers that do not provide model_input.
 * v3 output tensor [1, 21]: 20 region logits followed by one hedge logit.
 * Legacy 4-element output [mumbai, frankfurt, virginia, hedge] is also accepted.
 */
export async function runOnnxPolicy(features: PolicyFeatures): Promise<OnnxPolicyOutput> {
  const { ort, session, init_ms } = await getModel();
  const featureVector = features.model_input ?? [features.carbon_intensity, features.energy_price, features.treasury_yield, features.latency_sla];
  const input = new ort.Tensor('float32', Float32Array.from(featureVector), [1, featureVector.length]);

  const started = performance.now();
  const outputs = await session.run({ [session.inputNames[0]]: input });
  const execution_ms = performance.now() - started;

  const tensor = outputs[session.outputNames[0]];
  const data = Array.from(tensor.data as Float32Array);
  if ((data.length !== 4 && data.length !== 21) || data.some((v) => !Number.isFinite(v))) {
    throw new Error(`Unexpected policy output: expected 4 or 21 finite values, got ${data.length}`);
  }

  const regionLogits = data.length === 21 ? data.slice(0, 20) : data.slice(0, 3);
  const hedgeLogit = data.length === 21 ? data[20]! : data[3]!;
  const stable = regionLogits.map((v) => Math.max(-20, Math.min(20, v)));
  const max = Math.max(...stable);
  const exp = stable.map((v) => Math.exp(v - max));
  const total = exp.reduce((a, b) => a + b, 0) || 1;
  const weights = exp.map((v) => v / total);
  const hedge = 1 / (1 + Math.exp(-Math.max(-20, Math.min(20, hedgeLogit))));

  const reportInit = !reportedInit;
  reportedInit = true;
  return {
    raw_weights: weights,
    hedge_fraction: hedge,
    execution_ms,
    init_ms: reportInit ? init_ms : 0,
  };
}
