from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path

import numpy as np
import torch
from torch import nn
import torch.nn.functional as F

from .qaoa_reference import N_REGIONS, Scenario, encode_features, qaoa_teacher

ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = Path(__file__).resolve().parent / 'artifacts'
ONNX_PATH = ROOT / 'public' / 'models' / 'quantum_controller.onnx'
PT_PATH = ARTIFACTS / 'quantum_controller.pt'
DATA_PATH = ARTIFACTS / 'qaoa_training_data.jsonl'
MANIFEST_PATH = ARTIFACTS / 'training_manifest.json'

PROFILES = [
    (640,70,15,72,12,14,11,2,0.020,0.7),(560,60,16,66,10,15,9,2,0.020,0.4),(610,65,16,68,10,15,13,3,0.025,0.9),
    (455,35,16,88,11,15,20,3,0.065,1.2),(420,42,17,96,18,18,49,6,0.085,1.7),(430,48,17,94,16,18,51,6,0.082,1.8),
    (320,55,6,84,17,6,32,5,0.075,2.5),(350,80,17,112,22,17,24,4,0.086,2.1),(245,55,17,106,24,16,27,4,0.070,2.9),
    (265,50,17,108,23,17,26,4,0.078,3.1),(115,35,14,102,19,16,29,4,0.081,3.6),(95,20,14,104,20,16,25,4,0.082,3.3),
    (170,65,14,103,21,15,31,5,0.084,3.8),(90,18,14,118,24,16,28,4,0.090,3.9),(390,40,22,68,14,21,41,6,0.090,4.3),
    (130,34,20,72,12,20,58,7,0.090,4.9),(280,55,21,64,11,20,53,6,0.088,4.6),(55,22,18,81,14,18,44,5,0.088,5.1),
    (125,60,17,76,16,16,120,9,0.100,5.4),(720,85,18,70,13,17,140,11,0.105,5.8),
]

def scenario(rng: np.random.Generator, hour: float | None = None) -> Scenario:
    h = float(rng.uniform(0, 24) if hour is None else hour)
    features=[]
    for ci0,cia,cip,p0,pa,pp,l0,lj,eg,phase in PROFILES:
        cyc = math.cos(2*math.pi*(h-cip)/24)
        carbon = ci0 + cia*cyc + 8*math.sin(h*3.1+phase) + rng.normal(0, 8)
        price = p0 + pa*math.cos(2*math.pi*(h-pp)/24) + 2*math.sin(h*2.3+phase) + rng.normal(0, 1.5)
        latency = max(1, l0 + lj*math.sin(h*5+phase) + rng.normal(0, 1))
        features.append([max(20,carbon), max(1,price), latency, eg])
    return Scenario(np.asarray(features, dtype=np.float32), float(rng.uniform(6.4,10.5)), float(rng.uniform(0,1)), float(rng.uniform(10,100)), float(rng.uniform(10,100)))

class Surrogate(nn.Module):
    def __init__(self) -> None:
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(84, 128), nn.ReLU(),
            nn.Linear(128, 128), nn.ReLU(),
            nn.Linear(128, 64), nn.ReLU(),
            nn.Linear(64, 21),
        )
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x)

# Minimal protobuf writer for an ONNX linear/ReLU network.
def varint(n: int) -> bytes:
    out=bytearray(); n=int(n)
    while n>127:
        out.append((n&127)|128); n >>= 7
    out.append(n); return bytes(out)
def fld_i(field:int,value:int)->bytes: return varint((field<<3)|0)+varint(value)
def fld_b(field:int,value:bytes)->bytes: return varint((field<<3)|2)+varint(len(value))+value
def fld_s(field:int,value:str)->bytes: return fld_b(field,value.encode())
def tensor(name:str,a:np.ndarray)->bytes:
    a=np.ascontiguousarray(a,dtype='<f4'); msg=b''.join(fld_i(1,int(d)) for d in a.shape)+fld_i(2,1)+fld_s(8,name)+fld_b(9,a.tobytes()); return msg
def node(op:str,ins:list[str],outs:list[str],name:str)->bytes:
    return b''.join(fld_s(1,x) for x in ins)+b''.join(fld_s(2,x) for x in outs)+fld_s(3,name)+fld_s(4,op)
def value_info(name:str,dims:list[int])->bytes:
    shape=b''.join(fld_b(1,fld_i(1,d)) for d in dims)
    tt=fld_i(1,1)+fld_b(2,shape)
    return fld_s(1,name)+fld_b(2,fld_b(1,tt))
def build_onnx(model: Surrogate)->bytes:
    linears=[m for m in model.net if isinstance(m,nn.Linear)]
    nodes=[]; inits=[]; prev='telemetry'
    for i,layer in enumerate(linears):
        w=layer.weight.detach().cpu().numpy(); b=layer.bias.detach().cpu().numpy()
        wn=f'w{i}'; bn=f'b{i}'; mm=f'm{i}'; out=f'o{i}'
        inits.extend([tensor(wn,w.T),tensor(bn,b)])
        nodes += [node('MatMul',[prev,wn],[mm],f'matmul_{i}'), node('Add',[mm,bn],[out],f'add_{i}')]
        if i < len(linears)-1:
            act=f'a{i}'; nodes.append(node('Relu',[out],[act],f'relu_{i}')); prev=act
        else: prev=out
    nodes.append(node('Identity',[prev],['policy_logits'],'output_identity'))
    graph=b''.join(fld_b(1,n) for n in nodes)+fld_s(2,'QAOA20RegionSurrogate')+b''.join(fld_b(5,t) for t in inits)
    graph+=fld_b(11,value_info('telemetry',[1,84]))+fld_b(12,value_info('policy_logits',[1,21]))
    return fld_i(1,9)+fld_s(2,'dual-engine-qaoa-surrogate')+fld_s(3,'3.0')+fld_s(6,'20-region surrogate distilled from p=1 QAOA labels')+fld_b(7,graph)+fld_b(8,fld_i(2,17))

