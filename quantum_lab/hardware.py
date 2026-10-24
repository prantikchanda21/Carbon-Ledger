"""Optional IBM hardware CLI. No credentials or hardware dependency on the website.
prepare exports a circuit locally; submit explicitly sends one circuit to the QPU.
"""
import argparse,json,os
from pathlib import Path
import numpy as np
from .solver import make_problem,solve,qubo,initial_state,warm_solution

def build_circuit(p,model,theta,depth):
    from qiskit import QuantumCircuit
    qc=QuantumCircuit(p['n']);n=p['n']
    if model=='VQE':
        for layer in range(depth+1):
            for q in range(n):qc.ry(theta[layer*n+q],q)
            if layer<depth:
                for q in range(n-1):qc.cx(q,q+1)
        return qc
    if model=='QAOA-X':qc.h(range(n))
    else:
        warm=warm_solution(p)[0] if model=='Warm-XY' else None
        # Small offline experiments only: initialize encodes the exact declared state.
        qc.initialize(initial_state(p,warm),range(n))
    _,linear,pairs=qubo(p);scale=max(float(np.ptp(p['raw'][p['feasible']])),1.)
    for layer in range(depth):
        gamma=theta[depth+layer]/scale;beta=theta[layer]
        z=-linear/2
        for (a,b),value in pairs.items():
            z[a]-=value/4;z[b]-=value/4
            if abs(value)>1e-12:qc.rzz(gamma*value/2,a,b)
        for q in range(n):qc.rz(2*gamma*z[q],q)
        if model=='QAOA-X':
            for q in range(n):qc.rx(2*beta,q)
        else:
            for w in range(p['workloads']):
                for j in range(4):
                    a=4*w+j;b=4*w+(j+1)%4;qc.rxx(beta,a,b);qc.ryy(beta,a,b)
            qc.rx(2*beta,n-1)
    return qc

def service():
    from qiskit_ibm_runtime import QiskitRuntimeService
    token=os.environ.get('IBM_QUANTUM_TOKEN');instance=os.environ.get('IBM_QUANTUM_INSTANCE')
    if not token:raise ValueError('Set IBM_QUANTUM_TOKEN locally; never use NEXT_PUBLIC_ secrets')
    return QiskitRuntimeService(channel='ibm_quantum_platform',token=token,instance=instance)

def main():
    ap=argparse.ArgumentParser();ap.add_argument('action',choices=['prepare','submit','poll']);ap.add_argument('--backend');ap.add_argument('--job-id');ap.add_argument('--seed',type=int,default=42);ap.add_argument('--shots',type=int,default=1024);ap.add_argument('--output',default='artifacts/quantum-lab/hardware-job.json');a=ap.parse_args()
    dest=Path(a.output);dest.parent.mkdir(parents=True,exist_ok=True)
    if a.action=='poll':
        if not a.job_id:ap.error('--job-id required')
        job=service().job(a.job_id);status=str(job.status());result=dict(job_id=a.job_id,status=status,mode='hardware')
        if status.upper()=='DONE':result['counts']=job.result()[0].data.meas.get_counts()
    else:
        p=make_problem(a.seed);r=solve(p,'Warm-XY',2,a.seed,budget=150);qc=build_circuit(p,'Warm-XY',r['parameters'],2);qc.measure_all()
        from qiskit import qpy
        with dest.with_suffix('.qpy').open('wb') as f:qpy.dump(qc,f)
        result=dict(status='prepared',mode='local-circuit',seed=a.seed,shots=a.shots,qubits=qc.num_qubits,circuit_file=str(dest.with_suffix('.qpy')),parameters=r['parameters'])
        if a.action=='submit':
            if not a.backend:ap.error('--backend required for explicit hardware selection')
            from qiskit_ibm_runtime import SamplerV2
            from qiskit.transpiler.preset_passmanagers import generate_preset_pass_manager
            backend=service().backend(a.backend);isa=generate_preset_pass_manager(backend=backend,optimization_level=1).run(qc)
            job=SamplerV2(mode=backend).run([isa],shots=a.shots);result.update(status='submitted',mode='hardware',job_id=job.job_id(),backend=a.backend,transpiled_depth=isa.depth())
    dest.write_text(json.dumps(result,indent=2));print(json.dumps(result,indent=2))
if __name__=='__main__':main()
