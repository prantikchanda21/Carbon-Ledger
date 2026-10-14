import test from 'node:test';
import assert from 'node:assert/strict';
import {fitBinaryQubo} from '../lib/lab/quboMath.ts';

test('QUBO exactly reconstructs a quadratic binary objective',()=>{
  const n=4, energies=Array.from({length:1<<n},(_,mask)=>{
    const x=(i:number)=>Number(Boolean(mask&(1<<i)));
    return 2+3*x(0)-5*x(1)+4*x(2)+x(3)+7*x(0)*x(2)-2*x(1)*x(3);
  });
  const fitted=fitBinaryQubo(energies,n);
  assert.equal(fitted.exact,true);
  assert.ok(fitted.maxResidual<1e-10);
  fitted.values.forEach((e,i)=>assert.ok(Math.abs(e-energies[i])<1e-10));
});

test('higher-order interactions must not be mislabeled as exact QUBO',()=>{
  const energies=Array.from({length:8},(_,mask)=> ((mask&7)===7?9:0));
  const fitted=fitBinaryQubo(energies,3);
  assert.equal(fitted.exact,false);
  assert.ok(fitted.maxResidual>1);
});

test('QUBO inputs reject incorrect dimensions and nonfinite energies',()=>{
  assert.throws(()=>fitBinaryQubo([1,2,3],2),/2\^n/);
  assert.throws(()=>fitBinaryQubo([1,Number.NaN],1),/non-finite/);
  assert.throws(()=>fitBinaryQubo([1,2],21),/between 1 and 20/);
});
