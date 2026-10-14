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
    return scored if os.getenv("QUANTUM_CANDIDATE_MODE", "topk") == "all" else scored[: min(MAX_CANDIDATES, len(scored))]


def _hedge_cost(treasury_yield: float, carbon_tax: float) -> float:
    return 0.12 - 0.03 * max(0.0, treasury_yield - 7.0) + 0.025 * carbon_tax


def build_cost_operator(candidate_costs: list[float], hedge_cost: float) -> SparsePauliOp:
    """Sparse Ising decomposition: no dense 2**n square operator allocation."""
    n = len(candidate_costs)
    terms: list[tuple[str, list[int], float]] = []
    constant = PENALTY + hedge_cost / 2
    for i, cost in enumerate(candidate_costs):
        linear = cost - PENALTY
        constant += linear / 2
        terms.append(("Z", [i], -linear / 2 - (n - 1) * PENALTY / 2))
    terms.append(("Z", [n], -hedge_cost / 2))
    for i in range(n):
        for j in range(i + 1, n):
            terms.append(("ZZ", [i, j], PENALTY / 2))
            constant += PENALTY / 2
    terms.append(("I" * (n + 1), [], constant))
    return SparsePauliOp.from_sparse_list(terms, num_qubits=n + 1).simplify()


def build_qaoa_circuit(candidate_costs: list[float], hedge_cost: float) -> tuple[QuantumCircuit, list[Any]]:
    operator = build_cost_operator(candidate_costs, hedge_cost)
    reps = max(1, min(4, int(os.getenv("QUANTUM_REPS", "1"))))
    ansatz = QAOAAnsatz(cost_operator=operator, reps=reps, flatten=True)
    parameters = list(ansatz.parameters)
    betas = sorted([p for p in parameters if str(p).startswith(("β", "beta"))], key=lambda p: str(p))
    gammas = sorted([p for p in parameters if str(p).startswith(("γ", "gamma"))], key=lambda p: str(p))
    if len(betas) != reps or len(gammas) != reps:
        raise RuntimeError("Unexpected QAOA parameter naming in installed Qiskit")
    return ansatz, betas + gammas


def cost_diagonal(costs: list[float], hedge_cost: float) -> np.ndarray:
    """Diagonal Hamiltonian values, O(2**n) memory instead of O(4**n)."""
    k = len(costs)
    basis = np.arange(1 << (k + 1), dtype=np.uint32)
    chosen = np.zeros_like(basis, dtype=np.int16)
    diag = np.zeros(len(basis), dtype=float)
    for i, c in enumerate(costs):
        bit = ((basis >> i) & 1).astype(np.int16)
        chosen += bit
        diag += c * bit
    diag += hedge_cost * ((basis >> k) & 1)
    diag += PENALTY * (chosen - 1) ** 2
    return diag


def qaoa_state(diagonal: np.ndarray, gammas: list[float], betas: list[float], n: int) -> np.ndarray:
    """Numpy diagonal-cost QAOA, suitable for reproducible offline sweeps."""
    size = 1 << n
    if len(diagonal) != size or len(gammas) != len(betas):
        raise ValueError("Invalid QAOA dimensions")
    psi = np.full(size, 1 / np.sqrt(size), dtype=np.complex128)
    for gamma, beta in zip(gammas, betas):
        psi *= np.exp(-1j * gamma * diagonal)
        c, sine = np.cos(beta), -1j * np.sin(beta)
        for q in range(n):
            shaped = psi.reshape(-1, 2, 1 << q)
            zero, one = shaped[:, 0, :], shaped[:, 1, :]
            psi = np.stack((c * zero + sine * one, sine * zero + c * one), axis=1).reshape(-1)
    return psi


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
    reps = len(params) // 2
    diagonal = cost_diagonal(candidate_costs, hedge_cost)
    n = len(candidate_costs) + 1
    def objective(vector: np.ndarray) -> float:
        psi = qaoa_state(diagonal, list(vector[reps:]), list(vector[:reps]), n)
        return float(np.dot(np.abs(psi) ** 2, diagonal))
    initial = min(parameter_grid(), key=lambda pair: objective(np.array([pair[0]] * reps + [pair[1]] * reps)))
    vector = np.array([initial[0]] * reps + [initial[1]] * reps)
    if reps >= 1:
        from scipy.optimize import minimize
        fitted = minimize(objective, vector, method='COBYLA', options={'maxiter': 100, 'rhobeg': 0.2, 'tol': 1e-5})
        if fitted.fun <= objective(vector):
            vector = fitted.x
    psi = qaoa_state(diagonal, list(vector[reps:]), list(vector[:reps]), n)
    probs = np.abs(psi) ** 2
    feasible = np.zeros(n, dtype=float)
    hedge = 0.0
    feasible_mass = 0.0
    for basis, probability in enumerate(probs):
        selected = [i for i in range(len(candidate_costs)) if basis & (1 << i)]
        if len(selected) == 1:
            feasible[selected[0]] += probability
            feasible_mass += float(probability)
            if basis & (1 << len(candidate_costs)):
                hedge += float(probability)
    if feasible_mass <= 1e-15:
        raise RuntimeError('No feasible state sampled by QAOA')
    weights = (feasible[:len(candidate_costs)] / feasible_mass).tolist()
    _best_from_simulation.metrics = {'reps': reps, 'n_qubits': n,
        'feasible_probability': feasible_mass,
        'optimum_probability': float(probs[np.isclose(diagonal, min(candidate_costs) + min(0.0, hedge_cost), atol=1e-10, rtol=0)].sum()),
        'optimizer_evals': len(parameter_grid()) + int(fitted.nfev) + 2}
    return weights, hedge / feasible_mass, float(np.dot(probs, diagonal))


def retrieve_job(payload: dict[str, Any], job_id: str) -> dict[str, Any]:
    """The simulator completes synchronously, so there are never queued jobs to poll."""
    return {
        "status": "error",
        "job_id": job_id,
        "mode": "qiskit-simulator",
        "backend": "NumPy statevector (Qiskit circuit specification)",
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
        "quantum_verified": False,
    })
    return base


def simulate_qaoa(payload: dict[str, Any]) -> dict[str, Any]:
    start = time.perf_counter()
    candidates = select_candidates(payload)
    candidate_costs = [_unit_cost(r, float(payload["carbon_tax"]), float(payload["sla_ms"])) for r in candidates]
    hedge_cost = 0.0 if payload.get("benchmark") else _hedge_cost(float(payload["treasury_yield"]), float(payload["carbon_tax"]))
    requested_reps = max(1, min(4, int(os.getenv("QUANTUM_REPS", "1"))))
    if payload.get("__live", True) and (len(candidates) + 1 > 10 or requested_reps > 2):
        raise ValueError("Quantum live budget exceeded (max 10 qubits, p<=2). Use precomputed offline sweep results.")
    circuit, params = build_qaoa_circuit(candidate_costs, hedge_cost)
    weights, hedge, score = _best_from_simulation(circuit, params, candidates, candidate_costs, hedge_cost)
    completed = _completed_payload(candidates, weights, hedge, score, round((time.perf_counter() - start) * 1000, 3), {
        "status": "completed",
        "job_id": None,
        "backend": "NumPy statevector (Qiskit circuit specification)",
        "mode": "qiskit-simulator",
        "quantum_verified": False,
    })
    completed.update(getattr(_best_from_simulation, "metrics", {}))
    completed["qaoa_cost_usd_per_kwh"] = float(np.dot(weights, candidate_costs))
    return completed


def optimize_live(payload: dict[str, Any]) -> dict[str, Any]:
    return simulate_qaoa(payload)
