import test from 'node:test';
import assert from 'node:assert/strict';
import { portalApi } from './api.ts';

test('purgeContracts sends the confirmation payload required by the backend', async () => {
  const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
  const originalFetch = global.fetch;

  global.fetch = (async (input, init) => {
    calls.push({ input, init });
    return new Response(JSON.stringify({ deletedCount: 1 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }) as typeof fetch;

  try {
    await portalApi.purgeContracts('token-123');

    assert.equal(calls.length, 1);
    assert.equal(calls[0].init?.method, 'DELETE');
    assert.equal(calls[0].input, '/api/contracts/purge');
    assert.equal(calls[0].init?.body, JSON.stringify({ confirm: true, confirmToken: 'PURGE_CONTRACTS' }));
  } finally {
    global.fetch = originalFetch;
  }
});
