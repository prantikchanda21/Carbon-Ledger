const fs=require('fs');
const A=JSON.parse(fs.readFileSync('research/benchmarks/archived/V146-EXACT-LP-COMPARISON.json')).cases;
const B=JSON.parse(fs.readFileSync('research/benchmarks/archived/V146-HOLDOUT-EXACT-LP-COMPARISON.json')).cases;
const masks=[];for(let k=0;k<1024;k++){let v=k,c=0;while(v){c+=v&1;v>>>=1;}if(c===5)masks.push(k);}
function bestCase(row,option){
 const {costs,caps,preferred,regularization}=row.input;const n=20;
 const min=Math.min(...costs),max=Math.max(...costs),spread=Math.max(1e-9,max-min);
 let best=Infinity, champion=0;
 for(let batch=0;batch<4;batch++){
  const temp=option.temps[batch] * (1+option.adapt*(.05-regularization));
  const base=costs.map((v,i)=>caps[i]>0?Math.exp(-temp*(v-min)/spread):0);
  for(const mask of masks){
   const raw=new Float64Array(n),w=new Float64Array(n);
   for(let i=0;i<n;i++){
    const bit=(mask>>(i%10))&1, favor=(i<10)?bit:1-bit;
    const magnet=favor?option.mag:1/option.mag;
    const hashed=((Math.imul(mask+11,1103515245)^Math.imul(i+59,12345)^Math.imul(batch+7,9767))>>>0)%1000/1000;
    raw[i]=base[i]*magnet*(1-option.noise/2+option.noise*hashed);
   }
   let left=1;
   for(let round=0;round<n+1&&left>1e-12;round++){
    let active=0,total=0;
    for(let i=0;i<n;i++)if(caps[i]-w[i]>1e-12){active++;total+=raw[i];}
    if(!active)break;
    let used=0;
    for(let i=0;i<n;i++)if(caps[i]-w[i]>1e-12){const d=Math.min(caps[i]-w[i],left*(total>1e-14?raw[i]/total:1/active));w[i]+=d;used+=d;}
    left-=used;
   }
   if(left>1e-8)throw Error('infeasible');
   let obj=0;for(let i=0;i<n;i++)obj+=w[i]*costs[i]+regularization*Math.abs(w[i]-preferred[i]);
   if(obj<best){best=obj;champion=mask;}
  }
 }
 return (best/row.lpReference.objective-1)*100;
}
const configs=[];
for(const scale of [.7,1,1.35,1.7,2.2,2.8,3.7])for(const mag of [1.15,1.4,1.7,2.1])for(const adapt of [0,4,8]){
 const temps=[3,4.3,6,8].map(v=>v*scale);
 configs.push({temps,mag,adapt,noise:.32});
}
let results=[];
for(const option of configs){const gaps=A.map(a=>bestCase(a,option));results.push({option,train:gaps.reduce((a,b)=>a+b,0)/gaps.length});}
results.sort((a,b)=>a.train-b.train);
console.log('Top train:');console.log(results.slice(0,10));
for(const v of results.slice(0,5)){let g=B.map(row=>bestCase(row,v.option));console.log('holdout',v.option, (g.reduce((a,b)=>a+b,0)/g.length).toFixed(5),Math.max(...g).toFixed(5));}
const base={temps:[3,4.3,6,8],mag:Math.sqrt(1.32/.79),adapt:0,noise:.32};for(const [k,cases] of [['train',A],['holdout',B]]){const g=cases.map(row=>bestCase(row,base));console.log('baseline pool best',k,g.reduce((a,b)=>a+b,0)/g.length,Math.max(...g));}
fs.writeFileSync('V147-CANDIDATE-ENCODING-SWEEP.json',JSON.stringify(results.slice(0,15),null,2));
