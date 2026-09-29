# NestJS backend migration

For the complete architecture reference, start with [READ.md](READ.md).

Parallel implementation of the .NET backend using NestJS, the Fastify HTTP adapter,
Prisma and SQL Server. The existing .NET hosts remain the active implementation until
contract and SQL Server isolation acceptance gates pass. This directory is an incremental
migration, not yet a drop-in replacement.

Use Node 24 LTS or later:

```powershell
cd NestJs
npm ci
npm run lint
npm test
npm run format:check
npm start
```

For a disposable local SQL Server, seeded account, NestJS API, and React client in one
PowerShell run, use `./localDeployment.ps1`. It keeps a named SQL volume and does not delete
existing containers or data:

```powershell
cd NestJs
./localDeployment.ps1
```

The script prints the local login and writes its private state under `.local/`. The seeded
account uses `accept0@example.test`; its password is retained in ignored local state. To
choose a known password for a local test run, pass it explicitly, for example
`./localDeployment.ps1 -TestPassword '<choose-a-local-password>'`. The script runs the existing Admin
`local-init` path for the database, schema, and row targets before starting the API and React
development server. The React dev server proxies `/services` to the API and forwards the
registered local tenant authority, so browser login does not depend on cross-origin HTTP.

The proposed `Dockerfile` uses non-root UID 10001, but its Prisma generation and runtime
dependency packaging still need verification; see the production gaps in [READ.md](READ.md).
Migrations and tenant provisioning remain owned by Admin.

Liveness: `/alive`. Readiness and `/health` return 503 until `NESTJS_CUTOVER_ENABLED=true`,
required authentication and storage settings are present, and the catalog responds to a
database probe. Tenant target health and SQL isolation still require separate acceptance
checks before cutover. No default database, development credentials,
automatic migrations or permissive CORS are configured.

Set `ALLOWED_ORIGINS` to a comma-separated list of exact trusted browser origins.
Fastify rejects other browser origins and accepts credentialed preflight requests only
for listed origins. `trustProxy` remains disabled, so deployments must preserve a
trusted Host header and must not depend on unvalidated forwarded headers.

See [parity tracking](docs/parity.md) and [architecture decision](../docs/adr/0001-nestjs-parallel-backend.md).

The SQL acceptance command is intentionally separate from the unit suite. It requires the
test-only `SAAS_TEST_*` SQL Server URLs and runs only against disposable databases; it does
not provision or migrate deployed databases:

```powershell
npm run test:sql
```

The current acceptance evidence covers all three storage strategies, colliding tenant and
user IDs, row-level security, login, refresh-token rotation, logout, membership revocation,
and cross-tenant request denial. The existing catalog baseline has a hyphen/collation
constraint mismatch documented in the parity ledger and remains an Admin migration task.

The description assistant defaults to the local clarity pass. An optional Groq call
requires `AI_ENABLED=true`, `GROQ_API_KEY` from a secret provider, and `GROQ_MODEL`;
`GROQ_ENDPOINT` may point only to `https://api.groq.com`. Provider failures fall back
to local processing after a five-second deadline. Never place the API key in source or
the browser bundle.

Prisma is pinned to 6.19.3. Its `deepmerge-ts` tooling dependency is overridden to
8.0.0 for GHSA-ggr8-5vv4-36mx; schema validation and client generation must pass before
changing that override. Prisma 7.10 additionally pulled an affected MySQL driver
into this SQL Server-only project's tooling. Reevaluate on the next stable upgrade.

## Request processing and persistence reference

The excerpts below are taken from this repository. Fragment boundaries omit surrounding
code; follow the source links for complete methods and registrations. The extended
[architecture reference](READ.md) covers runtime internals, configuration, JWT, tenant
isolation, worker behavior, operational limits and change workflows.

### IoC container and dependency injection

Nest constructs the application from AppModule metadata. Class tokens in providers identify
container-managed dependencies; constructor metadata tells Nest which instances to inject.
Controllers are registered separately because they also contribute route metadata.

Source: [src/app.module.ts](src/app.module.ts).

