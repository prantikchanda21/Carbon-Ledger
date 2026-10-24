export type QuantumExecutionPreferences = { maxQubits: number; memoryGb: number; executionMode: 'auto' | 'local' | 'cloud'; cloudBackend: 'auto' | 'cpu' | 'gpu' };
export const QUANTUM_EXECUTION_KEY = 'carbon-ledger:quantum-execution-v1';
export const QUANTUM_EXECUTION_EVENT = 'carbon-ledger:quantum-execution-changed';
export const defaultQuantumExecution: QuantumExecutionPreferences = { maxQubits: 5, memoryGb: 8, executionMode: 'auto', cloudBackend: 'auto' };
export function readQuantumExecution(): QuantumExecutionPreferences {
  if (typeof window === 'undefined') return defaultQuantumExecution;
  try { const raw = JSON.parse(localStorage.getItem(QUANTUM_EXECUTION_KEY) || '{}');
    const maxQubits = Math.max(1, Math.min(5, Math.floor(Number(raw.maxQubits) || 5)));
    const memoryGb = [2,4,8,16,32].includes(Number(raw.memoryGb)) ? Number(raw.memoryGb) : 8;
    const executionMode: QuantumExecutionPreferences['executionMode'] = ['auto','local','cloud'].includes(raw.executionMode) ? raw.executionMode : 'auto';
    const cloudBackend: QuantumExecutionPreferences['cloudBackend'] = ['auto','cpu','gpu'].includes(raw.cloudBackend) ? raw.cloudBackend : 'auto';
    return { maxQubits, memoryGb, executionMode, cloudBackend };
  } catch { return defaultQuantumExecution; }
}
export function writeQuantumExecution(value: QuantumExecutionPreferences) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(QUANTUM_EXECUTION_KEY, JSON.stringify(value)); } catch { /* Local storage may be disabled. */ }
  window.dispatchEvent(new Event(QUANTUM_EXECUTION_EVENT));
}
