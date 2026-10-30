"""20-region discrete carbon scheduler: quantum-simulated Grover beam vs classical MILP.
Research only. No quantum hardware, no claim of quantum speedup.
All engines share exactly the same objective and constraints.
GLPK gate requires glpsol binary and is NEVER silently replaced by HiGHS.
"""
import argparse, json, math, statistics, subprocess, time, shutil, tempfile
from pathlib import Path
import numpy as np
from scipy.optimize import milp, Bounds, LinearConstraint
from scipy.sparse import lil_matrix

REGIONS=20; SLOTS=3; QUBITS=7; STATES=1<<QUBITS
WEIGHTS={'carbon':.32, 'cost':.28, 'latency':.15, 'risk':.12, 'apy':.13}

def make_instance(seed, n_jobs=12):
 rng=np.random.default_rng(seed);R=REGIONS;T=SLOTS
 base={
  'carbon':rng.uniform(.15,.95,(T,R)),
  'cost':rng.uniform(.20,.88,(T,R)),
  'latency':rng.uniform(.08,.85,(T,R)),
  'risk':rng.uniform(.05,.75,(T,R)),
  'apy':rng.uniform(.040,.095,(T,R)),
 }
 # Correlate clean regions with premium operating costs to create genuine tradeoffs.
 base['cost']=np.clip(.55*base['cost']+.45*(1-base['carbon']),.03,.99)
 capacity=rng.integers(2,6,(T,R)).astype(float)
 tasks=[]
 for i in range(n_jobs):
  candidates=rng.choice(R,size=int(rng.integers(8,14)),replace=False)
  # Intentionally keep all slots for tasks: time-shifting is a real decision.
  tasks.append({'id':i,'demand':int(rng.integers(1,3)),'allowed':sorted(map(int,candidates)), 'prevRegion':int(rng.integers(R))})
 # Local workload periods and renewable availability are encoded as slot-dependent features.
 return {'seed':seed,'regions':R,'slots':T,'capacity':capacity.tolist(),
         'features':{k:v.tolist() for k,v in base.items()},'tasks':tasks,
         'affinityPenalty':.055, 'migrationPenalty':.016}

def unit_score(ins,job,r,t):
 f=ins['features'];d=job['demand']; w=WEIGHTS
 weighted=w['carbon']*f['carbon'][t][r]+w['cost']*f['cost'][t][r]+w['latency']*f['latency'][t][r]+w['risk']*f['risk'][t][r]-w['apy']*((f['apy'][t][r]-.04)/.055)
 return d*weighted+(ins['migrationPenalty'] if r!=job['prevRegion'] else 0)

def score(ins,placements):
 result=0.;features={k:0. for k in ('carbon','cost','latency','risk','apy')}
 for task,(r,t) in zip(ins['tasks'],placements):
  result+=unit_score(ins,task,r,t)
  for k in features:features[k]+=task['demand']*ins['features'][k][t][r]
 for i in range(0,len(placements)-1,2):
  if placements[i][0]!=placements[i+1][0]:result+=ins['affinityPenalty']
 demand=sum(x['demand'] for x in ins['tasks'])
 return result,{k:v/demand for k,v in features.items()}

def validate(ins,placements):
 if len(placements)!=len(ins['tasks']):return False
 used=np.zeros((ins['slots'],ins['regions']))
 for task,(r,t) in zip(ins['tasks'],placements):
  if not(0<=t<ins['slots'] and r in task['allowed']):return False
  used[t,r]+=task['demand']
 return bool(np.all(used<=np.array(ins['capacity'])+1e-8))

