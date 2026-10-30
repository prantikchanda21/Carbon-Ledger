import {performance} from 'node:perf_hooks';
import {quadQuantumAllocation} from '../lib/quadQuantum.ts';
const input={costs:Array.from({length:20},(_,i)=>.2+i*.06),caps:Array(20).fill(.09),preferred:Array(20).fill(.05),regularization:.08};
const times=[];let last;
for(let j=0;j<31;j++){const t=performance.now();last=await quadQuantumAllocation(input);times.push(performance.now()-t);if(!last.feasible)throw Error('Allocation infeasible');}
const warm=times.slice(1).sort((x,y)=>x-y);
console.log(JSON.stringify({coldMs:times[0],warmMedianMs:warm[15],warmP95Ms:warm[28],warmMinMs:warm[0],warmMaxMs:warm.at(-1),quantumWon:last.quantumWon,classicalCandidateUsed:last.classicalCandidateUsed,weights:last.weights},null,2));
