import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canonicalJson, sha256, verifyAuditChain } from '../lib/auditChain.ts';
test('canonical serialization is invariant to key order', () => {
  assert.equal(canonicalJson({z:2,a:{y:3,x:4}}),canonicalJson({a:{x:4,y:3},z:2}));
});
test('SHA-256 chain detects an edited decision payload',async () => {
  const payload={decision:'allocate',region:'mumbai'};
  const first={payload,prev_hash:'GENESIS',hash:await sha256('GENESIS'+canonicalJson(payload))};
  const secondPayload={decision:'rollback'};
  const second={payload:secondPayload,prev_hash:first.hash,hash:await sha256(first.hash+canonicalJson(secondPayload))};
  const verified=await verifyAuditChain([first,second]);
  assert.equal(verified.valid,true);
  assert.equal(verified.head,second.hash);
  assert.deepEqual(await verifyAuditChain([first,{...second,payload:{decision:'approve'}}]),{valid:false,index:1,head:first.hash});
});
