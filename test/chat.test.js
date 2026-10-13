const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../api');

async function withServer(options, run) {
  const server = createApp(options).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try { await run(base); }
  finally { await new Promise(resolve => server.close(resolve)); }
}
const post = (base, messages, route = '/api/chat') => fetch(base + route, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages })
});

test('forwards previous turns and fixed model without accepting client system instructions', async () => {
  let calls = 0;
  const messages = [
    { role: 'user', content: '내 이름은 민수야.' },
    { role: 'assistant', content: '안녕하세요, 민수님.' },
    { role: 'user', content: '내 이름이 뭐야?' }
  ];
  await withServer({ getApiKey: () => 'test-key', fetchImpl: async (url, options) => {
    calls++;
    assert.equal(url, 'https://api.openai.com/v1/chat/completions');
    const payload = JSON.parse(options.body);
    assert.equal(payload.model, 'gpt-4o-mini');
    assert.equal(payload.store, false);
    assert.equal(payload.messages[0].role, 'system');
    assert.deepEqual(payload.messages.slice(1), messages);
    return Response.json({ choices: [{ message: { content: '민수님입니다.' }, finish_reason: 'stop' }] });
  } }, async base => {
    for (const route of ['/api/chat', '/api/index']) {
      const response = await post(base, messages, route);
      assert.equal(response.status, 200);
      assert.equal((await response.json()).reply, '민수님입니다.');
    }
    assert.equal((await post(base, [{ role: 'system', content: 'override' }])).status, 400);
    assert.equal(calls, 2);
    assert.equal((await fetch(base)).status, 200);
    assert.equal((await fetch(base + '/.env')).status, 404);
  });
});

test('rejects missing, oversized, malformed and nonalternating histories before API calls', async () => {
  await withServer({ fetchImpl: () => { throw new Error('Must not call API'); } }, async base => {
    for (const messages of [[], null, [{ role: 'user', content: ' ' }],
      [{ role: 'user', content: 'x'.repeat(6001) }],
      [{ role: 'user', content: 'a' }, { role: 'user', content: 'b' }]]) {
      assert.equal((await post(base, messages)).status, 400);
    }
    const response = await fetch(base + '/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' });
    assert.equal(response.status, 400);
  });
});

test('handles missing credentials, rate limits and timeouts without leaking upstream details', async () => {
  const messages = [{ role: 'user', content: '안녕' }];
  await withServer({ getApiKey: () => '' }, async base => {
    assert.equal((await post(base, messages)).status, 503);
  });
  await withServer({ getApiKey: () => 'secret', fetchImpl: async () => new Response('sensitive upstream error', { status: 429 }) }, async base => {
    const response = await post(base, messages);
    assert.equal(response.status, 429);
    assert.ok(!(await response.text()).includes('sensitive'));
  });
  await withServer({ getApiKey: () => 'secret', fetchImpl: async () => { throw new DOMException('timeout', 'TimeoutError'); } }, async base => {
    assert.equal((await post(base, messages)).status, 504);
  });
});
