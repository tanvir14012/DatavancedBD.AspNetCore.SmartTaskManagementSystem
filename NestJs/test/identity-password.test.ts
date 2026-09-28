import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  hashIdentityPassword,
  verifyIdentityPassword,
} from '../src/domain/identity-password.js';

void test('ASP.NET Identity V3 password format verifies and rejects wrong credentials', async () => {
  const encoded = await hashIdentityPassword('StrongPass1!');
  const bytes = Buffer.from(encoded, 'base64');
  assert.equal(bytes[0], 1);
  assert.equal(bytes.readUInt32BE(1), 2);
  assert.equal(bytes.readUInt32BE(5), 100_000);
  assert.equal(await verifyIdentityPassword('StrongPass1!', encoded), true);
  assert.equal(await verifyIdentityPassword('wrong', encoded), false);
  assert.equal(await verifyIdentityPassword('StrongPass1!', 'bad'), false);
});
