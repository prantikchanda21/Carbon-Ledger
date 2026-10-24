"""Offline VQC and fidelity-kernel SVC with train-only transforms and untouched test data.
Synthetic data is demonstrative, not evidence of real-world predictive performance.
CSV columns: carbon,price,load,renewables,target[,timestamp]. Target: 0/1/2.
"""
from __future__ import annotations
import argparse, json, time
from pathlib import Path
import numpy as np
from scipy.optimize import minimize
from sklearn.preprocessing import MinMaxScaler
from sklearn.model_selection import train_test_split
from sklearn.svm import SVC
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score,f1_score,precision_score,recall_score,roc_auc_score,confusion_matrix,roc_curve,precision_recall_curve

FEATURES=['carbon','price','load','renewables']

def ry(states,q,angles):
    shape=states.reshape(len(states),-1,2,1<<q)
    a=shape[:,:,0,:].copy();b=shape[:,:,1,:].copy()
    c=np.cos(np.asarray(angles)/2);s=np.sin(np.asarray(angles)/2)
    if c.ndim: c=c[:,None,None];s=s[:,None,None]
    shape[:,:,0,:]=c*a-s*b;shape[:,:,1,:]=s*a+c*b

def features(x):
    states=np.zeros((len(x),16),complex);states[:,0]=1
    idx=np.arange(16)
    for layer in range(2):
        for q in range(4): ry(states,q,x[:,q])
        for q in range(3): states=states[:,idx^(((idx>>q)&1)<<(q+1))]
    return states

def vqc_probs(states,theta):
    states=states.copy();idx=np.arange(16)
    for layer in range(2):
        for q in range(4): ry(states,q,theta[4*layer+q])
        for q in range(3): states=states[:,idx^(((idx>>q)&1)<<(q+1))]
    p=np.abs(states)**2
    # Output readout: 00 -> low, 01 -> medium, 10 or 11 -> high.
    out=np.stack([p[:,idx%4==0].sum(1),p[:,idx%4==1].sum(1),p[:,idx%4>=2].sum(1)],axis=1)
    return out/out.sum(1,keepdims=True)

def metrics(y,p):
    pred=p.argmax(1);labels=[0,1,2]
    auc=None
    if len(np.unique(y))==3: auc=float(roc_auc_score(y,p,multi_class='ovr',average='macro'))
    curves=[]
    for c in labels:
        if len(np.unique(y==c))<2: continue
        fpr,tpr,_=roc_curve(y==c,p[:,c]);precision,recall,_=precision_recall_curve(y==c,p[:,c])
        curves.append(dict(label=c,fpr=fpr.tolist(),tpr=tpr.tolist(),precision=precision.tolist(),recall=recall.tolist()))
    return dict(accuracy=float(accuracy_score(y,pred)),macro_f1=float(f1_score(y,pred,labels=labels,average='macro',zero_division=0)),
        weighted_f1=float(f1_score(y,pred,labels=labels,average='weighted',zero_division=0)),
        precision=float(precision_score(y,pred,labels=labels,average='macro',zero_division=0)),
        recall=float(recall_score(y,pred,labels=labels,average='macro',zero_division=0)),auc=auc,confusion=confusion_matrix(y,pred,labels=labels).tolist(),curves=curves)

