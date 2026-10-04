import test from 'node:test';
import assert from 'node:assert/strict';
import { groqChat, groqProviders } from '../lib/groq.ts';

const req = { messages: [{ role: 'user' as const, content: 'hi' }], temperature: 0, max_tokens: 10 };
const ok = (text: string) => new Response(JSON.stringify({ choices: [{ message: { content: text } }] }), { status: 200 });
const silence = () => { const orig = console.error; console.error = () => {}; return () => { console.error = orig; }; };

test('no keys configured returns null and no providers', async () => {
  assert.equal(groqProviders({}).length, 0);
  assert.equal(await groqChat(req, 1000, {}, (async () => { throw new Error('should not call'); }) as typeof fetch), null);
});

test('second key is registered as backup and duplicates are ignored', () => {
  const p = groqProviders({ GROQ_API_KEY: 'a', GROQ_API_KEY_2: 'b', GROQ_MODEL: 'm1', GROQ_MODEL_2: 'm2' });
  assert.deepEqual(p.map((x) => [x.slot, x.model]), [['primary', 'm1'], ['backup', 'm2']]);
  assert.equal(groqProviders({ GROQ_API_KEY: 'a', GROQ_API_KEY_2: 'a' }).length, 1);
  assert.equal(groqProviders({ GROQ_API_KEY_2: 'b' })[0].slot, 'primary');
});

test('primary is used first and backup is skipped on success', async () => {
  const used: string[] = [];
  const f = (async (_u: string, init: RequestInit) => { used.push(String((init.headers as Record<string, string>).authorization)); return ok('primary reply'); }) as unknown as typeof fetch;
  const r = await groqChat(req, 4000, { GROQ_API_KEY: 'a', GROQ_API_KEY_2: 'b' }, f);
  assert.equal(r?.slot, 'primary');
  assert.deepEqual(used, ['Bearer a']);
});

test('backup key takes over when the primary is rate limited or throws', async () => {
  const restore = silence();
  try {
    const f1 = (async (_u: string, init: RequestInit) => (String((init.headers as Record<string, string>).authorization).endsWith('a') ? new Response('rate limited', { status: 429 }) : ok('backup reply'))) as unknown as typeof fetch;
    const r1 = await groqChat(req, 4000, { GROQ_API_KEY: 'a', GROQ_API_KEY_2: 'b' }, f1);
    assert.deepEqual([r1?.slot, r1?.content], ['backup', 'backup reply']);
    const f2 = (async (_u: string, init: RequestInit) => { if (String((init.headers as Record<string, string>).authorization).endsWith('a')) throw new Error('network'); return ok('backup reply'); }) as unknown as typeof fetch;
    assert.equal((await groqChat(req, 4000, { GROQ_API_KEY: 'a', GROQ_API_KEY_2: 'b' }, f2))?.slot, 'backup');
  } finally { restore(); }
});

test('returns null when every key fails', async () => {
  const restore = silence();
  try {
    const f = (async () => new Response('x', { status: 500 })) as unknown as typeof fetch;
    assert.equal(await groqChat(req, 4000, { GROQ_API_KEY: 'a', GROQ_API_KEY_2: 'b' }, f), null);
  } finally { restore(); }
});

test('balance strategy alternates the first key', async () => {
  const firsts: string[] = [];
  const f = (async (_u: string, init: RequestInit) => { firsts.push(String((init.headers as Record<string, string>).authorization)); return ok('x'); }) as unknown as typeof fetch;
  const env = { GROQ_API_KEY: 'a', GROQ_API_KEY_2: 'b', GROQ_STRATEGY: 'balance' };
  await groqChat(req, 4000, env, f); await groqChat(req, 4000, env, f);
  assert.notEqual(firsts[0], firsts[1]);
});