def build_mip(ins):
 tasks=ins['tasks'];R=ins['regions'];T=ins['slots'];cap=np.array(ins['capacity']);n=len(tasks)
 x=[];indices={};c=[];integrality=[];lower=[];upper=[]
 for i,job in enumerate(tasks):
  for r in job['allowed']:
   for t in range(T):
    indices[i,r,t]=len(c);x.append((i,r,t));c.append(unit_score(ins,job,r,t));integrality.append(1);lower.append(0);upper.append(1)
 y=[];yindices={}
 for i in range(0,n-1,2):
  shared=set(tasks[i]['allowed'])&set(tasks[i+1]['allowed'])
  for r in sorted(shared):
   yindices[i,r]=len(c);y.append((i,r));c.append(-ins['affinityPenalty']);integrality.append(1);lower.append(0);upper.append(1)
 # Constant affinityPenalty per pair added after solving.
 constraints=[]
 def row(expr,lo,hi):constraints.append((expr,lo,hi))
 for i in range(n):row({ix:1 for (j,r,t),ix in indices.items() if j==i},1,1)
 for t in range(T):
  for r in range(R):
   expr={ix:tasks[i]['demand'] for (i,rr,tt),ix in indices.items() if rr==r and tt==t}
   if expr:row(expr,-np.inf,cap[t,r])
 # Linearized y_(pair,region) = both tasks are placed in same region.
 for (i,r),yi in yindices.items():
  a=[ix for (j,rr,t),ix in indices.items() if j==i and rr==r]
  b=[ix for (j,rr,t),ix in indices.items() if j==i+1 and rr==r]
  row({yi:1,**{ix:-1 for ix in a}},-np.inf,0)
  row({yi:1,**{ix:-1 for ix in b}},-np.inf,0)
  exp={yi:1}
  exp.update({ix:-1 for ix in a+b})
  row(exp,-1,np.inf)
 A=lil_matrix((len(constraints),len(c)),dtype=float)
 for z,(expr,_,_) in enumerate(constraints):
  for ix,value in expr.items():A[z,ix]=value
 lb=np.array([v[1] for v in constraints]);ub=np.array([v[2] for v in constraints]);
 return {'c':np.array(c),'A':A.tocsc(),'lb':lb,'ub':ub,'integrality':np.array(integrality),
         'bounds':Bounds(lower,upper),'indices':indices,'x':x,'y':y,'yindices':yindices,
         'constant':(n//2)*ins['affinityPenalty']}

def solve_highs(ins,time_limit=2.0):
 m=build_mip(ins);t0=time.perf_counter()
 result=milp(m['c'],integrality=m['integrality'],bounds=m['bounds'],constraints=LinearConstraint(m['A'],m['lb'],m['ub']),options={'time_limit':time_limit,'mip_rel_gap':1e-8})
 ms=(time.perf_counter()-t0)*1000
 if result.x is None:return {'ok':False,'status':str(result.message),'ms':ms}
 placements=[]
 for i in range(len(ins['tasks'])):
  options=[(result.x[ix],r,t) for (j,r,t),ix in m['indices'].items() if j==i]
  _,r,t=max(options);placements.append((r,t))
 obj,metrics=score(ins,placements)
 assert validate(ins,placements)
 return {'ok':True,'optimal':result.status==0,'status':str(result.message), 'objective':obj,'metrics':metrics,'ms':ms,
         'dualBound':None if result.mip_dual_bound is None else float(result.mip_dual_bound+m['constant']),
         'mipGap':None if result.mip_gap is None else float(result.mip_gap), 'assignments':placements}

def hashed_rng(seed):return np.random.default_rng(int(seed)&0xFFFFFFFF)

def quantum_measure(energy,seed,mark_count,shots=12,phase_walk=False):
 """7-qubit Grover selective-phase oracle / reflection, p=3. Quantum state is CPU-simulated.
 Enumerating local cost energies and selecting lowest quantum samples are classical.
 """
 e=np.asarray(energy,dtype=float)
 valid=np.isfinite(e)
 if not valid.any():return []
 N=STATES;re=np.ones(N)/math.sqrt(N);im=np.zeros(N)
 finite=np.sort(e[valid]); cut=finite[min(mark_count,len(finite))-1]+1e-12
 marked=valid&(e<=cut)
 for depth in range(3):
  if phase_walk:
   # Diagonal cost phase + transverse-field quantum walk, p=3.
   # CPU emulation of unitaries; this is NOT adiabatic quantum hardware.
   finite_e=e[valid]; emin=float(np.min(finite_e));espan=max(1e-10,float(np.max(finite_e)-emin))
   theta=.08*(depth+1);phi=-theta*np.where(valid,(e-emin)/espan,1.5)
   c=np.cos(phi);s=np.sin(phi)
   re,im=re*c-im*s,re*s+im*c
   beta=.055/(depth+1);cb=math.cos(beta);sb=math.sin(beta)
   for q in range(7):
    step=1<<q
    rr=re.reshape(-1,2*step);ii=im.reshape(-1,2*step)
    ar=rr[:,:step].copy();br=rr[:,step:].copy()
    ai=ii[:,:step].copy();bi=ii[:,step:].copy()
    rr[:,:step]=cb*ar+sb*bi;ii[:,:step]=cb*ai-sb*br
    rr[:,step:]=cb*br+sb*ai;ii[:,step:]=cb*bi-sb*ar
  re[marked]*=-1;im[marked]*=-1
  re=2*re.mean()-re;im=2*im.mean()-im
 probs=re*re+im*im;probs=probs/probs.sum()
 rng=hashed_rng(seed)
 samples=rng.choice(N,size=shots,replace=True,p=probs)
 # Classical energy evaluation after measurement, no hidden classical optimum injection.
 result=list(dict.fromkeys(int(k) for k in samples if valid[k]))
 result.sort(key=lambda ix:(e[ix],ix))
 return result

def construct(ins,mode='quantum',seed=1,beam_width=5,shots=12):
 """Hybrid beam with quantum Grover candidate proposals. No GLPK or LP solution access.
 mode='uniform' is an equal-shot classical ablation; 'greedy' evaluates every valid local move.
 """
 start=time.perf_counter(); n=len(ins['tasks']); R=ins['regions'];T=ins['slots'];C=np.array(ins['capacity']);
 beam=[(0.,[],np.zeros((T,R)),tuple())]; evaluated=0
 for i,job in enumerate(ins['tasks']):
  successors=[];opts=[(r,t) for r in job['allowed'] for t in range(T)]
  for bi,(base,placements,used,_) in enumerate(beam):
   local=[]
   for (r,t) in opts:
    feasible=used[t,r]+job['demand']<=C[t,r]+1e-10
    cost=unit_score(ins,job,r,t)
    if i%2==1 and placements and placements[-1][0]!=r:cost+=ins['affinityPenalty']
    local.append(cost if feasible else float('inf'))
   energies=np.full(STATES,np.inf);energies[:len(local)]=local
   if mode=='quantum':
    # 4 repeated independent 7-qubit circuits, 3 Grover layers each.
    proposed=[]
    for b in range(4):proposed.extend(quantum_measure(energies,seed*9973+i*431+bi*71+b*97,2+b,shots=shots,phase_walk=b in (1,2)))
    selected=list(dict.fromkeys(proposed))
   elif mode=='uniform':
    rng=hashed_rng(seed*9973+i*431+bi*71)
    valid=[k for k,v in enumerate(local) if math.isfinite(v)]
    selected=list(dict.fromkeys(map(int,rng.choice(valid,size=4*shots,replace=True)))) if valid else []
   elif mode=='greedy':selected=[k for k,v in enumerate(local) if math.isfinite(v)]
   else:raise ValueError(mode)
   evaluated+=len(selected)
   for k in selected:
    if k>=len(opts) or not math.isfinite(local[k]):continue
    r,t=opts[k];newused=used.copy();newused[t,r]+=job['demand']
    p=placements+[(r,t)];successors.append((base+local[k],p,newused,tuple(p)))
  if not successors:return {'ok':False,'ms':(time.perf_counter()-start)*1000,'reason':'No feasible quantum-measured extensions'}
  successors.sort(key=lambda item:(item[0],item[3]));newbeam=[];seen=set()
  for option in successors:
   if option[3] in seen:continue
   seen.add(option[3]);newbeam.append(option)
   if len(newbeam)>=beam_width:break
  beam=newbeam
 best=beam[0];placements=best[1]
 objective,metrics=score(ins,placements)
 assert validate(ins,placements)
 return {'ok':True,'objective':objective,'metrics':metrics,'ms':(time.perf_counter()-start)*1000,
         'evaluations':evaluated,'assignments':placements,'feasible':True, 'method':mode}

def glpk_lp(ins,model, path):
 """GLPK-readable MILP encoding exactly identical to SciPy MILP, including pair affinity."""
 names=[f'x{i}' for i in range(len(model['c']))]
 def terms(v):return ' '.join((('+' if w>=0 else '-')+f' {abs(w):.12g} {names[i]}') for i,w in v if abs(w)>1e-14) or '0'
 with open(path,'w') as f:
  f.write('Minimize\n objective: '+terms(enumerate(model['c']))+'\nSubject To\n')
  for i in range(model['A'].shape[0]):
   row=model['A'].getrow(i); expr=terms(zip(row.indices,row.data));lo,hi=model['lb'][i],model['ub'][i]
   if math.isfinite(lo) and math.isfinite(hi) and abs(lo-hi)<1e-10:f.write(f' c{i}: {expr} = {lo:.12g}\n')
   else:
    if math.isfinite(lo):f.write(f' c{i}a: {expr} >= {lo:.12g}\n')
    if math.isfinite(hi):f.write(f' c{i}b: {expr} <= {hi:.12g}\n')
  f.write('Bounds\n')
  for name in names:f.write(f' 0 <= {name} <= 1\n')
  f.write('Binary\n '+' '.join(names)+'\nEnd\n')
 return names

def solve_glpk(ins, time_limit_sec=3):
 if not shutil.which('glpsol'):return {'ok':False,'unavailable':True,'reason':'glpsol not installed; actual GLPK not executed'}
 with tempfile.TemporaryDirectory() as tmp:
  model=build_mip(ins); lp=Path(tmp)/'model.lp'; sol=Path(tmp)/'sol.txt';names=glpk_lp(ins,model,lp)
  # --write gives machine-readable GLPK basic/mip solution (j index value)
  cmd=['glpsol','--lp',str(lp),'--tmlim',str(max(1,math.ceil(time_limit_sec))),'--write',str(sol),'--quiet']
  t0=time.perf_counter();p=subprocess.run(cmd,capture_output=True,text=True,timeout=time_limit_sec+3);ms=(time.perf_counter()-t0)*1000
  if not sol.exists():return {'ok':False,'ms':ms,'reason':p.stderr[-400:] or p.stdout[-400:]}
  content=sol.read_text().splitlines();vals={};status='unknown';obj=None
  for line in content:
   cells=line.split()
   if not cells or cells[0]=='c':continue
   if cells[0]=='s' and len(cells)>=6:status=cells[4]
   if cells[0]=='j' and len(cells)>=3:
    try:vals[int(cells[1])-1]=float(cells[2])
    except ValueError:pass
  if len(vals)<len(names):return {'ok':False,'ms':ms,'status':status,'reason':'GLPK solution incomplete'}
  placements=[]
  for i in range(len(ins['tasks'])):
   options=[(vals[ix],r,t) for (j,r,t),ix in model['indices'].items() if j==i]
   _,r,t=max(options);placements.append((r,t))
  if not validate(ins,placements):return {'ok':False,'ms':ms,'reason':'Invalid/incomplete MIP assignment','status':status}
  obj,metrics=score(ins,placements)
  return {'ok':True,'objective':obj,'metrics':metrics,'ms':ms,'status':status,'optimal':status=='o','assignments':placements}

def benchmark(args):
 rows=[];classes=['carbon','cost','latency','risk','apy'];N=args.cases
 for ci in range(N):
  ins=make_instance(args.seed+ci*17,args.jobs)
  ref=solve_highs(ins,args.limit);res={name:construct(ins,mode=name,seed=args.seed+ci*151,beam_width=args.beam,shots=args.shots) for name in ('quantum','uniform','greedy')}
  glpk=solve_glpk(ins,args.limit) if args.glpk else {'ok':False,'unavailable':True,'reason':'GLPK not requested'}
  rows.append({'id':ci,'instance':ins,'highs':ref,'glpk':glpk,**res})
  print(f'case {ci+1:02d}/{N}: HiGHS {ref.get("objective",0):.4f}, quantum {res["quantum"].get("objective",0):.4f}, uniform {res["uniform"].get("objective",0):.4f}, greedy {res["greedy"].get("objective",0):.4f}',flush=True)
 def avg(v):return float(np.mean(v)) if v else None
 def p95(v):return float(np.percentile(v,95)) if v else None
 summary={'cases':N,'regions':REGIONS,'slots':SLOTS,'jobs':args.jobs,'qubitsPerBatch':7,'batches':4,'groverDepth':3,
          'reference':'SciPy HiGHS mixed-integer optimizer; GLPK only if glpsol installed and run',
          'glpkCases':sum(x['glpk'].get('ok',False) for x in rows),
          'success':{mode:sum(r[mode]['ok'] for r in rows) for mode in ['quantum','uniform','greedy','highs']},
          'metrics':{}}
 for method in ['quantum','uniform','greedy','highs']:
  selected=[r[method] for r in rows if r[method]['ok']];
  if not selected:continue
  gap=[100*(r[method]['objective']-r['highs']['objective'])/max(1e-9,abs(r['highs']['objective'])) for r in rows if r[method]['ok'] and r['highs']['ok']]
  summary['metrics'][method]={'meanGapPct':avg(gap),'worstGapPct':max(gap) if gap else None,
   'medianMs':float(np.median([v['ms'] for v in selected])),'p95Ms':p95([v['ms'] for v in selected]),
   'meanObjective':avg([v['objective'] for v in selected]),
   'meanFeatures':{k:avg([v['metrics'][k] for v in selected]) for k in classes}}
 if summary['glpkCases']:
  selected=[r['glpk'] for r in rows if r['glpk']['ok']];summary['metrics']['glpk']={
   'medianMs':float(np.median([r['ms'] for r in selected])),'meanObjective':avg([r['objective'] for r in selected]),
   'meanFeatures':{k:avg([v['metrics'][k] for v in selected]) for k in classes}}
 summary['gate']={'passed':False,'promoted':False,'reasons':[]}
 if summary['glpkCases']!=N:summary['gate']['reasons'].append('No complete actual GLPK comparison')
 if any(not r['quantum']['ok'] for r in rows):summary['gate']['reasons'].append('Quantum scheduler failed feasibility')
 if any(r['quantum']['ok'] and r['highs']['ok'] and r['quantum']['objective']>r['highs']['objective']+1e-8 for r in rows):summary['gate']['reasons'].append('Quantum scheduler loses combined objective against exact MIP')
 for metric,direction in [('carbon',-1),('cost',-1),('latency',-1),('risk',-1),('apy',1)]:
  if not summary['metrics'].get('quantum') or not summary['metrics'].get('highs'):continue
  q=summary['metrics']['quantum']['meanFeatures'][metric];v=summary['metrics']['highs']['meanFeatures'][metric]
  if (q-v)*direction<=0:summary['gate']['reasons'].append(f'Quantum did not improve {metric} against reference')
 if not summary['gate']['reasons']:summary['gate']['passed']=True
 out={'summary':summary,'rows':rows}
 path=Path(__file__).resolve().parent/'benchmark-results.json';path.write_text(json.dumps(out,indent=2))
 (path.parent/'benchmark-summary.json').write_text(json.dumps(summary,indent=2))
 print(json.dumps(summary,indent=2));return out

if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--cases',type=int,default=12);p.add_argument('--jobs',type=int,default=12);p.add_argument('--seed',type=int,default=20261022);p.add_argument('--limit',type=float,default=2.0);p.add_argument('--beam',type=int,default=5);p.add_argument('--shots',type=int,default=12);p.add_argument('--glpk',action='store_true');args=p.parse_args()
 benchmark(args)