```typescript
@Module({
  controllers: [
    HealthController,
    ProjectsController,
    ProjectMembersController,
    TasksController,
    AuthController,
    DashboardController,
    MenusController,
    UsersController,
    AiController,
  ],
  providers: [CatalogReader, TenantStorage, TenantGuard, DescriptionAiService],
})
export class AppModule {}
```

The guard receives the registered catalog and storage providers through its constructor:

Source: [src/http/tenant.guard.ts](src/http/tenant.guard.ts).

```typescript
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly catalog: CatalogReader,
    private readonly storage: TenantStorage,
  ) {}
```

These providers use default singleton scope. TenantStorage owns cached Prisma clients;
request-specific identity belongs to AuthorizedRequest and TenantContext, never singleton
fields. A TypeScript interface alone cannot act as an IoC token because it is erased at
runtime. New application ports need an explicit runtime token and a provider binding.
Provider changes belong in AppModule or a deliberately introduced feature module.

### Middleware and Fastify hooks

This host uses Fastify hooks for HTTP-wide origin handling and the cookie plugin for
cookie parsing. It does not register a NestMiddleware class or MiddlewareConsumer.
The following onRequest fragment rejects an untrusted browser origin before route logic:

Source: [src/bootstrap.ts](src/bootstrap.ts).

```typescript
  server.addHook('onRequest', async (request, reply) => {
    const origin = request.headers.origin;
    if (!origin) return;
    if (!allowedOrigins.has(origin)) {
      await reply.code(403).send({ message: 'Origin is not allowed.' });
      return;
    }
```

The rest of the hook sets credentialed CORS headers and handles OPTIONS preflight.
Requests without Origin pass this hook; authentication and tenant authorization still
apply on protected routes. Bootstrap also configures a 64 KiB body limit, disabled
trustProxy and a 30-second request-receipt timeout. That timeout is not a database deadline.
Change src/bootstrap.ts for HTTP-wide behavior, keeping Fastify adapter compatibility.

### Guards and controller handlers

TenantGuard implements CanActivate and obtains the Fastify request from ExecutionContext.
Its JWT verification constrains issuer, audience and algorithm:

Source: [src/http/tenant.guard.ts](src/http/tenant.guard.ts).

```typescript
      const { payload } = await jwtVerify(
        authorization.slice(7),
        new TextEncoder().encode(key),
        { issuer, audience, algorithms: ['HS256'] },
      );
```

Verification is followed by subject parsing, tenant resolution, live catalog authorization,
and account/role checks. A valid signature alone does not authorize a tenant or resource.
The controller-level decorator applies that admission gate to project routes:

Source: [src/http/projects.controller.ts](src/http/projects.controller.ts).

```typescript
@Controller('api/projects')
@UseGuards(TenantGuard)
export class ProjectsController {
  constructor(private readonly storage: TenantStorage) {}
```

The POST handler binds body data as unknown, checks role permissions, validates approved
fields, and creates the project and its owner membership in one storage transaction:

Source: [src/http/projects.controller.ts](src/http/projects.controller.ts).

```typescript
  @Post()
  async create(@Req() request: AuthorizedRequest, @Body() body: unknown) {
    const { context, userId, roles } = requireContext(request);
    if (!roles.has('Admin') && !roles.has('Project Manager'))
      throw new ForbiddenException();
    const input = projectInput(body);
    const tenantId = context.placement.tenantId;
    return this.storage.execute(context, async (db) => {
      const project = await db.project.create({
        data: {
          tenantId,
          name: input.name,
          description: input.description,
          startDate: input.startDate,
          endDate: input.endDate,
          isArchived: false,
          isDeleted: false,
          createdAt: new Date(),
          createdById: userId,
        },
      });
      await db.userProject.create({
        data: {
          tenantId,
          projectId: project.id,
          userId,
          projectRole: 0,
          joinedAt: new Date(),
        },
      });
      return {
        id: project.id,
        name: project.name,
        description: project.description,
        startDate: dateOutput(project.startDate),
        endDate: dateOutput(project.endDate),
      };
    });
  }
```

The returned object is an explicit API response. Decorators supply route and parameter
metadata; they do not make arbitrary request bodies safe or replace resource authorization.
For a new handler, retain the guard, derive tenant identity from requireContext, validate
input, execute within TenantStorage and project the response deliberately.

### Pipes and validation

