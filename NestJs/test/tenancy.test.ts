import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  TenantAccess,
  TenantAccessDenied,
  TenantContextScope,
  TenantIsolation,
  TenantLifecycle,
  TenantPlacement,
} from '../src/domain/tenancy.js';
import { TenantAuthorityReader } from '../src/application/tenancy/ports.js';
import {
  TenantRequestResolver,
  normalizeAuthority,
} from '../src/application/tenancy/resolver.js';
import { TenantContextAuthorizer } from '../src/application/tenancy/authorizer.js';

const a = 'a93c4ba4-1bcb-46c9-ad6e-3dde4c7860be';
const b = 'dfc17bd9-eab0-480b-bec4-ed86116f9431';
const signal = new AbortController().signal;

class Authority implements TenantAuthorityReader {
  active = true;
  version = 1n;
  lifecycle = TenantLifecycle.Active;
  region = 'east';
  lookups = 0;

  findTenant(host: string): Promise<string | null> {
    return Promise.resolve(
      host === 'a.example.test' || host === 'a.example.test:3002'
        ? a
        : host === 'b.example.test'
          ? b
          : null,
    );
  }
  isActiveMember(access: TenantAccess): Promise<boolean> {
    return Promise.resolve(
      this.active && access.subjectId === '42' && access.issuer === 'issuer',
    );
  }
  findPlacement(id: string): Promise<TenantPlacement> {
    this.lookups++;
    return Promise.resolve(
      new TenantPlacement(
        id,
        TenantIsolation.Database,
        `db-${id}`,
        null,
        this.region,
        this.version,
        this.lifecycle,
      ),
    );
  }
}

void test('two tenants with colliding subjects retain distinct immutable scopes concurrently', async () => {
  const authority = new Authority();
  const resolver = new TenantRequestResolver(authority, ['api.example.test']);
  const authorizer = new TenantContextAuthorizer(authority, 'east');
  const contexts = await Promise.all(
    [a, b].map(async (id) => {
      const candidate = await resolver.resolve('API.EXAMPLE.TEST', id, signal);
      const scope = new TenantContextScope();
      assert.throws(() => scope.current, TenantAccessDenied);
      scope.initialize(
        await authorizer.authorize(
          candidate,
          new TenantAccess(id, '42', 'issuer'),
          signal,
        ),
      );
      assert.throws(() => scope.initialize(scope.current));
      assert.equal(Object.isFrozen(scope.current), true);
      assert.equal(Object.isFrozen(scope.current.placement), true);
      return scope.current;
    }),
  );
  assert.deepEqual(
    contexts.map((context) => context.placement.tenantId),
    [a, b],
  );
  await assert.rejects(
    authorizer.authorize(a, new TenantAccess(b, '42', 'issuer'), signal),
    TenantAccessDenied,
  );
});

void test('unknown hosts, conflicting selectors, missing and malformed selectors never fall back', async () => {
  const resolver = new TenantRequestResolver(new Authority(), [
    'api.example.test',
  ]);
  for (const [host, selector] of [
    ['unknown.test', a],
    ['api.example.test', undefined],
    ['a.example.test', b],
    ['api.example.test:443', a],
    ['api.example.test.attacker.test', a],
    ['a.example.test', [a, b]],
    ['a.example.test', ` ${a}`],
    ['a.example.test', `${a},${b}`],
    ['a.example.test', '00000000-0000-0000-0000-000000000000'],
  ]) {
    await assert.rejects(
      resolver.resolve(host, selector, signal),
      TenantAccessDenied,
    );
  }
  assert.equal(
    await resolver.resolve('A.EXAMPLE.TEST', a.toUpperCase(), signal),
    a,
  );
});

void test('port-qualified local browser authorities resolve only when registered', async () => {
  const resolver = new TenantRequestResolver(new Authority(), []);
  assert.equal(
    await resolver.resolve('a.example.test:3002', undefined, signal),
    a,
  );
  await assert.rejects(
    resolver.resolve('a.example.test:3003', undefined, signal),
    TenantAccessDenied,
  );
});

void test('strict host parser rejects ambiguous authorities without network access', () => {
  for (const value of [
    null,
    '',
    'https://a.test',
    'a.test.',
    'a.test:0',
    'a.test:0443',
    'a.test:65536',
    'a.test:443:80',
    'a.test@evil.test',
    '-a.test',
    'a-.test',
    'a..test',
    'a_test',
    ' a.test',
    'a.test\r\n',
    'é.test',
    `${'x'.repeat(64)}.test`,
  ]) {
    assert.throws(() => normalizeAuthority(value), TenantAccessDenied);
  }
  assert.equal(normalizeAuthority('LOCALHOST:65535'), 'localhost:65535');
});

void test('revoked membership, wrong issuer, stale revisions, region and lifecycle fail closed', async () => {
  const authority = new Authority();
  const authorizer = new TenantContextAuthorizer(authority, 'east');
  const access = new TenantAccess(a, '42', 'issuer');
  const context = await authorizer.authorize(a, access, signal);
  authority.active = false;
  const before = authority.lookups;
  await assert.rejects(
    authorizer.reauthorize(context, signal),
    TenantAccessDenied,
  );
  assert.equal(authority.lookups, before);
  authority.active = true;
  await assert.rejects(
    authorizer.authorize(a, new TenantAccess(a, '42', 'other'), signal),
    TenantAccessDenied,
  );
  authority.version++;
  await assert.rejects(
    authorizer.reauthorize(context, signal),
    TenantAccessDenied,
  );
  authority.version--;
  authority.region = 'west';
  await assert.rejects(
    authorizer.reauthorize(context, signal),
    TenantAccessDenied,
  );
  authority.region = 'east';
  for (const lifecycle of [
    TenantLifecycle.Provisioning,
    TenantLifecycle.Moving,
    TenantLifecycle.Suspended,
  ]) {
    authority.lifecycle = lifecycle;
    await assert.rejects(
      authorizer.reauthorize(context, signal),
      TenantAccessDenied,
    );
  }
});

void test('cancellation wins before and after authority I/O', async () => {
  const controller = new AbortController();
  const authority = new Authority();
  const resolver = new TenantRequestResolver(authority, []);
  controller.abort();
  await assert.rejects(
    resolver.resolve('a.example.test', undefined, controller.signal),
    { name: 'AbortError' },
  );
  const during = new AbortController();
  authority.isActiveMember = () => {
    during.abort();
    return Promise.resolve(true);
  };
  await assert.rejects(
    new TenantContextAuthorizer(authority, 'east').authorize(
      a,
      new TenantAccess(a, '42', 'issuer'),
      during.signal,
    ),
    { name: 'AbortError' },
  );
  assert.equal(authority.lookups, 0);
});
