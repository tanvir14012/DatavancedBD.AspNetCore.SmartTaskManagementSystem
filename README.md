# Smart Task Management System — SaaS scaffold

This branch prepares the existing .NET 10 / Angular 21 application for organization-level multi-tenancy. It is a scaffold, **not a production-ready multi-tenant application**.

## Current state

- Existing application features remain in place; legacy persistence/authentication are still active.
- Tenant catalog provider composition is registered lazily; tenant authorization and storage adapters remain opt-in until their persistence units are complete.
- Completed SAAS-01a: immutable tenant placement validation with focused unit tests.
- Completed SAAS-01b: cache-first catalog orchestration with classified outage fallback, identity checks, cancellation and safe diagnostic events.
- Completed SAAS-01c: Redis placement payloads with bounded expiry, size limits, primary-only reads, atomic newer-revision publication, targeted deletion, and classified transport failures.
- Completed SAAS-01d: durable SQL compare-and-set writes, post-commit cache publication, and external configuration/DI composition. Registration performs no network I/O; SQL and Redis bindings are supplied by deployment configuration.
- Placement serialization now uses an explicit, strict format version and bounded uncompressed JSON; cancellation and Redis failure classification have dedicated regression coverage.
- Redis publication preserves the full Int64 revision range, rejects same-revision payload conflicts, and uses absolute millisecond expiry and bounded waits. Real Redis tests are opt-in; deletion/expiry does not fence stale writers.
- Completed SAAS-02a: immutable active tenant context and atomic single initialization per request/job scope. Authentication, membership checks and HTTP composition remain separate pending units.
- Completed SAAS-04a: browser organization context is an in-memory, validated, generation-stamped store. It contains no placement, credential or local-storage state; API interception remains a separate composition unit.
- Web startup migration/seeding registration has been removed. Existing databases must already be initialized.
- Admin and Worker entry points exit with code 1 until implemented; they perform no operations.
- All GitHub Actions and Azure DevOps deployment/cleanup pipelines are manual-only placeholders. They neither build nor deploy nor delete resources.
- Existing Azure VM/IIS/Nginx assets and guides are historical; they are not the SaaS deployment path.

## Organization isolation

| Tier | Placement |
| --- | --- |
| Large | Dedicated organization database |
| Medium | A shared database group with one schema per organization |
| Small | A shared database group and schema, with TenantId separating organizations |

TenantId always identifies the purchasing organization. Departments are business entities, not storage tenants. Shared groups have capacity limits and can expand across databases and regions.

## Structure

| Path | Boundary |
| --- | --- |
| Application/Tenancy | Provider-independent catalog, resolution, context, migration and provisioning contracts |
| Api/Tenancy | HTTP composition placeholder; authenticate and authorize before tenant persistence |
| Infrastructure/Tenancy/Catalog | Tested cache-first catalog decorator, durable Azure SQL adapter and external DI composition |
| Infrastructure/Tenancy/Caching | Tested Redis placement adapter/transport; never authoritative |
| Infrastructure/Tenancy/Persistence | Database, schema and discriminator strategies |
| Infrastructure/Tenancy/Migrations | Out-of-band migration orchestration |
| Infrastructure/Tenancy/Provisioning | Allocate, migrate, validate and activate organizations |
| Admin | Separate migration/provisioning process |
| Worker | Separate tenant-scoped background process |
| Infrastructure.Tests/Tenancy | Explicitly skipped backend acceptance scenarios |
| Frontend/Angular/src/app/core/tenancy | Browser context and interceptor placeholders plus pending tests |
| deploy | Container, AKS, configuration and telemetry TODO specifications |
| docs/saas | Implementation sequence and testability requirements |

## Configuration ownership

Environment variables provide deployment bootstrap bindings. Azure App Configuration holds application policies; Azure SQL holds durable tenant placements; Redis caches versioned placements; Key Vault holds secrets where workload identity cannot replace them.

No tenant inventory or credentials belongs in source, images, pipeline YAML or Helm values. Existing legacy appsettings configuration has not yet been converted. See [configuration placeholders](deploy/configuration/README.md).

## Local verification

From the root:

- dotnet restore
- dotnet build --no-restore
- dotnet test Infrastructure.Tests/Infrastructure.Tests.csproj --no-build
- dotnet run --project Admin (currently exits 1 intentionally)
- dotnet run --project Worker (currently exits 1 intentionally)

Frontend, from Frontend/Angular:

- npm ci
- npm run build:prod
- npm test -- --watch=false

To run the legacy API, supply ConnectionStrings__DefaultConnection, Jwt__Key, Jwt__Issuer, Jwt__Audience and appropriate CORS settings through your environment. Use an existing initialized development database; web startup no longer creates or seeds it. Explicit legacy EF migrations are only appropriate for a disposable single-target development database after reviewing the existing SQL. The SaaS Admin runner is not ready.

## Delivery rules

Build immutable artifacts once and promote identical digests. Run reviewed migrations as an AKS release Job with separate administrative identity; deploy compatible API/worker versions afterward. Onboard tenants through an independent admin workflow.

No automatic migrations, target enumeration or sample seeding in web startup. No sticky sessions or durable pod-local state. Apply expand-and-contract schema changes; rolling back an image does not undo a tenant move.

## Next modules

Follow [the implementation and acceptance roadmap](docs/saas/ROADMAP.md). Each TODO identifier represents a bounded follow-up. Pending tests are not evidence of completed behavior.
