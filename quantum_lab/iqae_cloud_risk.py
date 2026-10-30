"""Real Qiskit IQAE circuit experiment for the 3-shock Carbon Ledger risk model.

Install: pip install 'qiskit>=1.2' 'qiskit-algorithms>=0.3' 'qiskit-aer>=0.15'
Run: python quantum_lab/iqae_cloud_risk.py

This standalone research script uses the same discrete event probabilities as the
browser model but uses a fixed baseline risk. It does not claim hardware advantage.
"""
import json, math, time
from qiskit import QuantumCircuit
from qiskit.circuit.library import RYGate
from qiskit_aer.primitives import SamplerV2
from qiskit_algorithms import IterativeAmplitudeEstimation, EstimationProblem

SHOCKS=((.075,.43),(.19,.20),(.27,.12))
BASE=.075

def construct():
    qc=QuantumCircuit(4)
    for i,(prob,_) in enumerate(SHOCKS):qc.ry(2*math.asin(math.sqrt(prob)),i)
    # Uniform conditional rotation encoded using 3-controlled RY gates.
    # The fourth qubit is the objective flag; binary shock register 0..2.
    for mask in range(8):
        for i in range(3):
            if not mask>>i&1:qc.x(i)
        risk=min(1.,BASE+sum(v for i,(_,v) in enumerate(SHOCKS) if mask>>i&1))
        qc.append(RYGate(2*math.asin(math.sqrt(risk))).control(3),[0,1,2,3])
        for i in range(3):
            if not mask>>i&1:qc.x(i)
    return qc

def exact_probability():
    total=0.
    for mask in range(8):
        p=1.
        for i,(q,_) in enumerate(SHOCKS):p*=q if mask>>i&1 else 1-q
        total+=p*min(1.,BASE+sum(v for i,(_,v) in enumerate(SHOCKS) if mask>>i&1))
    return total

def main():
    prep=construct()
    problem=EstimationProblem(state_preparation=prep,objective_qubits=[3])
    from qiskit.primitives import StatevectorSampler
    sampler=StatevectorSampler(default_shots=512,seed=42)
    started=time.perf_counter()
    estimation=IterativeAmplitudeEstimation(epsilon_target=.025,alpha=.05,sampler=sampler).estimate(problem)
    print(json.dumps(dict(method='qiskit-iqae',backend='local-statevector-shots',exact=exact_probability(),estimate=estimation.estimation,confidence_interval=estimation.confidence_interval,oracle_queries=estimation.num_oracle_queries,elapsed_seconds=time.perf_counter()-started,circuit_depth=prep.decompose(reps=5).depth(),state_qubits=prep.num_qubits,warning='Qiskit quantum circuit simulation; no measured hardware advantage.'),indent=2))
if __name__=='__main__':main()
