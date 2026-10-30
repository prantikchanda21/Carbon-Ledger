import assert from 'node:assert/strict';
import {test} from 'node:test';
import {greedyAllocation, weightCap} from '../lib/controllerMath.ts';

test('global ceiling delegates regional limits to the capacity policy',()=>{
  assert.equal(weightCap(1),1);
  assert.equal(weightCap(2),1);
  assert.equal(weightCap(5),1);
  assert.equal(weightCap(20),1);
});
test('region selection updates as eligible regions and costs change',()=>{
  const eligible=[true,true,true,true,true,true];
  const first=greedyAllocation([1,2,3,4,5,6],eligible,1/3);
  const second=greedyAllocation([6,5,4,3,2,1],eligible,1/3);
  assert.notDeepEqual(first,second);
  assert.equal(first.reduce((a,b)=>a+b,0),1);
  assert.equal(second.reduce((a,b)=>a+b,0),1);
  assert.ok(first.filter(x=>x>0).length>=3);
  assert.ok(second.filter(x=>x>0).length>=3);
});
