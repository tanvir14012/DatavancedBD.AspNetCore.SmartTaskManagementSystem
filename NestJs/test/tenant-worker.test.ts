import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TenantContextAuthorizer } from '../src/application/tenancy/authorizer.js';
import type { TenantAuthorityReader } from '../src/application/tenancy/ports.js';
import {
  TenantWorker,
  TenantWorkItem,
  type TenantJobDeduplicator,
  type TenantJobQueue,
  type TenantWorkAdmission,
  type TenantWorkHandler,
} from '../src/application/worker/tenant-worker.js';
import {
  TenantAccess,
  TenantIsolation,
  TenantLifecycle,
  TenantPlacement,
} from '../src/domain/tenancy.js';

const a = 'a93c4ba4-1bcb-46c9-ad6e-3dde4c7860be';
const b = 'dfc17bd9-eab0-480b-bec4-ed86116f9431';
const signal = new AbortController().signal;

void test('worker reauthorizes two tenants, fences stale placements and scopes idempotency keys', async () => {
  const completed: string[] = [];
  const started: string[] = [];
  const handled: string[] = [];
  const released: string[] = [];
  const items = [
    new TenantWorkItem(
      'same-job',
      a,
      TenantIsolation.Database,
      'target-a',
      1n,
      new TenantAccess(a, '7', 'issuer'),
    ),
    new TenantWorkItem(
      'same-job',
      b,
      TenantIsolation.Database,
      'target-b',
      1n,
      new TenantAccess(b, '7', 'issuer'),
    ),
    new TenantWorkItem(
      'stale-job',
      a,
      TenantIsolation.Database,
      'target-a',
      2n,
      new TenantAccess(a, '7', 'issuer'),
    ),
    new TenantWorkItem(
      'revoked-job',
      b,
      TenantIsolation.Database,
      'target-b',
      1n,
      new TenantAccess(b, '8', 'issuer'),
    ),
  ];
  const reader: TenantAuthorityReader = {
    findTenant: () => Promise.resolve(null),
    isActiveMember: (access) => Promise.resolve(access.subjectId === '7'),
    findPlacement: (id) =>
      Promise.resolve(
        new TenantPlacement(
          id,
          TenantIsolation.Database,
          id === a ? 'target-a' : 'target-b',
          null,
          'east',
          1n,
          TenantLifecycle.Active,
        ),
      ),
  };
  const queue: TenantJobQueue = {
    async *read() {
      await Promise.resolve();
      for (const item of items) yield item;
    },
    complete(item) {
      completed.push(`${item.tenantId}:${item.jobId}`);
      return Promise.resolve();
    },
    abandon() {
      throw new Error('No job should be retried.');
    },
  };
  const deduplicator: TenantJobDeduplicator = {
    tryBegin(key) {
      started.push(key);
      return Promise.resolve(true);
    },
    complete: () => Promise.resolve(),
    abandon: () => Promise.resolve(),
  };
  const admission: TenantWorkAdmission = {
    acquire(id) {
      return Promise.resolve(() => {
        released.push(id);
        return Promise.resolve();
      });
    },
  };
  const handler: TenantWorkHandler = {
    handle(item, context) {
      assert.equal(context.placement.tenantId, item.tenantId);
      handled.push(item.tenantId);
      return Promise.resolve();
    },
  };
  await new TenantWorker(
    queue,
    deduplicator,
    admission,
    new TenantContextAuthorizer(reader, 'east'),
    handler,
    2,
  ).run(signal);
  assert.deepEqual(handled.sort(), [a, b].sort());
  assert.deepEqual(started.slice(0, 2), [`${a}:same-job`, `${b}:same-job`]);
  assert.equal(completed.length, 4);
  assert.equal(released.length, 4);
});
