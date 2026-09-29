import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { test } from 'node:test';
import { PrismaClient as CatalogClient } from '../generated/catalog/index.js';
import { PrismaClient as TenantClient } from '../generated/tenant/index.js';
import {
  TenantAccess,
  TenantContext,
  TenantIsolation,
  TenantLifecycle,
  TenantPlacement,
} from '../src/domain/tenancy.js';
import {
  CatalogReader,
  TenantStorage,
} from '../src/infrastructure/prisma/prisma.service.js';
import { hashIdentityPassword } from '../src/domain/identity-password.js';
import { createApplication } from '../src/bootstrap.js';

function required(name: string): string {
  const value = process.env[name];
  if (!value)
    throw new Error(`${name} is required for isolated SQL acceptance.`);
  if (
    !value.startsWith('sqlserver://127.0.0.1:') ||
    !/;database=Stms(?:NestCatalog|LocalNest(?:DbA|Schema|Row));/.test(value)
  )
    throw new Error(
      `${name} must target a dedicated loopback acceptance database.`,
    );
  return value;
}

void test('Prisma maps the .NET catalog and tenant tables in every storage strategy', async () => {
  const catalog = new CatalogClient({
    datasources: { db: { url: required('SAAS_TEST_CATALOG_URL') } },
  });
  const targets = [
    required('SAAS_TEST_DATABASE_URL'),
    required('SAAS_TEST_SCHEMA_A_URL'),
    required('SAAS_TEST_SCHEMA_B_URL'),
    required('SAAS_TEST_ROW_URL'),
  ].map((url) => new TenantClient({ datasources: { db: { url } } }));
  try {
    assert.equal(await catalog.tenantPlacement.count(), 0);
    assert.equal(await catalog.tenantAuthority.count(), 0);
    assert.equal(await catalog.tenantMembership.count(), 0);
    for (const client of targets) {
      const counts = await Promise.all([
        client.user.count(),
        client.role.count(),
        client.userRole.count(),
        client.userClaim.count(),
        client.roleClaim.count(),
        client.userLogin.count(),
        client.userToken.count(),
        client.project.count(),
        client.projectTask.count(),
        client.userProject.count(),
        client.userTask.count(),
        client.refreshToken.count(),
        client.menuItem.count(),
      ]);
      assert.equal(counts.length, 13);
      assert.ok(counts.every((count) => Number.isSafeInteger(count)));
    }
  } finally {
    await Promise.all([
      catalog.$disconnect(),
      ...targets.map((client) => client.$disconnect()),
    ]);
  }
});

void test('database and schema targets keep colliding project IDs separate', async () => {
  const fixtures = [
    {
      url: required('SAAS_TEST_DATABASE_URL'),
      tenantId: 'a93c4ba4-1bcb-46c9-ad6e-3dde4c7860be',
      name: 'nest-db-project',
    },
    {
      url: required('SAAS_TEST_SCHEMA_A_URL'),
      tenantId: 'dfc17bd9-eab0-480b-bec4-ed86116f9431',
      name: 'nest-alpha-project',
    },
    {
      url: required('SAAS_TEST_SCHEMA_B_URL'),
      tenantId: 'c6f5da34-dfe5-4c8a-a52e-b634508be04b',
      name: 'nest-beta-project',
    },
  ];
  const clients = fixtures.map(
    (fixture) =>
      new TenantClient({ datasources: { db: { url: fixture.url } } }),
  );
  const created: Array<{ client: TenantClient; tenantId: string; id: number }> =
    [];
  try {
    for (let index = 0; index < fixtures.length; index += 1) {
      const fixture = fixtures[index];
      const client = clients[index];
      if (!fixture || !client)
        throw new Error('Acceptance fixture unavailable.');
      const project = await client.project.create({
        data: {
          tenantId: fixture.tenantId,
          name: fixture.name,
          isArchived: false,
          isDeleted: false,
          createdAt: new Date(),
        },
      });
      created.push({ client, tenantId: fixture.tenantId, id: project.id });
    }
    assert.equal(new Set(created.map((project) => project.id)).size, 1);
    for (let index = 0; index < created.length; index += 1) {
      const own = created[index];
      if (!own) throw new Error('Acceptance project unavailable.');
      assert.equal(
        await own.client.project.count({
          where: { tenantId: own.tenantId, id: own.id },
        }),
        1,
      );
      for (const other of created) {
        if (other.tenantId === own.tenantId) continue;
        assert.equal(
          await own.client.project.count({
            where: { tenantId: other.tenantId, id: other.id },
          }),
          0,
        );
      }
    }
  } finally {
    for (const project of created)
      await project.client.project.delete({
        where: { tenantId_id: { tenantId: project.tenantId, id: project.id } },
      });
    await Promise.all(clients.map((client) => client.$disconnect()));
  }
});

