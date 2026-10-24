"""Batch risk inference using artifacts trained locally. Never load untrusted joblib files."""
import argparse,json
from pathlib import Path
import numpy as np
from .risk import features,vqc_probs,FEATURES

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--csv',required=True);ap.add_argument('--output',default='artifacts/quantum-lab/risk-predictions.json');a=ap.parse_args()
    import joblib
    bundle=joblib.load('artifacts/quantum-lab/risk-models.joblib');report=json.loads(Path('public/data/quantum-risk-v8.json').read_text())
    data=np.atleast_1d(np.genfromtxt(a.csv,delimiter=',',names=True));x=np.column_stack([data[f] for f in FEATURES])
    if not np.isfinite(x).all():raise ValueError('Nonfinite features')
    z=bundle['scaler'].transform(x);encoded=features(z);result={'VQC':vqc_probs(encoded,report['vqc']['theta']).tolist()}
    for name,model in bundle['models'].items():
        inputs=np.abs(encoded.conj()@bundle['training_states'].T)**2 if name=='Quantum kernel SVC' else z
        result[name]=model.predict_proba(inputs).tolist()
    p=Path(a.output);p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(result,indent=2));print(p)
if __name__=='__main__':main()
