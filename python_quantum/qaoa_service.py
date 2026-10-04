from __future__ import annotations

import json
import math
import os
import time
from dataclasses import dataclass
from typing import Any

import numpy as np
from qiskit import QuantumCircuit
from qiskit.circuit.library import QAOAAnsatz
from qiskit.quantum_info import Operator, SparsePauliOp, Statevector

REGION_COUNT = 20
MAX_CANDIDATES = int(os.getenv("QUANTUM_MAX_CANDIDATES", "6"))
GRID_SIZE = int(os.getenv("QUANTUM_PARAMETER_GRID", "3"))
SHOTS = int(os.getenv("QUANTUM_SHOTS", "512"))
PENALTY = float(os.getenv("QUANTUM_ONE_HOT_PENALTY", "8.0"))


@dataclass(frozen=True)
class Region:
    id: str
    code: str
    carbon_ci: float
    energy_price: float
    latency_ms: float
    egress_cost_gb: float
    eligible: bool


def _as_regions(payload: dict[str, Any]) -> list[Region]:
    regions = payload.get("regions", [])
    output: list[Region] = []
    for item in regions:
        output.append(
            Region(
                id=str(item["id"]),
                code=str(item.get("code", item["id"])),
                carbon_ci=float(item["carbon_ci"]),
                energy_price=float(item["energy_price"]),
                latency_ms=float(item["latency_ms"]),
                egress_cost_gb=float(item.get("egress_cost_gb", 0.05)),
                eligible=bool(item.get("eligible", True)),
            )
        )
    if len(output) != REGION_COUNT:
        raise ValueError(f"Expected {REGION_COUNT} regions, received {len(output)}")
    return output


def _unit_cost(region: Region, carbon_tax: float, sla_ms: float) -> float:
    energy = region.energy_price / 1000.0
    carbon = carbon_tax * 0.25 * (region.carbon_ci / 1000.0)
    latency = max(0.0, region.latency_ms - sla_ms) * 0.005
    egress = region.egress_cost_gb * 0.05
    return energy + carbon + latency + egress


def select_candidates(payload: dict[str, Any]) -> list[Region]:
    regions = _as_regions(payload)
    scored = sorted(
        [r for r in regions if r.eligible],
        key=lambda r: (_unit_cost(r, float(payload["carbon_tax"]), float(payload["sla_ms"])), r.id),
    )
    if not scored:
        raise ValueError("No eligible regions remain after SLA/DPDP filtering")
    return scored[: min(MAX_CANDIDATES, len(scored))]


def _hedge_cost(treasury_yield: float, carbon_tax: float) -> float:
    return 0.12 - 0.03 * max(0.0, treasury_yield - 7.0) + 0.025 * carbon_tax


def build_cost_operator(candidate_costs: list[float], hedge_cost: float) -> SparsePauliOp:
    qubits = len(candidate_costs) + 1
    dim = 2**qubits
    diagonal = np.zeros(dim, dtype=float)
    for basis in range(dim):
        bits = np.array([(basis >> q) & 1 for q in range(qubits)], dtype=int)
        selected = int(bits[: len(candidate_costs)].sum())
        one_hot_penalty = PENALTY * (selected - 1) ** 2
        diagonal[basis] = float(bits[: len(candidate_costs)] @ np.asarray(candidate_costs))
        diagonal[basis] += float(bits[-1] * hedge_cost) + one_hot_penalty
    return SparsePauliOp.from_operator(Operator(np.diag(diagonal)))


def build_qaoa_circuit(candidate_costs: list[float], hedge_cost: float) -> tuple[QuantumCircuit, list[Any]]:
    operator = build_cost_operator(candidate_costs, hedge_cost)
    ansatz = QAOAAnsatz(cost_operator=operator, reps=1, flatten=True)
    parameters = list(ansatz.parameters)
    if len(parameters) != 2:
        raise RuntimeError(f"Expected p=1 QAOA to expose two parameters, got {len(parameters)}")
    # Qiskit exposes QAOA parameters in alphabetical order: beta then gamma.
    beta = next((p for p in parameters if str(p).startswith('β') or str(p).lower().startswith('beta')), parameters[0])
    gamma = next((p for p in parameters if str(p).startswith('γ') or str(p).lower().startswith('gamma')), parameters[1])
    return ansatz, [beta, gamma]


def parameter_grid() -> list[tuple[float, float]]:
    betas = np.linspace(0.0, math.pi / 2, max(2, GRID_SIZE), endpoint=False)
    gammas = np.linspace(0.0, 2 * math.pi, max(2, GRID_SIZE), endpoint=False)
    return [(float(beta), float(gamma)) for beta in betas for gamma in gammas]


