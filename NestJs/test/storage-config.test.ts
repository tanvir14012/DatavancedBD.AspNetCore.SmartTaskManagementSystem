import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TenantIsolation } from '../src/domain/tenancy.js';
import { parseStorageTargets } from '../src/infrastructure/prisma/storage-config.js';

void test('storage targets are validated from trusted deployment configuration', () => {
  const targets = parseStorageTargets(
    JSON.stringify([
      {
        targetId: 'shared-east',
        region: 'east',
        isolation: TenantIsolation.Row,
        schema: 'dbo',
        connectionString: 'sqlserver://server;database=tenant',
        commandTimeoutSeconds: 30,
      },
    ]),
  );
  assert.equal(targets.get('shared-east')?.isolation, TenantIsolation.Row);
  assert.throws(
    () =>
      parseStorageTargets(
        JSON.stringify([
          {
            targetId: 'db',
            region: 'east',
            isolation: 3,
            schema: 'dbo',
            connectionString: 'x',
            commandTimeoutSeconds: 30,
          },
        ]),
      ),
    /isolation/,
  );
  assert.throws(
    () =>
      parseStorageTargets(
        JSON.stringify([
          {
            targetId: 'db',
            region: 'east',
            isolation: 0,
            schema: 'bad-name',
            connectionString: 'x',
            commandTimeoutSeconds: 30,
          },
        ]),
      ),
    /schema/,
  );
  assert.throws(
    () =>
      parseStorageTargets(
        JSON.stringify([
          {
            targetId: 'db',
            region: 'east',
            isolation: 0,
            schema: 'dbo',
            connectionString: 'x\nsecret',
            commandTimeoutSeconds: 30,
          },
        ]),
      ),
    /connection/,
  );
});
