import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mayUseTenantAccount } from '../src/domain/account-access.js';

void test('locked or roleless tenant identities cannot use issued or refreshed tokens', () => {
  const now = new Date('2026-09-28T00:00:00.000Z');
  assert.equal(mayUseTenantAccount(null, ['Team Member'], now), true);
  assert.equal(mayUseTenantAccount(new Date(now), ['Admin'], now), true);
  assert.equal(
    mayUseTenantAccount(new Date('9999-12-31T00:00:00.000Z'), ['Admin'], now),
    false,
  );
  assert.equal(mayUseTenantAccount(null, [], now), false);
  assert.equal(mayUseTenantAccount(null, ['Unknown'], now), false);
});