void test('row storage reauthorizes and SQL RLS blocks cross-tenant access on reused connections', async () => {
  const idA = '71a1a446-808d-446a-a69e-305e8f608bf7';
  const idB = '0f5a9c4d-ddd9-4ef4-94a8-19a7ed181d61';
  const oldCatalog = process.env.CATALOG_DATABASE_URL;
  const oldTargets = process.env.TENANT_STORAGE_TARGETS;
  const oldRegion = process.env.TENANT_REGION;
  const catalogUrl = required('SAAS_TEST_CATALOG_URL');
  const rowUrl = required('SAAS_TEST_ROW_URL');
  process.env.CATALOG_DATABASE_URL = catalogUrl;
  process.env.TENANT_REGION = 'local';
  process.env.TENANT_STORAGE_TARGETS = JSON.stringify([
    {
      targetId: 'acceptrow',
      region: 'local',
      isolation: 2,
      schema: 'dbo',
      connectionString: rowUrl.replace(/;schema=dbo$/i, ''),
      commandTimeoutSeconds: 30,
    },
  ]);
  const catalog = new CatalogClient({
    datasources: { db: { url: catalogUrl } },
  });
  const reader = new CatalogReader();
  const storage = new TenantStorage(reader);
  const placements = [idA, idB].map(
    (id) =>
      new TenantPlacement(
        id,
        TenantIsolation.Row,
        'acceptrow',
        null,
        'local',
        1n,
        TenantLifecycle.Active,
      ),
  );
  const contexts = placements.map(
    (placement) =>
      new TenantContext(
        placement,
        new TenantAccess(placement.tenantId, '7', 'accept-issuer'),
      ),
  );
  const created: Array<{ context: TenantContext; id: number }> = [];
  try {
    for (const placement of placements) {
      await catalog.tenantPlacement.create({
        data: {
          tenantId: placement.tenantId,
          isolation: 2,
          targetId: 'acceptrow',
          region: 'local',
          version: 1n,
          lifecycle: 1,
        },
      });
      await catalog.$executeRaw`INSERT INTO [catalog].[TenantMemberships] ([TenantId], [Issuer], [SubjectId], [IsActive]) VALUES (${placement.tenantId}, ${'accept-issuer'}, ${'7'}, 1)`;
    }
    const contextA = contexts[0];
    const contextB = contexts[1];
    if (!contextA || !contextB)
      throw new Error('Acceptance contexts unavailable.');
    const projectA = await storage.execute(contextA, (db) =>
      db.project.create({
        data: {
          tenantId: idA,
          name: 'nest-rls-a',
          isArchived: false,
          isDeleted: false,
          createdAt: new Date(),
        },
      }),
    );
    created.push({ context: contextA, id: projectA.id });
    const projectB = await storage.execute(contextB, (db) =>
      db.project.create({
        data: {
          tenantId: idB,
          name: 'nest-rls-b',
          isArchived: false,
          isDeleted: false,
          createdAt: new Date(),
        },
      }),
    );
    created.push({ context: contextB, id: projectB.id });
    assert.equal(
      await storage.execute(contextA, (db) =>
        db.project.count({ where: { tenantId: idA, id: projectA.id } }),
      ),
      1,
    );
    assert.equal(
      await storage.execute(contextB, (db) =>
        db.project.count({ where: { tenantId: idB, id: projectB.id } }),
      ),
      1,
    );
    assert.equal(
      await storage.execute(contextA, (db) =>
        db.project.count({ where: { tenantId: idB, id: projectB.id } }),
      ),
      0,
    );
    assert.equal(
      await storage.execute(contextB, (db) =>
        db.project.count({ where: { tenantId: idA, id: projectA.id } }),
      ),
      0,
    );
    await assert.rejects(
      storage.execute(contextA, (db) =>
        db.project.create({
          data: {
            tenantId: idB,
            name: 'nest-cross-write',
            isArchived: false,
            isDeleted: false,
            createdAt: new Date(),
          },
        }),
      ),
    );
  } finally {
    for (const project of created) {
      await storage.execute(project.context, (db) =>
        db.project.delete({
          where: {
            tenantId_id: {
              tenantId: project.context.placement.tenantId,
              id: project.id,
            },
          },
        }),
      );
    }
    await storage.onModuleDestroy();
    await reader.onModuleDestroy();
    for (const placement of placements) {
      await catalog.$executeRaw`DELETE FROM [catalog].[TenantMemberships] WHERE [TenantId]=${placement.tenantId} AND [Issuer]=${'accept-issuer'} AND [SubjectId]=${'7'}`;
      await catalog.tenantPlacement.deleteMany({
        where: { tenantId: placement.tenantId },
      });
    }
    await catalog.$disconnect();
    if (oldCatalog === undefined) delete process.env.CATALOG_DATABASE_URL;
    else process.env.CATALOG_DATABASE_URL = oldCatalog;
    if (oldTargets === undefined) delete process.env.TENANT_STORAGE_TARGETS;
    else process.env.TENANT_STORAGE_TARGETS = oldTargets;
    if (oldRegion === undefined) delete process.env.TENANT_REGION;
    else process.env.TENANT_REGION = oldRegion;
  }
});