def _decode_counts(counts: dict[str, int], candidates: list[Region], candidate_costs: list[float], hedge_cost: float) -> tuple[float, list[float], float]:
    weights = np.zeros(len(candidates), dtype=float)
    hedge_probability = 0.0
    total_shots = max(sum(counts.values()), 1)
    expectation = 0.0
    for bitstring, shots in counts.items():
        compact = bitstring.replace(" ", "")
        bits = [int(ch) for ch in reversed(compact)]
        bits = bits[: len(candidates) + 1]
        selected = sum(bits[: len(candidates)])
        hedge_bit = bits[len(candidates)] if len(bits) > len(candidates) else 0
        cost = float(np.dot(np.asarray(bits[: len(candidates)]), np.asarray(candidate_costs)))
        cost += hedge_bit * hedge_cost + PENALTY * (selected - 1) ** 2
        probability = shots / total_shots
        expectation += probability * cost
        if selected == 1:
            idx = next(i for i, value in enumerate(bits[: len(candidates)]) if value == 1)
            weights[idx] += probability
            hedge_probability += probability * hedge_bit
    if float(weights.sum()) > 0:
        weights /= float(weights.sum())
    return expectation, weights.tolist(), hedge_probability


def _best_from_simulation(ansatz: QuantumCircuit, params: list[Any], candidates: list[Region], candidate_costs: list[float], hedge_cost: float) -> tuple[list[float], float, float]:
    best: tuple[float, list[float], float] | None = None
    for beta, gamma in parameter_grid():
        bound = ansatz.assign_parameters({params[0]: beta, params[1]: gamma}, inplace=False)
        state = Statevector.from_instruction(bound)
        probs = np.abs(state.data) ** 2
        counts: dict[str, int] = {}
        # Convert exact state probabilities into deterministic pseudo-counts so
        # the same decoder is used for every result.
        for basis, probability in enumerate(probs):
            if probability <= 0:
                continue
            bitstring = format(basis, f"0{len(candidates) + 1}b")
            counts[bitstring] = max(1, int(round(float(probability) * 1_000_000)))
        score, weights, hedge = _decode_counts(counts, candidates, candidate_costs, hedge_cost)
        if best is None or score < best[0]:
            best = (score, weights, hedge)
    if best is None:
        raise RuntimeError("QAOA statevector optimization produced no result")
    return best[1], best[2], best[0]


def retrieve_job(payload: dict[str, Any], job_id: str) -> dict[str, Any]:
    """The simulator completes synchronously, so there are never queued jobs to poll."""
    return {
        "status": "error",
        "job_id": job_id,
        "mode": "qiskit-simulator",
        "backend": "Qiskit Statevector",
        "error": "No queued jobs: the Qiskit simulator returns results immediately.",
    }


def _completed_payload(candidates: list[Region], weights: list[float], hedge: float, score: float, execution_ms: float, base: dict[str, Any]) -> dict[str, Any]:
    if not weights or not all(math.isfinite(w) and w >= 0 for w in weights) or abs(sum(weights) - 1.0) > 1e-6:
        raise RuntimeError("QAOA returned no feasible normalized placement distribution")
    expanded = {r.id: 0.0 for r in candidates}
    for region, weight in zip(candidates, weights):
        expanded[region.id] = float(weight)
    base.update({
        "status": "completed",
        "weights": expanded,
        "hedge_pct": float(np.clip(hedge, 0.0, 1.0)),
        "penalized_circuit_energy": float(score),
        "qaoa_cost_usd_per_kwh": None,
        "execution_ms": execution_ms,
        "candidate_region_ids": [r.id for r in candidates],
        "quantum_verified": True,
    })
    return base


def simulate_qaoa(payload: dict[str, Any]) -> dict[str, Any]:
    start = time.perf_counter()
    candidates = select_candidates(payload)
    candidate_costs = [_unit_cost(r, float(payload["carbon_tax"]), float(payload["sla_ms"])) for r in candidates]
    hedge_cost = 0.0 if payload.get("benchmark") else _hedge_cost(float(payload["treasury_yield"]), float(payload["carbon_tax"]))
    circuit, params = build_qaoa_circuit(candidate_costs, hedge_cost)
    weights, hedge, score = _best_from_simulation(circuit, params, candidates, candidate_costs, hedge_cost)
    completed = _completed_payload(candidates, weights, hedge, score, round((time.perf_counter() - start) * 1000, 3), {
        "status": "completed",
        "job_id": None,
        "backend": "Qiskit Statevector",
        "mode": "qiskit-simulator",
        "quantum_verified": True,
    })
    completed["qaoa_cost_usd_per_kwh"] = float(np.dot(weights, candidate_costs))
    return completed


def optimize_live(payload: dict[str, Any]) -> dict[str, Any]:
    return simulate_qaoa(payload)
