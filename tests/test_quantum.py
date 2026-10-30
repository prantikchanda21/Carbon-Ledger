"""Run with: python -m unittest discover -s tests -p 'test_*.py'."""
import math
import unittest
from python_quantum.qaoa_service import Region, _unit_cost, simulate_qaoa, build_cost_operator, cost_diagonal, qaoa_state
import numpy as np

class QuantumRegression(unittest.TestCase):
    def test_pauli_decomposition_matches_cost_diagonal(self):
        costs = [.04, .08, .1, .12]
        actual = np.real(build_cost_operator(costs, .07).to_matrix().diagonal())
        np.testing.assert_allclose(actual, cost_diagonal(costs, .07), atol=1e-9)

    def test_numpy_qaoa_matches_qiskit(self):
        from qiskit.quantum_info import Statevector
        costs = [.08, .12, .17]
        from python_quantum.qaoa_service import build_qaoa_circuit
        ansatz, params = build_qaoa_circuit(costs, .04)
        beta, gamma = .27, .31
        if len(params) != 2:
            self.skipTest('Test requires QUANTUM_REPS=1')
        expected = Statevector.from_instruction(ansatz.assign_parameters({params[0]: beta, params[1]: gamma})).data
        actual = qaoa_state(cost_diagonal(costs, .04), [gamma], [beta], 4)
        np.testing.assert_allclose(np.abs(expected)**2, np.abs(actual)**2, atol=1e-9)

    def test_cost_matches_controller_coefficients(self):
        region = Region('test', 'test', 400, 100, 20, .08, True)
        self.assertAlmostEqual(_unit_cost(region, .5, 100), .1 + .5 * .25 * .4 + .08 * .05)

    def test_real_statevector_distribution_and_cost(self):
        payload = {'regions': [{'id': f'r{i}', 'code': f'r{i}', 'carbon_ci': 100+i*20, 'energy_price': 50+i*3, 'latency_ms': 10, 'egress_cost_gb': .05, 'eligible': True} for i in range(20)], 'carbon_tax': .5, 'sla_ms': 100, 'treasury_yield': 6.8, 'benchmark': True}
        result = simulate_qaoa(payload)
        self.assertEqual(result['status'], 'completed')
        self.assertTrue(math.isclose(sum(result['weights'].values()), 1, abs_tol=1e-6))
        expected = sum(result['weights'].get(r['id'], 0) * _unit_cost(Region(**r), .5, 100) for r in payload['regions'])
        self.assertAlmostEqual(result['qaoa_cost_usd_per_kwh'], expected)
        self.assertIn('penalized_circuit_energy', result)
        self.assertTrue(math.isfinite(result['qaoa_cost_usd_per_kwh']))

if __name__ == '__main__':
    unittest.main()
