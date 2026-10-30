import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fractionalAllocationPolicy,capacityAt} from '../lib/fractionalAllocation.ts';
import type {NodeReport,ControlState} from '../lib/types.ts';

test('fractional policy produces diverse modeled caps and normalized targets',()=>{
 const nodes=Array.from({length:20},(_,i)=>({id:`r${i}`,eligible:true,renewable_pct:15+(i*11)%70,latency_ms:20+i*3,energy_price:50+i*3,carbon_ci:300+i*10})) as unknown as NodeReport[];
 const controls={sla_ms:90,carbon_tax:.8,budget_cr:50} as ControlState;
 const p=fractionalAllocationPolicy(nodes,controls,nodes.map((_,i)=>i/20));
 assert.ok(Math.abs(p.preferred.reduce((a,b)=>a+b,0)-1)<1e-10);
 assert.ok(p.caps.reduce((a,b)=>a+b,0)>=1);
 assert.ok(new Set(p.caps.map(v=>v.toFixed(5))).size>5);
 assert.ok(p.preferred.some(x=>Math.abs(x*100-Math.round(x*100))>1e-4));
 assert.equal(capacityAt({ids:nodes.map(n=>n.id),costs:[],eligible:nodes.map(()=>true),cap:1,caps:p.caps},0),p.caps[0]);
});