void test('Fastify authenticates and rejects cross-tenant selectors and tokens with colliding user IDs', async () => {
  const fixtures = [
    {
      tenantId: 'a93c4ba4-1bcb-46c9-ad6e-3dde4c7860be',
      url: required('SAAS_TEST_DATABASE_URL'),
      targetId: 'acceptdb',
      isolation: TenantIsolation.Database,
      schema: null,
      storageSchema: 'dbo',
      authority: 'a.accept.test',
    },
    {
      tenantId: 'dfc17bd9-eab0-480b-bec4-ed86116f9431',
      url: required('SAAS_TEST_SCHEMA_A_URL'),
      targetId: 'acceptschema',
      isolation: TenantIsolation.Schema,
      schema: 'alpha',
      storageSchema: 'alpha',
      authority: 'b.accept.test',
    },
  ];
  const catalogUrl = required('SAAS_TEST_CATALOG_URL');
  const catalog = new CatalogClient({
    datasources: { db: { url: catalogUrl } },
  });
  const clients = fixtures.map(
    ({ url }) => new TenantClient({ datasources: { db: { url } } }),
  );
  const environment = [
    'CATALOG_DATABASE_URL',
    'TENANT_STORAGE_TARGETS',
    'TENANT_REGION',
    'JWT_ISSUER',
    'JWT_AUDIENCE',
    'JWT_KEY',
    'ALLOWED_ORIGINS',
  ] as const;
  const previous = new Map(
    environment.map((name) => [name, process.env[name]]),
  );
  const issuer = 'accept-issuer';
  const origin = 'https://app.accept.test';
  const password = process.env.NESTJS_TEST_PASSWORD ?? 'testP@sswprd';
  const emailPrefix = process.env.NESTJS_TEST_EMAIL_PREFIX ?? 'accept';
  const hash = await hashIdentityPassword(password);
  process.env.CATALOG_DATABASE_URL = catalogUrl;
  process.env.TENANT_REGION = 'local';
  process.env.JWT_ISSUER = issuer;
  process.env.JWT_AUDIENCE = 'accept-audience';
  process.env.JWT_KEY = randomBytes(48).toString('base64url');
  process.env.ALLOWED_ORIGINS = origin;
  process.env.TENANT_STORAGE_TARGETS = JSON.stringify(
    fixtures.map((fixture) => ({
      targetId: fixture.targetId,
      region: 'local',
      isolation: fixture.isolation,
      schema: fixture.storageSchema,
      connectionString: fixture.url.replace(/;schema=[^;]+$/i, ''),
      commandTimeoutSeconds: 30,
    })),
  );
  const users: number[] = [];
  const projects: number[] = [];
  const roles: number[] = [];
  let app: Awaited<ReturnType<typeof createApplication>> | undefined;
  try {
    for (let index = 0; index < fixtures.length; index += 1) {
      const fixture = fixtures[index];
      const db = clients[index];
      if (!fixture || !db) throw new Error('Acceptance fixture unavailable.');
      await catalog.tenantPlacement.create({
        data: {
          tenantId: fixture.tenantId,
          isolation: fixture.isolation,
          targetId: fixture.targetId,
          schemaName: fixture.schema,
          region: 'local',
          version: 1n,
          lifecycle: TenantLifecycle.Active,
        },
      });
      await catalog.$executeRaw`INSERT INTO [catalog].[TenantAuthorities] ([Authority], [TenantId], [IsActive]) VALUES (${fixture.authority}, ${fixture.tenantId}, 1)`;
      const user = await db.user.create({
        data: {
          tenantId: fixture.tenantId,
          userName: `accept${index}`,
          normalizedUserName: `ACCEPT${index}`,
          email: `${emailPrefix}${index}@example.test`,
          normalizedEmail: `${emailPrefix}${index}@EXAMPLE.TEST`.toUpperCase(),
          emailConfirmed: true,
          passwordHash: hash,
          phoneNumberConfirmed: false,
          twoFactorEnabled: false,
          lockoutEnabled: true,
          accessFailedCount: 0,
          firstName: 'Acceptance',
          lastName: 'User',
          createdAt: new Date(),
        },
      });
      users[index] = user.id;
      const role = await db.role.create({
        data: {
          tenantId: fixture.tenantId,
          name: 'Admin',
          normalizedName: 'ADMIN',
          createdAt: new Date(),
        },
      });
      roles[index] = role.id;
      await db.userRole.create({
        data: { tenantId: fixture.tenantId, userId: user.id, roleId: role.id },
      });
      const project = await db.project.create({
        data: {
          tenantId: fixture.tenantId,
          name: `accept-http-${index}`,
          isArchived: false,
          isDeleted: false,
          createdAt: new Date(),
        },
      });
      projects[index] = project.id;
      await catalog.$executeRaw`INSERT INTO [catalog].[TenantMemberships] ([TenantId], [Issuer], [SubjectId], [IsActive]) VALUES (${fixture.tenantId}, ${issuer}, ${String(user.id)}, 1)`;
    }
    assert.equal(users[0], users[1]);
    const runningApp = await createApplication();
    app = runningApp;
    await runningApp.init();
    const tokens: string[] = [];
    const cookies: string[] = [];
    for (let index = 0; index < fixtures.length; index += 1) {
      const fixture = fixtures[index];
      if (!fixture) throw new Error('Acceptance fixture unavailable.');
      const login = await runningApp.inject({
        method: 'POST',
        url: '/api/auth/login',
        headers: { host: fixture.authority, origin },
        payload: { email: `${emailPrefix}${index}@example.test`, password },
      });
      assert.equal(login.statusCode, 201, login.body);
      const body = login.json<{ accessToken: string }>();
      tokens[index] = body.accessToken;
      const setCookie = login.headers['set-cookie'];
      const cookie = Array.isArray(setCookie) ? setCookie[0] : setCookie;
      if (!cookie) throw new Error('Acceptance refresh cookie unavailable.');
      cookies[index] = cookie.split(';')[0] ?? '';
      const own = await runningApp.inject({
        method: 'GET',
        url: '/api/projects',
        headers: {
          host: fixture.authority,
          authorization: `Bearer ${body.accessToken}`,
        },
      });
      assert.equal(own.statusCode, 200, own.body);
      assert.equal(own.json<{ totalCount: number }>().totalCount, 1);
    }
    const a = fixtures[0];
    const b = fixtures[1];
    if (!a || !b || !tokens[0] || !tokens[1])
      throw new Error('Acceptance credentials unavailable.');
    const request = (host: string, token: string, selector?: string) =>
      runningApp.inject({
        method: 'GET',
        url: '/api/projects',
        headers: {
          host,
          authorization: `Bearer ${token}`,
          ...(selector && { 'x-tenant-id': selector }),
        },
      });
    assert.equal((await request(b.authority, tokens[0])).statusCode, 403);
    assert.equal((await request(a.authority, tokens[1])).statusCode, 403);
    assert.equal(
      (await request(a.authority, tokens[0], b.tenantId)).statusCode,
      403,
    );
    assert.equal(
      (await request('unknown.accept.test', tokens[0])).statusCode,
      403,
    );
    assert.equal((await request(a.authority, 'invalid')).statusCode, 401);
    const refreshed = await runningApp.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      headers: { host: a.authority, origin, cookie: cookies[0] },
    });
    assert.equal(refreshed.statusCode, 201, refreshed.body);
    assert.ok(refreshed.json<{ accessToken: string }>().accessToken);
    const replay = await runningApp.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      headers: { host: a.authority, origin, cookie: cookies[0] },
    });
    assert.equal(replay.statusCode, 401);
    const rotatedCookieHeader = refreshed.headers['set-cookie'];
    const rotatedCookie = Array.isArray(rotatedCookieHeader)
      ? rotatedCookieHeader[0]
      : rotatedCookieHeader;
    if (!rotatedCookie) throw new Error('Rotated cookie unavailable.');
    const logout = await runningApp.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: {
        host: a.authority,
        origin,
        cookie: rotatedCookie.split(';')[0],
      },
    });
    assert.equal(logout.statusCode, 201, logout.body);
    const afterLogout = await runningApp.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      headers: {
        host: a.authority,
        origin,
        cookie: rotatedCookie.split(';')[0],
      },
    });
    assert.equal(afterLogout.statusCode, 401);
    await catalog.$executeRaw`UPDATE [catalog].[TenantMemberships] SET [IsActive]=0 WHERE [TenantId]=${a.tenantId} AND [Issuer]=${issuer} AND [SubjectId]=${String(users[0])}`;
    assert.equal((await request(a.authority, tokens[0])).statusCode, 403);
    assert.equal((await request(b.authority, tokens[1])).statusCode, 200);
    const forbiddenOrigin = await runningApp.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { host: a.authority, origin: 'https://other.accept.test' },
      payload: { email: `${emailPrefix}0@example.test`, password },
    });
    assert.equal(forbiddenOrigin.statusCode, 403);
  } finally {
    await app?.close();
    for (let index = 0; index < fixtures.length; index += 1) {
      const fixture = fixtures[index];
      const db = clients[index];
      if (!fixture || !db) continue;
      await db.refreshToken.deleteMany({
        where: { tenantId: fixture.tenantId },
      });
      await db.project.deleteMany({
        where: { tenantId: fixture.tenantId, id: projects[index] },
      });
      await db.userRole.deleteMany({
        where: { tenantId: fixture.tenantId, userId: users[index] },
      });
      await db.role.deleteMany({
        where: { tenantId: fixture.tenantId, id: roles[index] },
      });
      await db.user.deleteMany({
        where: { tenantId: fixture.tenantId, id: users[index] },
      });
      await catalog.$executeRaw`DELETE FROM [catalog].[TenantMemberships] WHERE [TenantId]=${fixture.tenantId} AND [Issuer]=${issuer}`;
      await catalog.$executeRaw`DELETE FROM [catalog].[TenantAuthorities] WHERE [TenantId]=${fixture.tenantId}`;
      await catalog.tenantPlacement.deleteMany({
        where: { tenantId: fixture.tenantId },
      });
    }
    await Promise.all([
      catalog.$disconnect(),
      ...clients.map((db) => db.$disconnect()),
    ]);
    for (const name of environment) {
      const value = previous.get(name);
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});
