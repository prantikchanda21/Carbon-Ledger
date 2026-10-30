"""Export QUBO by default; --hardware explicitly submits to D-Wave QPU."""
import argparse,json
from pathlib import Path
from .solver import make_problem,qubo

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--hardware',action='store_true');ap.add_argument('--seed',type=int,default=42);ap.add_argument('--reads',type=int,default=100);ap.add_argument('--output',default='artifacts/quantum-lab/annealing.json');a=ap.parse_args()
    p=make_problem(a.seed);constant,linear,pairs=qubo(p);q={(i,i):float(v) for i,v in enumerate(linear)};q.update(pairs)
    result=dict(mode='qubo-export',constant=constant,qubo=[[i,j,v] for (i,j),v in q.items()],seed=a.seed)
    if a.hardware:
        from dwave.system import DWaveSampler,EmbeddingComposite
        with DWaveSampler() as sampler:
            samples=EmbeddingComposite(sampler).sample_qubo(q,num_reads=a.reads);samples.resolve()
            result.update(mode='quantum-annealing-hardware',backend=sampler.solver.id,info=samples.info,
                samples=[dict(bits=[int(row.sample[i]) for i in range(p['n'])],energy=float(row.energy+constant),count=int(row.num_occurrences)) for row in samples.data()])
    dest=Path(a.output);dest.parent.mkdir(parents=True,exist_ok=True);dest.write_text(json.dumps(result,indent=2,default=str));print(f'Saved {result["mode"]} to {dest}')
if __name__=='__main__':main()
