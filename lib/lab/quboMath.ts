/** Reconstruct a quadratic binary objective from its 0-, 1- and 2-bit configurations.
 * Check all states: higher-order terms must never be discarded silently.
 */
export function fitBinaryQubo(energy:readonly number[],n:number){
  if(!Number.isInteger(n)||n<1||n>20) throw new Error('QUBO variable count must be between 1 and 20.');
  if(energy.length!==2**n) throw new Error('QUBO energy table must contain exactly 2^n entries.');
  if(energy.some(v=>!Number.isFinite(v))) throw new Error('QUBO energy table contains a non-finite value.');
  const constant=energy[0];
  const linear=Array.from({length:n},(_,i)=>energy[1<<i]-constant);
  const quadratic=Array.from({length:n},()=>Array<number>(n).fill(0));
  for(let i=0;i<n;i++)for(let j=i+1;j<n;j++)quadratic[i][j]=energy[(1<<i)|(1<<j)]-constant-linear[i]-linear[j];
  const values=energy.map((_,mask)=>{
    let result=constant;
    for(let i=0;i<n;i++)if(mask&(1<<i)){
      result+=linear[i];for(let j=i+1;j<n;j++)if(mask&(1<<j))result+=quadratic[i][j];
    }
    return result;
  });
  const maxResidual=Math.max(...energy.map((v,i)=>Math.abs(v-values[i])));
  const tolerance=1e-8*Math.max(1,...energy.map(Math.abs));
  return {constant,linear,quadratic,values,maxResidual,exact:maxResidual<=tolerance};
}
