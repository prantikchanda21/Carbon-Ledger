import { workloadBenchmark, type QaoaOptions } from '../lib/lab/workloadQuantum';
import type { LabInput } from '../lib/lab/types';
type Job = { input: LabInput; options: QaoaOptions; id: number };
self.onmessage = (event: MessageEvent<Job>) => {
  const {input, options, id} = event.data;
  try { self.postMessage({id, result: workloadBenchmark(input, options)}); }
  catch (error) { self.postMessage({id, error: error instanceof Error ? error.message : 'Optimization failed'}); }
};
