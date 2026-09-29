import { PrismaClient as CatalogClient } from '../generated/catalog/index.js';
import { PrismaClient as TenantClient } from '../generated/tenant/index.js';
import { hashIdentityPassword } from '../dist/src/domain/identity-password.js';

const required = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
};

const tenantId = required('NESTJS_TEST_TENANT_ID');
const email = required('NESTJS_TEST_EMAIL');
const password = required('NESTJS_TEST_PASSWORD');
const issuer = process.env.JWT_ISSUER ?? 'accept-issuer';
const catalog = new CatalogClient({
  datasources: { db: { url: required('CATALOG_DATABASE_URL') } },
});
const tenant = new TenantClient({
  datasources: { db: { url: required('TENANT_DATABASE_URL') } },
});

try {
  const passwordHash = await hashIdentityPassword(password);
  const current = await tenant.user.findFirst({
    where: { tenantId, normalizedEmail: email.toUpperCase() },
    select: { id: true },
  });
  const user = current
    ? await tenant.user.update({
        where: { tenantId_id: { tenantId, id: current.id } },
        data: { passwordHash, lockoutEnd: null, lockoutEnabled: true },
      })
    : await tenant.user.create({
        data: {
          tenantId,
          userName: email,
          normalizedUserName: email.toUpperCase(),
          email,
          normalizedEmail: email.toUpperCase(),
          emailConfirmed: true,
          passwordHash,
          phoneNumberConfirmed: false,
          twoFactorEnabled: false,
          lockoutEnabled: true,
          accessFailedCount: 0,
          firstName: 'Acceptance',
          lastName: 'User',
          createdAt: new Date(),
        },
      });
  let role = await tenant.role.findFirst({
    where: { tenantId, normalizedName: 'ADMIN' },
    select: { id: true },
  });
  if (!role)
    role = await tenant.role.create({
      data: {
        tenantId,
        name: 'Admin',
        normalizedName: 'ADMIN',
        createdAt: new Date(),
      },
      select: { id: true },
    });
  await tenant.userRole.upsert({
    where: {
      tenantId_userId_roleId: { tenantId, userId: user.id, roleId: role.id },
    },
    update: {},
    create: { tenantId, userId: user.id, roleId: role.id },
  });
  await catalog.$executeRaw`DELETE FROM [catalog].[TenantMemberships] WHERE [TenantId]=${tenantId} AND [Issuer]=${issuer} AND [SubjectId]=${String(user.id)}`;
  await catalog.$executeRaw`INSERT INTO [catalog].[TenantMemberships] ([TenantId], [Issuer], [SubjectId], [IsActive]) VALUES (${tenantId}, ${issuer}, ${String(user.id)}, 1)`;
  console.log(`Seeded ${email} for tenant ${tenantId}.`);
} finally {
  await Promise.all([catalog.$disconnect(), tenant.$disconnect()]);
}
