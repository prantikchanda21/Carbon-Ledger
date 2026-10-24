"""Train a contract-compatible 84->21 ONNX candidate; promote only after held-out checks.
The teacher is a one-hot quantum walk/QAOA simulation, independently optimized per
scenario. The legacy dashboard task remains separate from multi-workload scheduling.
"""
import argparse,hashlib,json,time,shutil
from pathlib import Path
import numpy as np
from scipy.optimize import minimize
from scipy.special import softmax,expit
from sklearn.neural_network import MLPRegressor
from sklearn.model_selection import train_test_split
from qiskit_train.qaoa_reference import scenario,encode_features

ROOT=Path(__file__).resolve().parents[1]

def capped(w,eligible,cap=.7):
    w=np.where(eligible,np.maximum(w,0),0).astype(float)
    if not w.sum(): w=eligible.astype(float)
    cap=max(cap,1/max(eligible.sum(),1));out=np.zeros(len(w));free=eligible.copy();remaining=1.
    for _ in range(len(w)+1):
        if not free.any(): break
        p=w[free];p=p/p.sum() if p.sum()>0 else np.ones(len(p))/len(p)
        idx=np.flatnonzero(free);over=p*remaining>cap
        if not over.any(): out[idx]=p*remaining;break
        fixed=idx[over];out[fixed]=cap;free[fixed]=False;remaining-=len(fixed)*cap
    return out

def teacher(sc,seed):
    carbon,price,latency,egress=sc.region_features.T
    cost=price/1000+sc.carbon_tax*.25*carbon/1000+egress*.05
    eligible=latency<=sc.sla_ms
    if not eligible.any(): eligible=latency==latency.min()
    ids=np.flatnonzero(eligible);k=len(ids)
    # Ring XY Hamiltonian restricted to the one-excitation subspace.
    mixer=np.zeros((k,k))
    if k>1:
        for i in range(k): mixer[i,(i+1)%k]=mixer[(i+1)%k,i]=1
    eig,vec=np.linalg.eigh(mixer)
    c=cost[ids];scaled=(c-c.min())/max(float(np.ptp(c)),1e-6)
    initial=np.sqrt(softmax(-3*scaled)).astype(complex)
    def state(theta):
        psi=initial.copy()
        for layer in range(2): psi=vec@(np.exp(-1j*theta[layer]*eig)*(vec.T@(psi*np.exp(-1j*theta[layer+2]*scaled))))
        return psi
    def objective(t): return float(np.abs(state(t))**2@scaled)
    best=None;rng=np.random.default_rng(seed)
    for _ in range(2):
        fit=minimize(objective,rng.uniform(0,1,4),method='COBYLA',options={'maxiter':45,'rhobeg':.3})
        if best is None or fit.fun<best.fun: best=fit
    w=np.zeros(20);w[ids]=np.abs(state(best.x))**2;w=capped(w,eligible)
    # Legacy hedge head is explicitly a classical exposure heuristic, NOT QAOA output.
    exposure=float(w@carbon)/1000
    hedge=float(expit(-1+2*exposure+.25*(sc.treasury_yield-7)))
    target=np.log(np.maximum(w,1e-7));target-=target.mean()
    return np.r_[target,np.log(hedge/(1-hedge))],w,hedge,cost,eligible

def export(model,path):
    import onnx
    from onnx import helper,numpy_helper,TensorProto
    nodes=[];tensors=[];prev='telemetry'
    for i,(w,b) in enumerate(zip(model.coefs_,model.intercepts_)):
        tensors.extend([numpy_helper.from_array(w.astype('float32'),f'w{i}'),numpy_helper.from_array(b.astype('float32'),f'b{i}')])
        nodes.extend([helper.make_node('MatMul',[prev,f'w{i}'],[f'm{i}']),helper.make_node('Add',[f'm{i}',f'b{i}'],[f'z{i}'])]);prev=f'z{i}'
        if i<len(model.coefs_)-1: nodes.append(helper.make_node('Relu',[prev],[f'a{i}']));prev=f'a{i}'
    nodes.append(helper.make_node('Identity',[prev],['policy_logits']))
    graph=helper.make_graph(nodes,'quantum-distilled-v8',[helper.make_tensor_value_info('telemetry',TensorProto.FLOAT,[1,84])],[helper.make_tensor_value_info('policy_logits',TensorProto.FLOAT,[1,21])],tensors)
    artifact=helper.make_model(graph,opset_imports=[helper.make_opsetid('',17)]);artifact.ir_version=9;onnx.checker.check_model(artifact);onnx.save(artifact,path)

