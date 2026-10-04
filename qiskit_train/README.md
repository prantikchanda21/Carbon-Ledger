# Qiskit → PyTorch → ONNX training tier

The intended v3 pipeline is:

```text
20-region telemetry
      ↓
6-node candidate set
      ↓
Qiskit p=1 QAOA teacher
      ↓
region weights + hedge labels
      ↓
PyTorch 84→128→128→64→21 surrogate
      ↓
quantum_controller.onnx
      ↓
Next.js ONNX Runtime
      ↓
GLPK.js shadow/fallback
```

The production app has **no Python runtime dependency**. Python/Qiskit is an offline training and validation tier only.

## Local reproduction with Qiskit

```bash
cd qiskit_train
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\\Scripts\\Activate.ps1
pip install -r requirements.txt
cd ..
python -m qiskit_train.qiskit_qaoa --samples 32
python -m qiskit_train.train_surrogate --samples 320 --epochs 700
```

The sandbox used for this delivery cannot install Qiskit because outbound package downloads are disabled. Therefore the bundled ONNX artifact was trained from the included mathematically matched encoded p=1 QAOA reference teacher, while `qiskit_qaoa.py` provides the actual Qiskit reproduction path. This distinction is recorded in `training_manifest.json`.
