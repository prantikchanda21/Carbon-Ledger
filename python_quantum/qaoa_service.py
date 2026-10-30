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
MAX_CANDIDATES = int(os.getenv("QUANTUM_MAX_CANDIDATES", "20"))
BATCH_SIZE = max(2, min(8, int(os.getenv("QUANTUM_BATCH_SIZE", "5"))))
COBYLA_MAXITER = max(50, int(os.getenv("QUANTUM_COBYLA_MAXITER", "220")))
COBYLA_RESTARTS = max(1, min(10, int(os.getenv("QUANTUM_COBYLA_RESTARTS", "2"))))
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
    return scored if os.getenv("QUANTUM_CANDIDATE_MODE", "all") == "all" else scored[: min(MAX_CANDIDATES, len(scored))]


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
    reps = max(1, min(4, int(os.getenv("QUANTUM_REPS", "3"))))
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


def _run_batched_qaoa(costs: list[float], hedge_cost: float, seed: int = 42) -> dict[str, Any]:
    """Compare optimization objectives on *every* candidate using bounded statevectors.

    All 20 candidates participate in the search, but each quantum circuit encodes
    at most BATCH_SIZE candidate regions plus a hedge qubit. This is intentionally
    NOT a 20-region simultaneous QAOA circuit or a general multi-workload solver.
    """
    from scipy.optimize import minimize

    reps = max(1, min(4, int(os.getenv("QUANTUM_REPS", "3"))))
    shots = max(1, SHOTS)
    rng = np.random.default_rng(seed)
    objectives = ("expected_energy", "feasible_cost", "cvar_20")
    results: list[dict[str, Any]] = []
    total_evals = 0
    batches = [list(range(a, min(a + BATCH_SIZE, len(costs)))) for a in range(0, len(costs), BATCH_SIZE)]

    for batch_index, indices in enumerate(batches):
        local_costs = [costs[i] for i in indices]
        n = len(local_costs) + 1
        energy = cost_diagonal(local_costs, hedge_cost)
        basis = np.arange(len(energy), dtype=np.int64)
        region_bits = np.column_stack([((basis >> i) & 1) for i in range(len(indices))])
        feasible = region_bits.sum(axis=1) == 1
        raw_cost = region_bits @ np.asarray(local_costs) + ((basis >> len(indices)) & 1) * hedge_cost
        local_optimal = float(np.min(raw_cost[feasible]))

        def probabilities(params: np.ndarray) -> np.ndarray:
            psi = qaoa_state(energy, list(params[reps:]), list(params[:reps]), n)
            return np.abs(psi) ** 2

        for objective_name in objectives:
            def objective(params: np.ndarray) -> float:
                prob = probabilities(params)
                if objective_name == "expected_energy":
                    return float(prob @ energy)
                if objective_name == "feasible_cost":
                    mass = float(prob[feasible].sum())
                    if mass < 1e-10:
                        return float(np.max(energy) + PENALTY)
                    # Encourage feasible assignments, then reduce their mean cost.
                    return float(prob[feasible] @ raw_cost[feasible] / mass + PENALTY * (1 - mass))
                order = np.argsort(energy)
                remaining = 0.20
                accumulated = 0.0
                for i in order:
                    take = min(remaining, float(prob[i]))
                    accumulated += take * float(energy[i])
                    remaining -= take
                    if remaining <= 1e-12:
                        break
                return accumulated / 0.20

            best_vector = None
            best_value = math.inf
            evaluations = 0
            for restart in range(COBYLA_RESTARTS):
                initial = np.concatenate((rng.uniform(0, np.pi / 2, reps), rng.uniform(0, 2 * np.pi, reps)))
                initial_score = objective(initial)
                result = minimize(objective, initial, method="COBYLA", options={
                    "maxiter": COBYLA_MAXITER, "rhobeg": 0.35, "tol": 1e-5, "catol": 1e-6,
                })
                evaluations += int(result.nfev) + 1
                vector, score = (result.x, float(result.fun)) if result.fun < initial_score else (initial, initial_score)
                if score < best_value:
                    best_value, best_vector = score, vector
            total_evals += evaluations
            prob = probabilities(best_vector)
            sampled = rng.choice(len(prob), size=shots, p=prob / prob.sum())
            valid_samples = [int(i) for i in sampled if feasible[i]]
            best_state = min(valid_samples, key=lambda i: (raw_cost[i], i)) if valid_samples else None
            selected = (int(np.argmax(region_bits[best_state])) if best_state is not None else None)
            results.append({
                "objective": objective_name,
                "batch_index": batch_index,
                "batch_region_indices": indices,
                "best_feasible_sample_region_index": indices[selected] if selected is not None else None,
                "best_feasible_sample_cost": float(raw_cost[best_state]) if best_state is not None else None,
                "best_feasible_sample_hedge": int((best_state >> len(indices)) & 1) if best_state is not None else None,
                "feasible_probability": float(prob[feasible].sum()),
                "feasible_shots": len(valid_samples),
                "optimum_probability": float(prob[feasible & np.isclose(raw_cost, local_optimal, atol=1e-10)].sum()),
                "optimizer_evals": evaluations,
                "optimizer_score": best_value,
                "expected_penalized_energy": float(prob @ energy),
                "qubits": n,
                "depth": reps,
            })

    valid = [row for row in results if row["best_feasible_sample_region_index"] is not None]
    if not valid:
        raise RuntimeError("No feasible measured samples from any QAOA batch; increase shots or optimizer budget")
    winner = min(valid, key=lambda row: (row["best_feasible_sample_cost"], -row["feasible_probability"]))
    return {"best": winner, "runs": results, "total_evals": total_evals,
            "batches": len(batches), "objectives": list(objectives), "depth": reps}


