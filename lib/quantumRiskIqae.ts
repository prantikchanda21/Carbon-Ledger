/** Auditable risk scenario model shared by classical MC and ideal IQAE query simulation.
 * WARNING: ideal Grover measurement probabilities are computed algebraically on CPU;
 * browser execution is NOT a quantum circuit or hardware advantage.
 */
export type RiskInputs={weights:Record<string,number>;carbon:number;latency:number;sla:number;seed:number};
export type RiskReport={probability:number;exact:number;mc:number;mcCalls:number;iqaeCalls:number;iqaeInterval:[number,number];mcInterval:[number,number];riskFlag:boolean;scenarioCount:number;source:'ideal-grover-query-simulation';};
const clamp=(x:number,l=0,h=1)=>Math.min(h,Math.max(l,x));
export function scenarioRisk(x:RiskInputs){
 const weights=Object.values(x.weights).filter(v=>Number.isFinite(v)&&v>0);
 const total=weights.reduce((a,b)=>a+b,0)||1;
 const concentration=weights.reduce((a,b)=>a+(b/total)**2,0);
 const base=clamp(.018+.32*concentration+.12*Math.max(0,x.latency/Math.max(1,x.sla)-.65)+.06*Math.max(0,x.carbon/600-.5),.005,.48);
 // Eight independent illustrative stress factors (256 states), not calibrated forecasts.
 const shocks=[{p:.075,severity:.28},{p:.19,severity:.13},{p:.27,severity:.08},{p:.08,severity:.09},{p:.12,severity:.10},{p:.16,severity:.07},{p:.04,severity:.12},{p:.1,severity:.08}];
 let exact=0;
 const states:{p:number;failProb:number}[]=[];
 for(let mask=0;mask<(1<<shocks.length);mask++){
  let p=1,extra=0;
  for(let j=0;j<shocks.length;j++){const hit=(mask&(1<<j))!==0;p*=hit?shocks[j].p:1-shocks[j].p;if(hit)extra+=shocks[j].severity;}
  const failProb=clamp(base+extra);states.push({p,failProb});exact+=p*failProb;
 }
 return {exact,states};
}
function rng(seed:number){let s=(seed>>>0)||1;return ()=>{s^=s<<13;s^=s>>>17;s^=s<<5;return (s>>>0)/4294967296;};}
export function estimateRisk(x:RiskInputs,target=.05):RiskReport{
 const {exact,states}=scenarioRisk(x),random=rng(x.seed),mcCalls=8704;
 let hits=0;
 for(let i=0;i<mcCalls;i++){const z=random();let accum=0,s=states[states.length-1];for(const row of states){accum+=row.p;if(z<accum){s=row;break;}}if(random()<s.failProb)hits++;}
 const mc=hits/mcCalls,mcHalf=1.96*Math.sqrt(Math.max(mc*(1-mc),.25/mcCalls)/mcCalls);
 // Ideal iterative amplitude-estimation measurement oracle: success probability
 // sin²((2k+1) asin(sqrt(a))). Grid MLE recovers amplitude from noisy counts.
 // This reproduces oracle *statistics*, not Qiskit execution or state preparation.
 const schedules=[0,1,2,4,8,16],shots=128;
 const counts=schedules.map(k=>{const p=Math.sin((2*k+1)*Math.asin(Math.sqrt(exact)))**2;let h=0;for(let i=0;i<shots;i++)if(random()<p)h++;return h;});
 let best=0,bestLL=-Infinity;const grid=4001;
 const logLikelihood=(a:number)=>{
  const theta=Math.asin(Math.sqrt(a));let ll=0;
  for(let j=0;j<schedules.length;j++){
   const p=clamp(Math.sin((2*schedules[j]+1)*theta)**2,1e-10,1-1e-10);
   ll+=counts[j]*Math.log(p)+(shots-counts[j])*Math.log(1-p);
  }
  return ll;
 };
 for(let i=1;i<grid;i++){const a=i/grid,ll=logLikelihood(a);if(ll>bestLL){bestLL=ll;best=a;}}
 // Profile-likelihood interval, approximate; no guaranteed coverage on noisy hardware.
 let lo=best,hi=best;
 for(let i=1;i<grid;i++){const a=i/grid;if(2*(bestLL-logLikelihood(a))<=3.8415){lo=Math.min(lo,a);hi=Math.max(hi,a);}}
 return {probability:best,exact,mc,mcCalls,iqaeCalls:shots*schedules.reduce((a,k)=>a+2*k+1,0),iqaeInterval:[lo,hi],mcInterval:[clamp(mc-mcHalf),clamp(mc+mcHalf)],riskFlag:hi>target,scenarioCount:states.length,source:'ideal-grover-query-simulation'};
}
