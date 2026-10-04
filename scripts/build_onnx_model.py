#!/usr/bin/env python3
"""Rebuild the 20-region ONNX surrogate from the offline quantum training tier.

For a true Qiskit run, first generate labels with qiskit_train/qiskit_qaoa.py and
then pass --labels to qiskit_train.train_surrogate. The bundled artifact was built
with the included encoded p=1 QAOA reference teacher because this sandbox has no
outbound package installation access.
"""
from qiskit_train.train_surrogate import train

if __name__ == '__main__':
    manifest = train(n=320, epochs=700, seed=20261004)
    print(manifest)
