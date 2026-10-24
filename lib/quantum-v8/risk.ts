/** Matches quantum_lab/risk.py: four-qubit RY/CNOT circuit, CPU simulation. */
export function predictVqc(input: number[], artifact: {theta:number[];scale:number[];offset:number[]}): number[] {
  if(input.length!==4 || input.some(x=>!Number.isFinite(x))) throw new Error('Four finite features required');
  let state=new Float64Array(16);state[0]=1;
  const ry=(q:number,angle:number)=>{const c=Math.cos(angle/2),s=Math.sin(angle/2);for(let i=0;i<16;i++){if(i&(1<<q))continue;const j=i|(1<<q),a=state[i]!,b=state[j]!;state[i]=c*a-s*b;state[j]=s*a+c*b;}};
  const entangle=()=>{for(let q=0;q<3;q++){const next=new Float64Array(16);for(let i=0;i<16;i++)next[i]=state[i^(((i>>q)&1)<<(q+1))]!;state=next;}};
  const x=input.map((v,i)=>Math.max(0,Math.min(Math.PI,v*artifact.scale[i]!+artifact.offset[i]!)));
  for(let layer=0;layer<2;layer++){for(let q=0;q<4;q++)ry(q,x[q]!);entangle();}
  for(let layer=0;layer<2;layer++){for(let q=0;q<4;q++)ry(q,artifact.theta[4*layer+q]!);entangle();}
  const result=[0,0,0];for(let i=0;i<16;i++)result[Math.min(i%4,2)]!+=state[i]!*state[i]!;
  const total=result.reduce((a,b)=>a+b,0);return result.map(p=>p/total);
}
