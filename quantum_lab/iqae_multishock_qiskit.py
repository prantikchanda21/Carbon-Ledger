"""Actual Qiskit IQAE circuits for a multi-shock risk model (3 or 6 bits).

Dependencies: pip install 'qiskit>=1.2' 'qiskit-algorithms>=0.3'
Example: python -m quantum_lab.iqae_multishock_qiskit --bits 3
The model uses direct quantum state preparation for independent shocks and a
controlled objective rotation for each basis state. Gate count grows as 2^bits;
this is a genuine circuit but not an efficient 14-bit risk oracle.
Not run by Vercel dashboard. No hardware claims.
"""
import argparse, json, math, time

def construct(bits):
    from qiskit import QuantumCircuit
    from qiskit.circuit.library import RYGate
    if bits not in (3,6):raise ValueError('Limit to 3 or 6 shock bits: costly exponential oracle construction')
    rng_probs=[.075,.19,.27,.08,.12,.16][:bits]
    sev=[.28,.13,.08,.09,.10,.07][:bits]
    base=.045
    circuit=QuantumCircuit(bits+1)
    for j,p in enumerate(rng_probs):circuit.ry(2*math.asin(math.sqrt(p)),j)
    exact=0.
    for mask in range(1<<bits):
        probability=1.
        for j,p in enumerate(rng_probs):
            bit=bool(mask>>j&1)
            probability*=p if bit else 1-p
            if not bit:circuit.x(j)
        risk=min(1.,base+sum(v for j,v in enumerate(sev) if mask>>j&1))
        exact+=probability*risk
        circuit.append(RYGate(2*math.asin(math.sqrt(risk))).control(bits),list(range(bits))+[bits])
        for j in range(bits):
            if not mask>>j&1:circuit.x(j)
    return circuit,exact

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--bits',type=int,choices=[3,6],default=3);parser.add_argument('--shots',type=int,default=512);parser.add_argument('--epsilon',type=float,default=.03)
    args=parser.parse_args()
    from qiskit_algorithms import IterativeAmplitudeEstimation, EstimationProblem
    from qiskit.primitives import StatevectorSampler
    qc,exact=construct(args.bits)
    sampler=StatevectorSampler(default_shots=args.shots,seed=731)
    start=time.perf_counter()
    result=IterativeAmplitudeEstimation(epsilon_target=args.epsilon,alpha=.05,sampler=sampler).estimate(EstimationProblem(state_preparation=qc,objective_qubits=[args.bits]))
    print(json.dumps({'method':'qiskit IQAE real gate-level circuits','backend':'local statevector sampler with shots','shock_bits':args.bits,'states':1<<args.bits,'qubits':qc.num_qubits,'state_preparation_depth':qc.decompose(reps=5).depth(),'exact_probability':exact,'estimate':result.estimation,'interval':result.confidence_interval,'oracle_queries':result.num_oracle_queries,'wall_seconds':time.perf_counter()-start,'hardware':False,'caveat':'Circuit oracle scales exponentially; no practical advantage claim'},indent=2))
if __name__=='__main__':main()
