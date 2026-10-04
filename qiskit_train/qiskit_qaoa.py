"""Qiskit QAOA label generator for the 20-region controller.

The bundled ONNX artifact was generated in this sandbox with the mathematically
matched encoded reference teacher because Qiskit is not installed here. Running
this module locally with the requirements file switches the label generation to
actual Qiskit QAOA circuits.
"""
from __future__ import annotations

import argparse
import math
from pathlib import Path

import numpy as np
from qiskit.circuit.library import QAOAAnsatz
from qiskit.quantum_info import Operator, Statevector, SparsePauliOp

from .qaoa_reference import CANDIDATES, N_REGIONS, Scenario, candidate_indices, encode_features, node_cost, scenario as make_scenario


def build_cost_operator(candidate_costs: np.ndarray, hedge_cost: float) -> SparsePauliOp:
    n = len(candidate_costs) + 1
    dim = 2 ** n
    diagonal = np.zeros(dim, dtype=float)
    for basis in range(dim):
        bits = np.array([(basis >> q) & 1 for q in range(n)], dtype=int)
        selected = int(bits[: len(candidate_costs)].sum())
        penalty = 8.0 * (selected - 1) ** 2
        diagonal[basis] = float(bits[:len(candidate_costs)] @ candidate_costs) + float(bits[-1] * hedge_cost) + penalty
    matrix = np.diag(diagonal)
    return SparsePauliOp.from_operator(Operator(matrix))


def qaoa_label(s: Scenario, gamma_points: int = 7, beta_points: int = 7) -> tuple[np.ndarray, float, np.ndarray]:
    candidates = candidate_indices(s)
    costs = node_cost(s)[candidates]
    hedge_cost = 0.12 - 0.03 * max(0.0, s.treasury_yield - 7.0) + 0.025 * s.carbon_tax
    operator = build_cost_operator(costs, hedge_cost)
    circuit = QAOAAnsatz(cost_operator=operator, reps=1, flatten=True)
    params = list(circuit.parameters)
    if len(params) != 2:
        raise RuntimeError(f'Expected two QAOA parameters at p=1, got {len(params)}')
    beta_param = next((p for p in params if str(p).startswith('β') or str(p).lower().startswith('beta')), params[0])
    gamma_param = next((p for p in params if str(p).startswith('γ') or str(p).lower().startswith('gamma')), params[1])
    best_expectation = float('inf')
    best_state: Statevector | None = None
    for beta in np.linspace(-math.pi, math.pi, beta_points):
        for gamma in np.linspace(-math.pi, math.pi, gamma_points):
            bound = circuit.assign_parameters({beta_param: beta, gamma_param: gamma}, inplace=False)
            state = Statevector.from_instruction(bound)
            probs = np.abs(state.data) ** 2
            expectation = float(np.dot(probs, np.diag(operator.to_matrix()).real))
            if expectation < best_expectation:
                best_expectation = expectation
                best_state = state
    if best_state is None:
        raise RuntimeError('QAOA parameter search failed')

    probs = np.abs(best_state.data) ** 2
    weights = np.zeros(N_REGIONS, dtype=np.float32)
    hedge = 0.0
    for basis, probability in enumerate(probs):
        bits = np.array([(basis >> q) & 1 for q in range(CANDIDATES + 1)], dtype=int)
        if int(bits[:CANDIDATES].sum()) != 1:
            continue
        region_idx = int(np.flatnonzero(bits[:CANDIDATES])[0])
        weights[candidates[region_idx]] += float(probability)
        hedge += float(probability * bits[-1])
    total = float(weights.sum())
    weights /= max(total, 1e-9)
    return weights, float(hedge), candidates


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('--samples', type=int, default=32)
    ap.add_argument('--seed', type=int, default=20261004)
    ap.add_argument('--output', type=Path, default=Path('qiskit_train/artifacts/qiskit_labels.jsonl'))
    args = ap.parse_args()
    rng = np.random.default_rng(args.seed)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open('w', encoding='utf-8') as f:
        for i in range(args.samples):
            scenario = make_scenario(rng)
            weights, hedge, candidates = qaoa_label(scenario)
            f.write(json.dumps({'features': encode_features(scenario).tolist(), 'weights': weights.tolist(), 'hedge': hedge, 'candidate_indices': candidates.tolist()}) + '\n')
    print(f'Wrote {args.samples} actual-Qiskit QAOA labels to {args.output}')

if __name__ == '__main__':
    main()