No global ValidationPipe or custom route pipe is registered. Current validation is explicit
inside controller helpers, including the identifier parser below:

Source: [src/http/projects.controller.ts](src/http/projects.controller.ts).

```typescript
export function positiveId(raw: string): number {
  const id = Number(raw);
  if (!/^[1-9]\d*$/.test(raw) || !Number.isSafeInteger(id))
    throw new BadRequestException('Invalid identifier.');
  return id;
}
```

projectInput validates names, description lengths, dates and date order before building a
narrow input object. page bounds pagination. TypeScript types do not validate incoming JSON.
If a pipe is introduced, its transform method should return validated data or throw an
appropriate HTTP exception; register it at the intended parameter, route or global scope.
A global pipe changes all affected contracts and requires corresponding compatibility tests.

### Interceptors, exception filters and global action filters

No custom interceptor, APP_INTERCEPTOR, APP_FILTER, APP_PIPE, useGlobalInterceptors,
useGlobalFilters or useGlobalPipes registration exists in this host. There is consequently
no repository implementation snippet for those components. Nest's built-in exception
handling remains active, and controllers throw Nest HTTP exceptions.

The ASP.NET term action filter has no single Nest equivalent:

| Concern | Nest extension point | Current repository behavior |
| --- | --- | --- |
| Admission before a handler | Guard | TenantGuard on protected controllers |
| Argument conversion/validation | Pipe | Explicit controller validation helpers |
| Work around handler execution or response transformation | Interceptor | No custom interceptor registered |
| Mapping thrown exceptions | Exception filter | Built-in Nest exception handling |
| Early request preprocessing | Middleware or adapter hook | Fastify origin hook and cookie plugin |

Interceptors wrap handler execution and can transform the returned observable or observe
errors. Exception filters handle uncaught exceptions; they are not authorization guards.
Neither replaces tenant predicates or transactional checks. If dependency injection is
needed for a global interceptor/filter, register a provider through the corresponding Nest
APP_* token in the composition root. This is an extension point, not existing configuration.
Keep error responses redacted and preserve public status/response contracts when adding one.

### Prisma table, column and relation configuration

The catalog generator and datasource produce a separate SQL Server client:

Source: [prisma/catalog.prisma](prisma/catalog.prisma).

```prisma
generator client {
  provider = "prisma-client-js"
  output   = "../generated/catalog"
}

datasource db {
  provider = "sqlserver"
  url      = env("CATALOG_DATABASE_URL")
}
```

Catalog placement fields map to existing SQL column and table names:

Source: [prisma/catalog.prisma](prisma/catalog.prisma).

```prisma
model TenantPlacement {
  tenantId   String @id @map("TenantId") @db.UniqueIdentifier
  isolation  Int @map("Isolation") @db.TinyInt
  targetId   String @map("TargetId") @db.NVarChar(128)
  schemaName String? @map("SchemaName") @db.NVarChar(128)
  region     String @map("Region") @db.NVarChar(128)
  version    BigInt @map("Version")
  lifecycle  Int @map("Lifecycle") @db.TinyInt
  authorities TenantAuthority[]
  memberships TenantMembership[]

  @@map("TenantPlacements")
}
```

Tenant relations include tenant identity in both foreign and referenced keys:

Source: [prisma/tenant.prisma](prisma/tenant.prisma).

```prisma
model UserRole {
  tenantId String @map("TenantId") @db.UniqueIdentifier
  userId Int @map("UserId")
  roleId Int @map("RoleId")
  user User @relation(fields: [tenantId, userId], references: [tenantId, id], onDelete: NoAction, onUpdate: NoAction)
  role Role @relation(fields: [tenantId, roleId], references: [tenantId, id], onDelete: NoAction, onUpdate: NoAction)
  @@id([tenantId, userId, roleId])
  @@map("UserRoles")
}
```

@map and @@map preserve physical names while exposing application-friendly client names.
@db.UniqueIdentifier and other native type annotations describe SQL Server types. Composite
IDs generate compound where inputs. NoAction preserves the explicit deletion policy.
Prisma mappings are not a replacement for SQL RLS, filtered indexes or migration history.

### SQL querying and transactions

Catalog lookup projects only the fields needed for an authority decision:

