"""Compact encoded one-hot p=1 QAOA reference teacher.

The production training script can switch to qiskit_aer/QAOAAnsatz for the same
candidate-selection problem. This reference implementation keeps the feasible
one-hot subspace explicit (20 regions x hedge/no-hedge) so training artifacts can
be generated without a 2**21 statevector on constrained build machines.
"""
from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np
from scipy.linalg import expm
from scipy.optimize import minimize

N_REGIONS = 20
CANDIDATES = 6

PROFILES = [
    (640,70,15,72,12,14,11,2,0.020,0.7),(560,60,16,66,10,15,9,2,0.020,0.4),(610,65,16,68,10,15,13,3,0.025,0.9),
    (455,35,16,88,11,15,20,3,0.065,1.2),(420,42,17,96,18,18,49,6,0.085,1.7),(430,48,17,94,16,18,51,6,0.082,1.8),
    (320,55,6,84,17,6,32,5,0.075,2.5),(350,80,17,112,22,17,24,4,0.086,2.1),(245,55,17,106,24,16,27,4,0.070,2.9),
    (265,50,17,108,23,17,26,4,0.078,3.1),(115,35,14,102,19,16,29,4,0.081,3.6),(95,20,14,104,20,16,25,4,0.082,3.3),
    (170,65,14,103,21,15,31,5,0.084,3.8),(90,18,14,118,24,16,28,4,0.090,3.9),(390,40,22,68,14,21,41,6,0.090,4.3),
    (130,34,20,72,12,20,58,7,0.090,4.9),(280,55,21,64,11,20,53,6,0.088,4.6),(55,22,18,81,14,18,44,5,0.088,5.1),
    (125,60,17,76,16,16,120,9,0.100,5.4),(720,85,18,70,13,17,140,11,0.105,5.8),
]

def scenario(rng: np.random.Generator, hour: float | None = None) -> Scenario:
    h = float(rng.uniform(0, 24) if hour is None else hour)
    features=[]
    for ci0,cia,cip,p0,pa,pp,l0,lj,eg,phase in PROFILES:
        cyc = math.cos(2*math.pi*(h-cip)/24)
        carbon = ci0 + cia*cyc + 8*math.sin(h*3.1+phase) + rng.normal(0, 8)
        price = p0 + pa*math.cos(2*math.pi*(h-pp)/24) + 2*math.sin(h*2.3+phase) + rng.normal(0, 1.5)
        latency = max(1, l0 + lj*math.sin(h*5+phase) + rng.normal(0, 1))
        features.append([max(20,carbon), max(1,price), latency, eg])
    return Scenario(np.asarray(features, dtype=np.float32), float(rng.uniform(6.4,10.5)), float(rng.uniform(0,1)), float(rng.uniform(10,100)), float(rng.uniform(10,100)))


@dataclass(frozen=True)
class Scenario:
    region_features: np.ndarray  # [20,4] raw [carbon, price, latency, egress]
    treasury_yield: float
    carbon_tax: float
    sla_ms: float
    budget_cr: float


def encode_features(s: Scenario) -> np.ndarray:
    out: list[float] = []
    for carbon, price, latency, egress in s.region_features:
        out.extend([
            np.clip((carbon - 350.0) / 300.0, -4.0, 4.0),
            np.clip((price - 85.0) / 45.0, -4.0, 4.0),
            np.clip((latency - 45.0) / 45.0, -4.0, 4.0),
            np.clip((egress - 0.07) / 0.05, -4.0, 4.0),
        ])
    out.extend([
        np.clip((s.treasury_yield - 7.0) / 2.0, -4.0, 4.0),
        np.clip((s.carbon_tax - 0.5) / 0.5, -4.0, 4.0),
        np.clip((s.sla_ms - 50.0) / 40.0, -4.0, 4.0),
        np.clip((s.budget_cr - 50.0) / 50.0, -4.0, 4.0),
    ])
    return np.asarray(out, dtype=np.float32)


def node_cost(s: Scenario) -> np.ndarray:
    carbon, price, latency, egress = s.region_features.T
    energy = price / 1000.0
    carbon_term = s.carbon_tax * 0.34 * (carbon / 1000.0)
    latency_term = np.maximum(0.0, latency - s.sla_ms) * 0.005
    return energy + carbon_term + egress * 0.02 + latency_term


def candidate_indices(s: Scenario) -> np.ndarray:
    costs = node_cost(s)
    # Keep India residency candidates visible to the teacher whenever DPDP is not enforced,
    # while still creating a diverse low-cost/low-carbon candidate set.
    best = list(np.argsort(costs)[:CANDIDATES])
    carbon_best = list(np.argsort(s.region_features[:, 0])[:2])
    for idx in carbon_best:
        if idx not in best and len(best) < CANDIDATES:
            best.append(int(idx))
    return np.asarray(best[:CANDIDATES], dtype=np.int64)


def _mixer_matrix(k: int) -> np.ndarray:
    # Encoded feasible-subspace mixer: complete graph over region choices plus
    # a two-state X mixer for the hedge bit. Basis index = region*2 + hedge.
    dim = k * 2
    mixer = np.zeros((dim, dim), dtype=np.complex128)
    for hedge in (0, 1):
        for i in range(k):
            for j in range(i + 1, k):
                a = i * 2 + hedge
                b = j * 2 + hedge
                mixer[a, b] = mixer[b, a] = 1.0
    for i in range(k):
        a, b = i * 2, i * 2 + 1
        mixer[a, b] = mixer[b, a] = 1.0
    return mixer


def qaoa_teacher(s: Scenario, seed: int = 7) -> tuple[np.ndarray, float, np.ndarray]:
    costs = node_cost(s)
    candidates = candidate_indices(s)
    candidate_costs = costs[candidates].astype(float)
    hedge_cost = 0.12 - 0.03 * max(0.0, s.treasury_yield - 7.0) + 0.025 * s.carbon_tax
    candidate_state_cost = np.zeros(CANDIDATES * 2, dtype=float)
    for r in range(CANDIDATES):
        for hedge in (0, 1):
            candidate_state_cost[r * 2 + hedge] = candidate_costs[r] + hedge * hedge_cost

    mixer = _mixer_matrix(CANDIDATES)
    initial = np.ones(CANDIDATES * 2, dtype=np.complex128) / math.sqrt(CANDIDATES * 2)
    rng = np.random.default_rng(seed)

    def state(params: np.ndarray) -> np.ndarray:
        gamma, beta = params
        phase = np.exp(-1j * gamma * candidate_state_cost)
        return expm(-1j * beta * mixer) @ (initial * phase)

    def objective(params: np.ndarray) -> float:
        psi = state(params)
        return float(np.real(np.vdot(psi, candidate_state_cost * psi)))

    best = None
    for _ in range(5):
        x0 = rng.uniform(-math.pi, math.pi, 2)
        result = minimize(objective, x0, method='Nelder-Mead', options={'maxiter': 120, 'xatol': 1e-5, 'fatol': 1e-6})
        if best is None or result.fun < best.fun:
            best = result
    assert best is not None
    probs = np.abs(state(best.x)) ** 2
    weights = np.zeros(N_REGIONS, dtype=np.float32)
    for r, idx in enumerate(candidates):
        weights[idx] = float(probs[r * 2] + probs[r * 2 + 1])
    weights /= max(float(weights.sum()), 1e-9)
    hedge = float(sum(probs[r * 2 + 1] for r in range(CANDIDATES)))
    return weights, hedge, candidates
