# Smart Task Management System — SaaS scaffold

This branch prepares the existing .NET 10 / Angular 21 application for organization-level multi-tenancy. It is a scaffold, **not a production-ready multi-tenant application**.

## Current state

- Existing application features remain in place; legacy persistence/authentication are still active.
- New SaaS contracts and adapters are not registered. Unimplemented adapters throw explicitly.
- Completed SAAS-01a: immutable tenant placement validation with focused unit tests. Azure/Redis catalog providers remain placeholders.
- Completed SAAS-01b: cache-first catalog orchestration with classified outage fallback, identity checks, cancellation and safe diagnostic events. It remains unwired until provider adapters are implemented.
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
| Infrastructure/Tenancy/Catalog | Tested cache-first catalog decorator and durable Azure SQL adapter placeholder |
| Infrastructure/Tenancy/Caching | Redis placement cache; never authoritative |
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
