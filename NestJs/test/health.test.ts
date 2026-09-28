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

void test('Fastify accepts only configured browser origins and handles preflight', async () => {
  const previous = process.env.ALLOWED_ORIGINS;
  process.env.ALLOWED_ORIGINS = 'https://app.example.test';
  const app = await createApplication();
  try {
    await app.init();
    const allowed = await app.inject({
      method: 'OPTIONS',
      url: '/api/auth/refresh',
      headers: {
        origin: 'https://app.example.test',
        'access-control-request-method': 'POST',
      },
    });
    assert.equal(allowed.statusCode, 204);
    assert.equal(
      allowed.headers['access-control-allow-origin'],
      'https://app.example.test',
    );
    assert.equal(allowed.headers['access-control-allow-credentials'], 'true');
    const denied = await app.inject({
      method: 'OPTIONS',
      url: '/api/auth/refresh',
      headers: {
        origin: 'https://other.example.test',
        'access-control-request-method': 'POST',
      },
    });
    assert.equal(denied.statusCode, 403);
    assert.equal(denied.headers['access-control-allow-origin'], undefined);
  } finally {
    await app.close();
    if (previous === undefined) delete process.env.ALLOWED_ORIGINS;
    else process.env.ALLOWED_ORIGINS = previous;
  }
});