def simulate_qaoa(payload: dict[str, Any]) -> dict[str, Any]:
    start = time.perf_counter()
    candidates = select_candidates(payload)
    costs = [_unit_cost(r, float(payload["carbon_tax"]), float(payload["sla_ms"])) for r in candidates]
    hedge_cost = 0.0 if payload.get("benchmark") else _hedge_cost(float(payload["treasury_yield"]), float(payload["carbon_tax"]))
    outcome = _run_batched_qaoa(costs, hedge_cost, seed=int(payload.get("seed", 42)))
    best = outcome["best"]
    winner_index = best["best_feasible_sample_region_index"]
    weights = [float(i == winner_index) for i in range(len(candidates))]
    completed = _completed_payload(candidates, weights, float(best["best_feasible_sample_hedge"]),
                                   best["expected_penalized_energy"],
                                   round((time.perf_counter() - start) * 1000, 3), {
        "status": "completed", "job_id": None,
        "backend": "NumPy QAOA statevector (Qiskit-compatible cost Hamiltonian)",
        "mode": "qiskit-simulator", "quantum_verified": False,
    })
    completed.update({
        "reps": outcome["depth"], "n_qubits": best["qubits"],
        "candidate_count": len(candidates), "candidate_coverage": "all eligible regions in separate batches",
        "simultaneous_20_region_circuit": False,
        "batch_count": outcome["batches"], "batch_size": BATCH_SIZE,
        "feasible_probability": best["feasible_probability"],
        "optimum_probability": best["optimum_probability"],
        "optimizer_evals": outcome["total_evals"],
        "best_feasible_sample": {
            "region_id": candidates[winner_index].id,
            "cost_usd_per_kwh": best["best_feasible_sample_cost"],
            "hedge": bool(best["best_feasible_sample_hedge"]),
            "objective": best["objective"], "batch_index": best["batch_index"],
        },
        "objective_comparison": outcome["runs"],
        "compared_objectives": outcome["objectives"],
        "qaoa_cost_usd_per_kwh": costs[winner_index],
        "quantum_verified": False,
    })
    return completed

def optimize_live(payload: dict[str, Any]) -> dict[str, Any]:
    return simulate_qaoa(payload)
