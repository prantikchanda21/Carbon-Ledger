"""Unit tests for 20-region scheduler and fair exact-MIP reference."""
import unittest, tempfile
from pathlib import Path
from experiment import make_instance,construct,validate,score,build_mip,solve_highs,glpk_lp,quantum_measure
import numpy as np

class SchedulerTest(unittest.TestCase):
 def setUp(self):self.ins=make_instance(7,10)
 def test_feasible_quantum_and_classical(self):
  for mode in ('quantum','uniform','greedy'):
   out=construct(self.ins,mode=mode,beam_width=4,shots=6)
   self.assertTrue(out['ok']);self.assertTrue(validate(self.ins,out['assignments']))
   self.assertAlmostEqual(score(self.ins,out['assignments'])[0],out['objective'])
 def test_mip_valid_and_better_objective(self):
  exact=solve_highs(self.ins,2.0);self.assertTrue(exact['ok']);self.assertTrue(exact['optimal'])
  candidate=construct(self.ins,'quantum',beam_width=4,shots=6)
  self.assertGreaterEqual(candidate['objective']+1e-8,exact['objective'])
 def test_glpk_lp_export(self):
  m=build_mip(self.ins)
  with tempfile.TemporaryDirectory() as directory:
   path=Path(directory)/'test.lp';glpk_lp(self.ins,m,path)
   content=path.read_text();self.assertIn('Binary',content);self.assertIn('Minimize',content)
   self.assertIn('Subject To',content);self.assertIn('End',content)
 def test_circuit_sampling_states_in_range(self):
  energies=np.full(128,np.inf);energies[:60]=np.linspace(0,1,60)
  for walk in (False,True):
   chosen=quantum_measure(energies,123,4,shots=24,phase_walk=walk)
   self.assertTrue(chosen);self.assertTrue(all(0<=x<60 for x in chosen))
 def test_invalid_capacity(self):
  candidate=construct(self.ins,'quantum',beam_width=4,shots=6)
  self.assertTrue(candidate['ok'])
  p=[(self.ins['tasks'][0]['allowed'][0],0)]*len(self.ins['tasks'])
  self.assertFalse(validate(self.ins,p))

if __name__=='__main__':unittest.main()
