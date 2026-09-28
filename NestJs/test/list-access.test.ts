import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AuthorizedRequest } from '../src/http/tenant.guard.js';
import { TasksController } from '../src/http/tasks.controller.js';
import type { TenantStorage } from '../src/infrastructure/prisma/prisma.service.js';
import {
  TenantAccess,
  TenantContext,
  TenantIsolation,
  TenantLifecycle,
  TenantPlacement,
} from '../src/domain/tenancy.js';

const ids = [
  'a93c4ba4-1bcb-46c9-ad6e-3dde4c7860be',
  'dfc17bd9-eab0-480b-bec4-ed86116f9431',
];

void test('task lists bind member and manager decisions to each tenant with colliding user IDs', async () => {
  const predicates: unknown[] = [];
  const db = {
    projectTask: {
      count: (args: { where: unknown }) => {
        predicates.push(args.where);
        return Promise.resolve(0);
      },
      findMany: () => Promise.resolve([]),
    },
  };
  const storage = {
    execute: (
      _context: unknown,
      action: (database: unknown) => Promise<unknown>,
    ) => action(db),
  } as unknown as TenantStorage;
  const controller = new TasksController(storage);
  for (const id of ids) {
    const context = new TenantContext(
      new TenantPlacement(
        id,
        TenantIsolation.Database,
        'target',
        null,
        'east',
        1n,
        TenantLifecycle.Active,
      ),
      new TenantAccess(id, '7', 'issuer'),
    );
    const member = {
      tenantContext: context,
      userId: 7,
      roles: new Set(['Team Member']),
    } as unknown as AuthorizedRequest;
    await controller.list(member, { assigneeId: '8' });
    const manager = {
      tenantContext: context,
      userId: 7,
      roles: new Set(['Project Manager']),
    } as unknown as AuthorizedRequest;
    await controller.list(manager, {});
  }
  for (let index = 0; index < ids.length; index += 1) {
    const member = predicates[index * 2] as Record<string, unknown>;
    const manager = predicates[index * 2 + 1] as Record<string, unknown>;
    assert.equal(member.tenantId, ids[index]);
    assert.deepEqual(member.AND, [
      { assignees: { some: { tenantId: ids[index], userId: 7 } } },
      { assignees: { some: { tenantId: ids[index], userId: 8 } } },
    ]);
    assert.equal(manager.tenantId, ids[index]);
    assert.deepEqual(manager.project, {
      isDeleted: false,
      members: {
        some: { tenantId: ids[index], userId: 7, projectRole: { in: [0, 1] } },
      },
    });
  }
});
