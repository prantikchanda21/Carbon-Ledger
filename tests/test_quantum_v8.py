import unittest
import numpy as np
from quantum_lab.solver import make_problem,qubo,circuit_state,warm_solution,solve,readout_noise
from quantum_lab.risk import features,vqc_probs

class QuantumV8Tests(unittest.TestCase):
    def test_qubo_matches_every_basis_state(self):
        for size in (2,3):
            p=make_problem(workloads=size);c,l,q=qubo(p);b=p['bits']
            reconstructed=c+b@l+sum(v*b[:,i]*b[:,j] for (i,j),v in q.items())
            np.testing.assert_allclose(reconstructed,p['energy'],atol=1e-10)
    def test_xy_preserves_assignment_and_norm(self):
        p=make_problem();warm=warm_solution(p)[0]
        for model in ('QAOA-X','QAOA-XY','Warm-XY'):
            psi=circuit_state(p,model,np.array([.3,.5,.7,.2]),2,warm)
            self.assertAlmostEqual(float(np.abs(psi@psi.conj())),1)
            if model!='QAOA-X':
                invalid=np.any(p['bits'][:,:-1].reshape(-1,p['workloads'],4).sum(2)!=1,axis=1)
                self.assertLess(float(np.abs(psi[invalid]).sum()),1e-10)
    def test_qiskit_circuit_agrees(self):
        from qiskit.quantum_info import Statevector
        from quantum_lab.hardware import build_circuit
        p=make_problem();warm=warm_solution(p)[0]
        for model in ('QAOA-X','QAOA-XY','Warm-XY','VQE'):
            theta=np.linspace(.1,.8,p['n']*3 if model=='VQE' else 4)
            expected=circuit_state(p,model,theta,2,warm)
            actual=Statevector.from_instruction(build_circuit(p,model,theta,2)).data
            np.testing.assert_allclose(np.abs(actual)**2,np.abs(expected)**2,atol=1e-10)
    def test_seed_reproducibility_and_noise(self):
        p=make_problem();a=solve(p,budget=50);b=solve(p,budget=50)
        self.assertEqual(a['histogram'],b['histogram']);self.assertGreaterEqual(a['gap_pct'],-1e-8)
        probs=np.zeros(512);probs[0]=1;out=readout_noise(probs,9,.03)
        self.assertAlmostEqual(float(out.sum()),1);self.assertAlmostEqual(float(out[0]),.97**9)
    def test_risk_normalization(self):
        states=features(np.array([[.1,.2,.3,.4],[.9,.8,.7,.6]]));p=vqc_probs(states,np.arange(8)/8)
        np.testing.assert_allclose(p.sum(1),1);self.assertTrue((p>=0).all())

if __name__=='__main__':unittest.main()
