# Smart Task Management System — SaaS scaffold

This branch prepares the existing .NET 10 / Angular 21 application for organization-level multi-tenancy. The deployable AKS and CI/CD path is production-oriented, while the explicitly documented live SQL/Redis acceptance and application-specific Worker handler remain release prerequisites.

## Current state

- Existing application features remain in place; legacy persistence/authentication are still active.
- Tenant catalog, authorization and storage provider composition is registered lazily; tenant-aware endpoints opt in only after their persistence cutover is reviewed.
- Completed SAAS-01a: immutable tenant placement validation with focused unit tests.
- Completed SAAS-01b: cache-first catalog orchestration with classified outage fallback, identity checks, cancellation and safe diagnostic events.
- Completed SAAS-01c: Redis placement payloads with bounded expiry, size limits, primary-only reads, atomic newer-revision publication, targeted deletion, and classified transport failures.
- Completed SAAS-01d: durable SQL compare-and-set writes, post-commit cache publication, and external configuration/DI composition. Registration performs no network I/O; SQL and Redis bindings are supplied by deployment configuration.
- Placement serialization now uses an explicit, strict format version and bounded uncompressed JSON; cancellation and Redis failure classification have dedicated regression coverage.
- Redis publication preserves the full Int64 revision range, rejects same-revision payload conflicts, and uses absolute millisecond expiry and bounded waits. Real Redis tests are opt-in; deletion/expiry does not fence stale writers.
- Completed SAAS-02: canonical host/selector resolution, organization-bound claim validation, durable membership checks, active-placement authorization, and an opt-in HTTP policy composition. Tenant-aware persistence endpoints remain gated until SAAS-03.
- Completed SAAS-03: database/schema/row storage factories, dynamic backing-target validation, composite tenant keys and filters, tenant-safe writes, pooled-session SQL row-security checks, and release-runner RLS script generation. Web startup performs no target enumeration or DDL.
- Completed SAAS-04a: browser organization context is an in-memory, validated, generation-stamped store. It contains no placement, credential or local-storage state; API interception remains a separate composition unit.
- Web startup migration/seeding registration has been removed. Existing databases must already be initialized.
- Admin now exposes explicit `migrate` and `provision` commands with cancellation, durable target locks and nonzero failure reporting; Worker now has bounded, tenant-fenced job processing and requires an explicit queue handler adapter.
- Container build files, a health-gated local Compose environment, a reusable AKS Helm chart, environment-specific Azure infrastructure, Key Vault CSI workload identity, cert-manager/ingress add-ons, and GitHub Actions CI/CD for dev/prod are supplied.
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
| Api/Tenancy | Opt-in HTTP policy composition; authenticate and authorize before tenant persistence |
| Infrastructure/Tenancy/Catalog | Tested cache-first catalog decorator, durable Azure SQL adapter and external DI composition |
| Infrastructure/Tenancy/Authorization | Durable authority and membership readers with bounded, fail-closed access checks |
| Infrastructure/Tenancy/Caching | Tested Redis placement adapter/transport; never authoritative |
| Infrastructure/Tenancy/Persistence | Dynamic target routing, database/schema/row strategies, composite model isolation, write guards and RLS session/script boundaries |
| Infrastructure/Tenancy/Migrations | Out-of-band migration orchestration |
| Infrastructure/Tenancy/Provisioning | Allocate, migrate, validate and activate organizations |
| Admin | Separate migration/provisioning process |
| Worker | Separate tenant-scoped background process |
| Infrastructure.Tests/Tenancy | Focused unit tests plus explicitly skipped live-provider acceptance scenarios |
| Frontend/Angular/src/app/core/tenancy | Browser context, API allowlist and generation-fenced interceptor |
| deploy | Container images, production AKS Helm release, add-ons, smoke checks and deployment scripts |
| docs/saas | Implementation sequence and testability requirements |

## Configuration ownership

Environment variables provide deployment bootstrap bindings. Azure App Configuration holds application policies; Azure SQL holds durable tenant placements; Redis caches versioned placements; Key Vault holds secrets where workload identity cannot replace them.

No tenant inventory or credentials belongs in source, images, pipeline YAML or Helm values. Tenant
authority mappings and memberships live in the control plane; deployment supplies only shared-authority
allowlists and provider references. See [configuration boundary](deploy/configuration/README.md).

## Local verification

From the root:

- dotnet restore
- dotnet build --no-restore
- dotnet test Infrastructure.Tests/Infrastructure.Tests.csproj --no-build
- dotnet run --project Admin -- migrate
- dotnet run --project Worker -- run (requires a configured durable queue and work handler)

Frontend, from Frontend/Angular:

- npm ci
- npm run build:prod
- npm test -- --watch=false

To run the legacy API, supply ConnectionStrings__DefaultConnection, Jwt__Key, Jwt__Issuer, Jwt__Audience and appropriate CORS settings through your environment. Use an existing initialized development database; web startup no longer creates or seeds it. Explicit legacy EF migrations are only appropriate for a disposable single-target development database after reviewing the existing SQL. The SaaS Admin runner owns reviewed target migrations.

## Delivery rules

Build immutable artifacts once and promote the identical ACR image tag/digests from dev to prod. CI runs backend/frontend tests and all container builds. Dev CD provisions Azure resources, scans images, updates Key Vault, runs the reviewed Admin migration Job and performs a smoke check. Prod CD is manual and approval-gated through the `stms-prod` GitHub Environment. Onboard tenants through an independent admin workflow.

No automatic migrations, target enumeration or sample seeding in web startup. No sticky sessions or durable pod-local state. Apply expand-and-contract schema changes; rolling back an image does not undo a tenant move.

## Next modules

Follow [the implementation and acceptance roadmap](docs/saas/ROADMAP.md). Live SQL/Redis/AKS acceptance remains an environment-gated release check; focused unit tests are not evidence of production isolation by themselves.