def load_qiskit_labels(path: Path) -> tuple[np.ndarray, np.ndarray, list[dict[str, object]]]:
    rows = [json.loads(line) for line in path.read_text().splitlines() if line.strip()]
    X = np.stack([np.asarray(r['features'], dtype=np.float32) for r in rows])
    weights = np.stack([np.asarray(r['weights'], dtype=np.float32) for r in rows])
    hedge = np.asarray([float(r['hedge']) for r in rows], dtype=np.float32).reshape(-1, 1)
    targets = np.concatenate([np.log(np.clip(weights, 1e-6, None)), np.log(np.clip(hedge, 1e-5, 1 - 1e-5) / np.clip(1 - hedge, 1e-5, 1))], axis=1)
    return X, targets.astype(np.float32), rows

def train(n:int, epochs:int, seed:int, labels_path: Path | None = None) -> dict[str,object]:
    rng=np.random.default_rng(seed)
    rows=[]
    if labels_path is not None:
        X, Y, rows = load_qiskit_labels(labels_path)
    else:
        X=[]; Y=[]
        for i in range(n):
            sc=scenario(rng)
            weights, hedge, candidates=qaoa_teacher(sc, seed+1000+i)
            X.append(encode_features(sc))
            target_logits=np.log(np.clip(weights,1e-6,None)); target_logits-=target_logits.mean()
            safe_hedge = max(1e-5, min(1 - 1e-5, hedge))
            target=np.concatenate([target_logits.astype(np.float32), np.asarray([math.log(safe_hedge / (1 - safe_hedge))], dtype=np.float32)])
            Y.append(target)
            rows.append({'features':X[-1].tolist(),'target_logits':target.tolist(),'weights':weights.tolist(),'hedge':hedge,'candidate_indices':candidates.tolist()})
        X=np.stack(X).astype(np.float32); Y=np.stack(Y).astype(np.float32)
    torch.manual_seed(seed)
    model=Surrogate()
    optimizer=torch.optim.AdamW(model.parameters(),lr=0.002,weight_decay=1e-5)
    xt=torch.from_numpy(X); yt=torch.from_numpy(Y)
    for _ in range(epochs):
        optimizer.zero_grad(set_to_none=True)
        pred=model(xt)
        region_loss=F.kl_div(F.log_softmax(pred[:,:20],dim=1),F.softmax(yt[:,:20],dim=1),reduction='batchmean')
        hedge_loss=F.binary_cross_entropy_with_logits(pred[:,20],torch.sigmoid(yt[:,20]))
        loss=region_loss+0.35*hedge_loss
        loss.backward(); optimizer.step()
    with torch.no_grad():
        pred=model(xt)
        rmse=float(torch.sqrt(torch.mean((pred-yt)**2)).item())
        w_pred=F.softmax(pred[:,:20],dim=1).numpy(); w_true=F.softmax(yt[:,:20],dim=1).numpy()
        weight_rmse=float(np.sqrt(np.mean((w_pred-w_true)**2)))
        hedge_rmse=float(np.sqrt(np.mean((torch.sigmoid(pred[:,20])-torch.sigmoid(yt[:,20])).numpy()**2)))
    ARTIFACTS.mkdir(parents=True,exist_ok=True); ONNX_PATH.parent.mkdir(parents=True,exist_ok=True)
    torch.save(model.state_dict(),PT_PATH)
    ONNX_PATH.write_bytes(build_onnx(model))
    DATA_PATH.write_text('\n'.join(json.dumps(r) for r in rows)+'\n')
    manifest={
        'artifact':'public/models/quantum_controller.onnx','model_version':'v3-qaoa-surrogate-20r','input_size':84,'output_size':21,
        'architecture':'84-128-128-64-21 MLP, ReLU hidden layers; runtime postprocesses 20 region logits with softmax and hedge logit with sigmoid',
        'training_samples':n,'epochs':epochs,'seed':seed,'teacher':'actual Qiskit QAOA labels' if labels_path is not None else 'encoded one-hot p=1 QAOA reference teacher',
        'qiskit_reproduction':'qiskit_train/qiskit_qaoa.py','train_rmse':rmse,'weight_rmse':weight_rmse,'hedge_rmse':hedge_rmse,
        'onnx_bytes':ONNX_PATH.stat().st_size,'onnx_sha256':hashlib.sha256(ONNX_PATH.read_bytes()).hexdigest(),
    }
    MANIFEST_PATH.write_text(json.dumps(manifest,indent=2)+'\n')
    return manifest

if __name__=='__main__':
    ap=argparse.ArgumentParser(); ap.add_argument('--samples',type=int,default=256); ap.add_argument('--epochs',type=int,default=700); ap.add_argument('--seed',type=int,default=20261004); ap.add_argument('--labels',type=Path,default=None); args=ap.parse_args(); print(json.dumps(train(args.samples,args.epochs,args.seed,args.labels),indent=2))
