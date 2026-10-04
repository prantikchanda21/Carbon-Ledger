"""Run with: python -m unittest discover -s tests -p 'test_*.py'."""
import math
import unittest
from python_quantum.qaoa_service import Region, _unit_cost, simulate_qaoa

class QuantumRegression(unittest.TestCase):
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
