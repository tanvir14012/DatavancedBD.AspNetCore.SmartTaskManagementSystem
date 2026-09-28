import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createApplication } from '../src/bootstrap.js';

void test('Fastify liveness is independent of unavailable business dependencies', async () => {
  const app = await createApplication();
  try {
    await app.init();
    const alive = await app.inject({ method: 'GET', url: '/alive' });
    assert.equal(alive.statusCode, 200);
    assert.equal(alive.body, 'Healthy');
    for (const url of ['/ready', '/health']) {
      assert.equal((await app.inject({ method: 'GET', url })).statusCode, 503);
    }
    assert.equal(
      (await app.inject({ method: 'GET', url: '/api/projects' })).statusCode,
      503,
    );
  } finally {
    await app.close();
  }
});