Source: [src/infrastructure/prisma/prisma.service.ts](src/infrastructure/prisma/prisma.service.ts).

```typescript
  async findTenant(
    authority: string,
    signal: AbortSignal,
  ): Promise<string | null> {
    signal.throwIfAborted();
    const row = await this.db.tenantAuthority.findUnique({
      where: { authority },
      select: { tenantId: true, isActive: true },
    });
    signal.throwIfAborted();
    return row?.isActive ? row.tenantId : null;
  }
```

The signal checks above are cooperative application checks. HTTP disconnects are deliberately
not wired to them; a client disconnect does not cancel SQL work or roll back a mutation.

TenantStorage reauthorizes the immutable context before selecting a trusted placement:

Source: [src/infrastructure/prisma/prisma.service.ts](src/infrastructure/prisma/prisma.service.ts).

```typescript
  async execute<T>(
    context: TenantContext,
    action: (db: TenantTransaction) => Promise<T>,
  ): Promise<T> {
    const region = process.env.TENANT_REGION;
    if (!region) throw new Error('Tenant region is not configured.');
    await new TenantContextAuthorizer(this.catalog, region).reauthorize(
      context,
      new AbortController().signal,
    );
    return this.executeAtPlacement(context.placement, action);
  }
```

The selected client opens an interactive transaction. Row isolation pins SESSION_CONTEXT
to that transaction connection using a parameterized tagged SQL template:

Source: [src/infrastructure/prisma/prisma.service.ts](src/infrastructure/prisma/prisma.service.ts).

```typescript
    return client.$transaction(
      async (db) => {
        if (placement.isolation === TenantIsolation.Row) {
          // The transaction pins every subsequent Prisma statement to this checked connection.
          await db.$executeRaw`EXEC sys.sp_set_session_context @key=N'TenantId', @value=${placement.tenantId}, @read_only=0`;
        }
```

Before business queries, the full method verifies the enabled RLS policy and its predicates.
Its finally block clears TenantId. Query values in tagged templates are parameters; SQL
identifiers require trusted configuration rather than client-input concatenation. All
statements in one unit of work must use the supplied transaction client. Do not retain it
after the callback or call a separate root client to bypass the transaction boundary.

### Schema generation and migrations

Admin owns database provisioning and migration. NestJS has no authoritative Prisma Migrate
history. Updating a .prisma file or running prisma generate changes client code, not SQL.
The local deployment invokes Admin local-init, whose fresh-schema branch includes:

Source: [../Admin/LocalTenantBootstrap.cs](../Admin/LocalTenantBootstrap.cs).

```csharp
            if (Convert.ToInt32(await probe.ExecuteScalarAsync(token)) == 0)
            {
                await using var transaction = await admin.Database.BeginTransactionAsync(token);
                // Generate the composite-key tenant model, not the legacy hard-coded migrations.
                var script = admin.Database.GenerateCreateScript();
                foreach (var batch in System.Text.RegularExpressions.Regex.Split(script, @"^GO\s*$",
                             System.Text.RegularExpressions.RegexOptions.Multiline))
                    if (!string.IsNullOrWhiteSpace(batch))
                        await admin.Database.ExecuteSqlRawAsync(batch, token);
                await transaction.CommitAsync(token);
            }
```

This branch generates the EF tenant model only when the target schema contains no tables.
It does not upgrade populated schemas or prove they match current code. The subsequent
row-isolation branch installs the row-security script. Catalog baselines are separate SQL
files under Infrastructure/Tenancy, invoked by the local deployment script.

For a persistent schema change, update the owning Admin/EF configuration, define a versioned
migration and backfill, test an upgrade on representative data, update Prisma mappings,
and regenerate the clients. Deploy compatible application changes before any destructive
contract phase. Never run prisma db push or migrate reset against deployed tenant storage.

From NestJs, client validation and generation use the checked-in commands:

```powershell
npm run prisma:validate:catalog
npm run prisma:validate:tenant
npm run prisma:generate:catalog
npm run prisma:generate:tenant
npm run build
```

Required connection variables come from private environment configuration. Generated files
remain ignored and must not be edited by hand. The migration sequence and recovery boundaries
are described in [the architecture reference](READ.md#9-migrations-who-owns-the-database).