def run(samples=240,seed=42,csv=None,iterations=120):
    rng=np.random.default_rng(seed)
    timestamp=None
    if csv:
        data=np.genfromtxt(csv,delimiter=',',names=True,dtype=None,encoding='utf-8')
        if not set(FEATURES+['target']).issubset(data.dtype.names or []): raise ValueError('CSV missing required columns')
        x=np.column_stack([data[f] for f in FEATURES]).astype(float); raw_target=np.asarray(data['target'],float)
        if not np.isfinite(raw_target).all() or np.any(raw_target!=np.floor(raw_target)):raise ValueError('Targets must be integers 0/1/2')
        y=raw_target.astype(int)
        if 'timestamp' in data.dtype.names: timestamp=np.asarray(data['timestamp']).astype('datetime64[s]')
    else:
        x=rng.uniform(0,1,(samples,4))
        future=.6*x[:,0]+.25*x[:,2]-.4*x[:,3]+.15*np.sin(3*x[:,1])+rng.normal(0,.10,samples)
        y=np.digitize(future,[.18,.43])
    if len(x)<90 or len(x)>2000 or not np.isfinite(x).all() or not set(np.unique(y)).issubset({0,1,2}): raise ValueError('Need 90–2000 finite rows, target 0/1/2')
    idx=np.arange(len(x))
    if timestamp is not None:
        if np.isnat(timestamp).any():raise ValueError('Invalid timestamps')
        order=np.argsort(timestamp);a=int(.6*len(x));b=int(.8*len(x));train,val,test=order[:a],order[a:b],order[b:]
    else:
        train,hold=train_test_split(idx,test_size=.4,random_state=seed,stratify=y)
        val,test=train_test_split(hold,test_size=.5,random_state=seed,stratify=y[hold])
    if len(np.unique(y[train]))!=3: raise ValueError('Training partition must contain all three classes')
    scaler=MinMaxScaler(feature_range=(0,np.pi),clip=True).fit(x[train]);z=scaler.transform(x)
    encoded=features(z);tr=encoded[train];va=encoded[val];te=encoded[test]
    rows=[];models={};start=time.perf_counter();best=None
    def loss(t): return float(-np.log(np.maximum(vqc_probs(tr,t)[np.arange(len(train)),y[train]],1e-9)).mean())
    for restart in range(3):
        fit=minimize(loss,rng.uniform(-np.pi,np.pi,8),method='COBYLA',options={'maxiter':iterations,'rhobeg':.5})
        score=metrics(y[val],vqc_probs(va,fit.x))['macro_f1']
        if best is None or score>best[0]: best=(score,fit.x)
    theta=best[1];rows.append(dict(model='VQC (4 qubits)',validation_macro_f1=best[0],train_ms=(time.perf_counter()-start)*1000,**metrics(y[test],vqc_probs(te,theta))))
    kernel_train=np.abs(tr.conj()@tr.T)**2;kernel_val=np.abs(va.conj()@tr.T)**2;kernel_test=np.abs(te.conj()@tr.T)**2
    for name in ('Quantum kernel SVC','RBF SVM','Logistic regression','Random forest'):
        start=time.perf_counter();selected=None
        for setting in (0.1,1.,10.):
            if name=='Quantum kernel SVC': model=SVC(kernel='precomputed',C=setting,probability=True,random_state=seed)
            elif name=='RBF SVM': model=SVC(C=setting,probability=True,random_state=seed)
            elif name=='Logistic regression': model=LogisticRegression(C=setting,max_iter=1000,random_state=seed)
            else: model=RandomForestClassifier(n_estimators=100,max_depth={.1:3,1.:6,10.:None}[setting],random_state=seed)
            model.fit(kernel_train if name=='Quantum kernel SVC' else z[train],y[train])
            vp=model.predict_proba(kernel_val if name=='Quantum kernel SVC' else z[val]);score=metrics(y[val],vp)['macro_f1']
            if selected is None or score>selected[0]: selected=(score,model)
        score,model=selected;models[name]=model
        p=model.predict_proba(kernel_test if name=='Quantum kernel SVC' else z[test])
        rows.append(dict(model=name,validation_macro_f1=score,train_ms=(time.perf_counter()-start)*1000,**metrics(y[test],p)))
    artifact=dict(schema_version=1,synthetic=csv is None,seed=seed,features=FEATURES,classes=['low','medium','high'],
        split='chronological 60/20/20' if timestamp is not None else 'stratified 60/20/20',
        counts=dict(train=len(train),validation=len(val),test=len(test)),rows=rows,
        vqc=dict(theta=theta.tolist(),scale=scaler.scale_.tolist(),offset=scaler.min_.tolist()),
        note='Quantum circuits simulated on CPU. QSVC uses a fidelity kernel and a classical SVM optimizer. Model choice uses validation only. No quantum advantage claimed.')
    return artifact,models,scaler,encoded[train],y[train]

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--samples',type=int,default=240);ap.add_argument('--seed',type=int,default=42);ap.add_argument('--csv');ap.add_argument('--iterations',type=int,default=120);ap.add_argument('--output',default='public/data/quantum-risk-v8.json');args=ap.parse_args()
    result,models,scaler,training_states,training_labels=run(args.samples,args.seed,args.csv,args.iterations)
    path=Path(args.output);path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(result,indent=2))
    import joblib
    Path('artifacts/quantum-lab').mkdir(parents=True,exist_ok=True)
    joblib.dump(dict(models=models,scaler=scaler,training_states=training_states,training_labels=training_labels),'artifacts/quantum-lab/risk-models.joblib')
    print(json.dumps({'output':str(path),'test_metrics':[{k:r[k] for k in ('model','accuracy','macro_f1')} for r in result['rows']]}))
if __name__=='__main__':main()
