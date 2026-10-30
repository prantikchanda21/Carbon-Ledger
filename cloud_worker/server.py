"""Optional standalone QAOA batch service. Deploy separately from Vercel.

Uses NumPy CPU or CuPy CUDA arrays (when installed and configured). Parallel
CPU execution uses ProcessPoolExecutor, avoiding Python GIL contention.
"""
import os, time, math, hashlib, json, secrets
from concurrent.futures import ProcessPoolExecutor, as_completed
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Header
from pydantic import BaseModel, Field, model_validator
from typing import Literal

API_KEY = os.environ.get('CLOUD_WORKER_API_KEY', '')
MAX_WORKERS = max(1, min(int(os.getenv('MAX_WORKERS','2')),8))
MAX_STATES = 4096
POOL = None

@asynccontextmanager
async def lifespan(app):
    global POOL
    POOL = ProcessPoolExecutor(max_workers=MAX_WORKERS)
    yield
    POOL.shutdown(wait=False, cancel_futures=True)

app=FastAPI(title='Carbon Ledger Quantum Compute', lifespan=lifespan)

class ComputeRequest(BaseModel):
    costs: list[float] = Field(min_length=2,max_length=MAX_STATES)
    feasible: list[bool] = Field(min_length=2,max_length=MAX_STATES)
    depth: int = Field(default=2,ge=1,le=8)
    iterations: int = Field(default=20,ge=0,le=120)
    gamma: float = Field(default=.8,ge=-100,le=100)
    beta: float = Field(default=.45,ge=-100,le=100)
    optimize: bool = True
    sweep: bool = False
    repeats: int = Field(default=1,ge=1,le=16)
    backend: Literal['auto','cpu','gpu'] = 'auto'
    @model_validator(mode='after')
    def check(self):
        n=len(self.costs)
        if len(self.feasible)!=n or n&(n-1): raise ValueError('Costs and validity must have same power-of-two length')
        if not any(self.feasible): raise ValueError('No feasible assignments')
        if not all(math.isfinite(c) for c in self.costs): raise ValueError('Costs must be finite')
        return self

def run_one(payload, depth, repeat):
    import numpy as np
    use_gpu=payload['backend'] in ('auto','gpu')
    cp=None
    if use_gpu:
        try:
            import cupy as cp
            if cp.cuda.runtime.getDeviceCount()<1: cp=None
        except (ImportError, RuntimeError): cp=None
    if payload['backend']=='gpu' and cp is None:
        raise RuntimeError('CUDA backend unavailable: install cupy-cuda12x on an NVIDIA GPU worker')
    xp=cp if cp is not None else np
    backend='gpu' if cp is not None else 'cpu'
    costs=np.asarray(payload['costs'],dtype=np.float64)
    feasible=np.asarray(payload['feasible'],dtype=bool)
    n=int(round(math.log2(len(costs))))
    mn,mx=float(costs.min()),float(costs.max())
    energies=(costs-mn)/max(mx-mn,1.0)+np.where(feasible,0,4)
    en=xp.asarray(energies)
    size=len(costs)
    masks=np.arange(size)
    pairs=[(xp.asarray(masks[(masks&(1<<bit))==0]), xp.asarray(masks[(masks&(1<<bit))==0] | (1<<bit))) for bit in range(n)]
    valid_idx=np.flatnonzero(feasible)
    optimal=min(valid_idx,key=lambda i:(costs[i],i))
    def evolve(gs,bs):
        z=xp.full(size,1/math.sqrt(size),dtype=xp.complex128)
        for g,b in zip(gs,bs):
            z*=xp.exp(-1j*g*en)
            c,s=math.cos(b),math.sin(b)
            for ids,other in pairs:
                a=z[ids].copy();v=z[other].copy()
                z[ids]=c*a-1j*s*v
                z[other]=c*v-1j*s*a
        arr=xp.abs(z)**2
        return cp.asnumpy(arr) if cp is not None else arr
    # Deterministic repeat-start offsets; no claim of quantum hardware speedup.
    gs=[float(payload['gamma'])+0.17*repeat]*depth
    bs=[float(payload['beta'])+0.11*repeat]*depth
    prob=evolve(gs,bs)
    score=lambda p:float(np.dot(p,energies))
    energy=score(prob)
    convergence=[{'iteration':0,'energy':energy}]
    t=time.perf_counter()
    if payload['optimize']:
        for step in range(1,payload['iterations']+1):
            idx=(step-1)%(depth*2); is_gamma=idx<depth;slot=idx%depth
            current=gs if is_gamma else bs
            old=current[slot];chosen=old
            delta=.84**((step-1)//(depth*2))
            for sign in (-1,1):
                trial=old+sign*delta
                tg=gs.copy();tb=bs.copy()
                (tg if is_gamma else tb)[slot]=trial
                candidate=evolve(tg,tb);candidate_energy=score(candidate)
                if candidate_energy<energy-1e-12:
                    energy=candidate_energy;chosen=trial;prob=candidate
            current[slot]=chosen
            convergence.append({'iteration':step,'energy':energy})
    modal=int(max(valid_idx,key=lambda i:(prob[i],-costs[i])))
    opt_cost=float(costs[optimal]);value=float(costs[modal])
    return {'depth':depth,'repeat':repeat,'backend':backend,'cost':value,'gapPercent':100*(value-opt_cost)/max(abs(opt_cost),1e-9),
      'feasibleProbability':float(prob[feasible].sum()),'optimalProbability':float(prob[np.logical_and(feasible,np.isclose(costs,opt_cost,atol=1e-8))].sum()),
      'candidate':modal,'energy':energy,'runtimeMs':(time.perf_counter()-t)*1000,'gamma':gs,'beta':bs,'convergence':convergence,
      'topStates':[{'mask':int(i),'probability':float(prob[i]),'cost':float(costs[i]),'feasible':bool(feasible[i])} for i in np.argsort(-prob)[:min(16,size)]]}

@app.get('/health')
def health():
    return {'ok':True,'service':'carbon-ledger-cloud-worker','maxWorkers':MAX_WORKERS,'gpu':'optional'}

@app.post('/compute')
def compute(req:ComputeRequest, x_api_key:str|None=Header(None)):
    if not API_KEY or not secrets.compare_digest(x_api_key or '', API_KEY):
        raise HTTPException(status_code=401,detail='Unauthorized')
    payload=req.model_dump()
    combinations=[(d,r) for d in (range(1,req.depth+1) if req.sweep else [req.depth]) for r in range(req.repeats)]
    if len(combinations)>64: raise HTTPException(400,'Too many jobs')
    started=time.perf_counter();results=[]
    try:
        futures=[POOL.submit(run_one,payload,d,r) for d,r in combinations]
        for f in as_completed(futures):results.append(f.result(timeout=90))
    except Exception as exc: raise HTTPException(422,str(exc)) from exc
    results.sort(key=lambda r:(r['depth'],r['repeat']))
    return {'runs':results,'wallMs':(time.perf_counter()-started)*1000,'parallelWorkers':min(MAX_WORKERS,len(combinations)),
      'objectiveHash':hashlib.sha256(json.dumps([req.costs,req.feasible]).encode()).hexdigest()}