def evaluate(pred,labels,weights,costs,eligible):
    projected=np.stack([capped(w,e) for w,e in zip(softmax(np.clip(pred[:,:20],-20,20),axis=1),eligible)])
    exact=[]
    for c,e in zip(costs,eligible):
        w=np.zeros(20);remaining=1;cap=max(.7,1/e.sum())
        for i in np.argsort(c):
            if e[i]: w[i]=min(cap,remaining);remaining-=w[i]
            if remaining<1e-10:break
        exact.append(w@c)
    objective=(projected*costs).sum(1);exact=np.array(exact)
    return dict(weight_rmse=float(np.sqrt(np.mean((projected-weights)**2))),mean_gap_pct=float(np.mean((objective-exact)/exact)*100),
        p95_gap_pct=float(np.percentile((objective-exact)/exact*100,95)),hedge_rmse=float(np.sqrt(np.mean((expit(pred[:,20])-expit(labels[:,20]))**2))),
        constraint_violations=int(sum(abs(w.sum()-1)>1e-6 or np.any(w[~e]>1e-8) or np.any(w>max(.7,1/e.sum())+1e-6) for w,e in zip(projected,eligible))))

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--samples',type=int,default=1200);ap.add_argument('--seed',type=int,default=2026);ap.add_argument('--promote',action='store_true');args=ap.parse_args()
    if args.samples<150:ap.error('At least 150 examples required')
    start=time.perf_counter();rng=np.random.default_rng(args.seed);x=[];y=[];weights=[];costs=[];eligible=[]
    for i in range(args.samples):
        sc=scenario(rng);label,w,h,c,e=teacher(sc,args.seed+i);x.append(encode_features(sc));y.append(label);weights.append(w);costs.append(c);eligible.append(e)
        if (i+1)%200==0:print(f'Teacher {i+1}/{args.samples}',flush=True)
    x=np.array(x);y=np.array(y);weights=np.array(weights);costs=np.array(costs);eligible=np.array(eligible)
    train,hold=train_test_split(np.arange(len(x)),test_size=.3,random_state=args.seed);val,test=train_test_split(hold,test_size=.5,random_state=args.seed)
    selected=None
    for alpha in (.001,.01):
        model=MLPRegressor(hidden_layer_sizes=(128,128,64),max_iter=220,early_stopping=True,validation_fraction=.1,n_iter_no_change=20,alpha=alpha,random_state=args.seed)
        model.fit(x[train],y[train]);metrics=evaluate(model.predict(x[val]),y[val],weights[val],costs[val],eligible[val])
        if selected is None or metrics['mean_gap_pct']<selected[0]:selected=(metrics['mean_gap_pct'],model)
    model=selected[1];folder=ROOT/'artifacts/quantum-lab';folder.mkdir(parents=True,exist_ok=True);candidate=folder/'quantum_controller_v8.onnx';export(model,candidate)
    import onnxruntime as ort
    opts=ort.SessionOptions();opts.intra_op_num_threads=1;opts.inter_op_num_threads=1
    def predictions(path):
        session=ort.InferenceSession(str(path),sess_options=opts,providers=['CPUExecutionProvider']);return np.vstack([session.run(None,{session.get_inputs()[0].name:row.astype('float32')[None,:]})[0] for row in x[test]])
    old=ROOT/'public/models/quantum_controller.onnx';new_pred=predictions(candidate);old_pred=predictions(old)
    if not np.allclose(new_pred,model.predict(x[test]),atol=1e-4):raise RuntimeError('ONNX export disagrees with Python')
    new=evaluate(new_pred,y[test],weights[test],costs[test],eligible[test]);baseline=evaluate(old_pred,y[test],weights[test],costs[test],eligible[test])
    passes=new['constraint_violations']==0 and new['mean_gap_pct']<=baseline['mean_gap_pct'] and new['p95_gap_pct']<=baseline['p95_gap_pct'] and new['weight_rmse']<=baseline['weight_rmse']
    promoted=False
    if args.promote and passes:
        shutil.copy2(old,folder/'quantum_controller_previous.onnx');shutil.copy2(candidate,old);promoted=True
    manifest=dict(model_version='v8-xy-distilled-20r',input_size=84,output_size=21,synthetic=True,seed=args.seed,
        split=dict(train=len(train),validation=len(val),test=len(test)),teacher='p=2 ring XY, ideal one-hot subspace simulation; classical hedge heuristic',
        baseline=baseline,candidate=new,gate_passed=passes,promoted=promoted,elapsed_seconds=time.perf_counter()-start,
        onnx_sha256=hashlib.sha256(candidate.read_bytes()).hexdigest(),note='Synthetic held-out validation only. Gate compares matched projected constraints; no real-world savings claim.')
    (folder/'surrogate-validation.json').write_text(json.dumps(manifest,indent=2));np.savez_compressed(folder/'surrogate-dataset.npz',x=x,y=y,train=train,validation=val,test=test)
    print(json.dumps(manifest,indent=2))
if __name__=='__main__':main()
