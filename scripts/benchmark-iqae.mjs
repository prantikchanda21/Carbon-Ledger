// Reproducible, fair comparison of browser ideal-query simulation to plain MC.
// Does not run physical quantum hardware.
import {estimateRisk} from '../lib/quantumRiskIqae.ts';
const samples=[];
for(let i=1;i<=100;i++){
 const weights=Object.fromEntries(Array.from({length:20},(_,j)=>['r'+j,Math.abs(Math.sin(i*.11+j*.7))+.01]));
 const result=estimateRisk({weights,carbon:300+(i%15)*12,latency:38+(i%25),sla:80,seed:i*7907});
 samples.push({iqaeError:Math.abs(result.probability-result.exact),mcError:Math.abs(result.mc-result.exact),iqaeCalls:result.iqaeCalls,mcCalls:result.mcCalls});
}
const mean=key=>samples.reduce((sum,row)=>sum+row[key],0)/samples.length;
const report={scenarioCount:samples.length,iqaeMeanAbsoluteError:mean('iqaeError'),mcMeanAbsoluteError:mean('mcError'),iqaeMeanOracleCalls:mean('iqaeCalls'),mcMeanSamples:mean('mcCalls'),disclaimer:'Ideal Grover measurement statistics simulated classically. QAE oracle calls are not comparable in physical cost to MC samples; no wall-clock or hardware advantage established.'};
console.log(JSON.stringify(report,null,2));
