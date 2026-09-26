# AGENTS.md — Architecture & Development Standards

**Project:** DatavancedBD Smart Task Management System

**Engineering role:** Principal software architect and accountable implementer.

These rules apply to all new or modified code in this repository. Prioritize security and tenant isolation, then correctness, maintainability, performance, and simplicity. MUST denotes a requirement; SHOULD permits a documented, evidence-based exception. Do not expand a focused task into an unrelated modernization.

## 1. Repository baseline and architectural direction

- Backend: .NET 10, ASP.NET Core, EF Core SQL Server, MediatR CQRS, FluentValidation, and centrally managed NuGet versions in `Directory.Packages.props`.
- Frontends: Angular 21 in `Frontend/Angular`; React 19 in `Frontend/React`. Read each package manifest and lockfile before choosing commands or APIs.
- Hosts: `Api` handles HTTP, `Worker` handles background work, and `Admin` handles provisioning/migrations. `Shared` contains genuinely shared primitives, not business services.
- Deployment: root Dockerfiles and `docker-compose.saas.yml`, Helm under `deploy/aks/chart`, Azure infrastructure under `Azure/infra`, local acceptance tooling under `deploy/local`.
- **Deployment target:** database-per-tenant for the requested nine-tenant production topology, with a separate system/catalog database. Nine is deployment configuration, never a hardcoded application limit. Separate databases do not necessarily require separate servers.
- **Existing implementation:** Database, Schema, and Row isolation strategies coexist; the nine-company local environment uses all three. Root Compose alone does not provision nine isolated tenant databases. Preserve existing safeguards and compatibility; changing topology requires an explicit migration plan.
- Existing legacy paths are not proof of production readiness. Domain currently references Identity/EF, warnings-as-errors is disabled centrally, React has no test script, and some tenancy acceptance tests are placeholders. Do not describe these standards as already enforced.

Read `docs/Multitenancy.md`, relevant code, tests, and deployment documentation before changing tenancy. Record significant boundary, storage, security, or deployment decisions in a short ADR under `docs/adr/` with context, alternatives, consequences, migration, and rollback.

```text
Trusted ingress -> Angular / React -> API -> Application -> Domain
                                      |         ^
                               composition     ports
                                      |         |
                                 Infrastructure
                                  /          \
                          System catalog   Tenant databases
                         Admin and Worker use the same boundaries
```

Arrows in the upper flow describe requests; compile-time dependencies MUST point inward. Infrastructure implements Application ports; host composition roots wire implementations.

## 2. Design and code conventions

- Apply SOLID through focused responsibilities, substitutable contracts, small interfaces, and dependency inversion. One handler serves one command/query. Avoid generic repositories, mediator chains, or extra layers without a concrete need.
- Centralize repeated domain rules (DRY), choose the simplest maintainable solution (KISS), and omit speculative features/configuration (YAGNI). Prefer composition and explicit dependencies over inheritance and service location.
- Keep new domain rules in entities/value objects/domain services, independent of EF, HTTP, and SDK types. Do not extend the existing Domain framework coupling. Application owns use cases, authorization requirements, validation, and ports; Infrastructure owns persistence and integrations.
- Keep endpoints thin: bind, authenticate/authorize, dispatch, map results. Do not return EF entities or expose persistence contracts as public API DTOs. Follow existing feature folders and `Command`/`Query`, `Handler`, `Validator`, `Response` naming.
- Follow `.editorconfig`; use descriptive domain names, guard clauses, focused methods, and comments explaining intent. Public contracts need useful documentation. Avoid unrelated formatting and generated-file edits.
- Use the language version supported by the configured SDK. Primary constructors, collection expressions, and other features are tools, not requirements. Do not enable preview features or claim Native AOT compatibility without publish/runtime verification.
- Keep nullable reference types enabled. Prefer explicit null handling over null-forgiving operators. Introduce no new compiler/analyzer warnings; do not suppress diagnostics broadly to pass a build.
- Use asynchronous I/O and propagate `CancellationToken` through handlers, EF, HTTP, queues, and SDKs. Avoid `.Result`, `.Wait()`, `async void` outside event handlers, and unobserved fire-and-forget work. Do not translate cancellation into success.
- Match DI lifetimes to ownership. Never capture scoped services in singletons or share a DbContext across threads. Dispose resources; use UTC instants and injectable `TimeProvider` for time-dependent behavior.

## 3. Tenant isolation and security — non-negotiable

- Treat hosts, forwarded headers, selectors such as `X-Tenant-ID`, and token claims as untrusted inputs. Trust forwarded headers only from configured proxies. Resolve through `ITenantResolver`, then independently validate authenticated membership, permissions, placement lifecycle, region, and revision against authoritative data.
- Resolution is not authorization. Reject missing, malformed, conflicting, disabled, or unauthorized tenants; never fall back to another tenant or the legacy/default database. Validate token signature, issuer, audience, lifetime, and tenant binding.
- Establish an immutable `TenantContext` once per request/job scope. Reauthorize queued work at execution time; do not reuse a request's services or stale authorization. Local server-bound tenancy MUST remain environment-specific and reject conflicting identity.
- Tenant application code MUST use the existing scoped `TenantDbContextFactory` and authorized storage strategy. `ITenantDbContextFactory` is not an existing repository interface. Only infrastructure factories/composition may construct tenant contexts; never derive connection strings, schemas, or target names directly from client input.
- A DbContext and transaction MUST remain within one tenant boundary. Cross-tenant administration requires explicit privileged orchestration, separately scoped operations, and auditing. Tenant credentials MUST have access only to their intended resources; runtime identities MUST NOT have provisioning/DDL privileges.
- Preserve all supported isolation defenses: physical database boundaries, schema/model-cache separation, or tenant-prefixed keys/foreign keys, filters, write guards, and SQL RLS for shared rows. Raw SQL, bulk operations, Identity stores, and reused connections MUST preserve equivalent guarantees; EF filters alone are insufficient.
- Namespace caches, invalidation, idempotency keys, jobs, files/blobs, exports, and subscriptions by tenant and any necessary user/permission scope. Clear browser caches/state on tenant switch and logout. Never use placement caches as authorization authority or publish uncommitted placement revisions.
- Enforce resource-level authorization on every read and mutation; tenant membership alone does not grant access to every project/task. Deny by default. Apply bounded request sizes, pagination, and appropriate per-tenant/user rate limits.
- Use parameterized SQL, explicit DTO binding, server-side validation, safe output encoding, restrictive CORS, and CSRF protection for cookie-authenticated mutations. Never render untrusted HTML without approved sanitization.
- Never commit secrets, private keys, real credentials, or credential-bearing connection strings, including logs, fixtures, and generated files. Use development secret stores and production managed/workload identity with Key Vault or an approved secret provider. Browser bundles contain no secrets. Require encrypted production connections and certificate validation.

## 4. Data integrity and resilience

- Commands own transactional changes within one tenant/database. Enforce invariants with database constraints as well as application validation. Use optimistic concurrency where concurrent updates can overwrite work; return explicit conflict outcomes.
- Keep queries side-effect-free; project DTOs, use no-tracking where appropriate, bound results, and avoid N+1 queries. Add indexes from actual query plans/workloads. Do not introduce unbounded fan-out across tenants.
- External effects cannot be made atomic by holding a database transaction open. Use a transactional outbox and idempotent consumers when durable delivery is required; deduplicate retries within the tenant boundary.
- Apply deadlines, bounded retries with backoff/jitter, and circuit breakers to transient outbound failures. Retry only safe/idempotent operations; avoid stacking SDK and HTTP retry policies. Never retry validation, authorization, cancellation, or permanent failures indiscriminately.
- Run production migrations through controlled Admin/deployment jobs, never ordinary API startup. Use expand/contract changes compatible with rolling deployments; bound concurrency, serialize conflicting migrations, record versions, and support interruption/resumption.
- Destructive changes require an explicit data migration, verified backup/restore procedure, and recovery plan. Test upgrades on representative data; a fresh database test is insufficient. Provisioning MUST NOT activate incomplete tenants; relocation MUST fence stale placements.

## 5. Frontend standards

- Enable strict TypeScript; no new `any`, blanket lint suppression, or unsafe assertions. Parse untrusted data at boundaries; use `unknown` with narrowing. Reuse API contracts deliberately rather than duplicating business rules.
- Angular: use standalone components, `OnPush`, built-in `@if`/`@for`/`@switch`, and stable tracking keys. Prefer signals/computed for synchronous state; reserve effects for side effects. Use RxJS for asynchronous composition with managed subscriptions and `toSignal()` where appropriate. Do not introduce new NgModules or legacy structural directives.
- React: use function components, typed props, and hooks following their lifecycle rules. Use TanStack Query for server state and Zustand only for shared client state; keep local state local. Use `use`, actions, and optimistic updates only when their semantics fit, with failure recovery and cache invalidation.
- Both clients MUST handle loading, empty, error, forbidden, and retry states. Preserve keyboard navigation, semantic HTML, labels, focus, localization, and responsive behavior. Test accessibility of changed interactions. Frontend guards never replace backend authorization.

## 6. Deployment and operability

- Use multi-stage build/publish/runtime images, supported pinned bases, non-root runtime users, and minimal runtime contents. Exclude secrets/build caches; scan dependencies and images. Set image-size budgets from measured requirements, not an arbitrary universal cap.
- Keep Helm/Kubernetes changes in `deploy/aks/chart` and follow existing configuration ownership. Separate nonsecret configuration from secret references. Define measured resource requests/limits, least-privilege service accounts, network policies, and restricted security contexts.
- API currently exposes `/alive` (liveness), `/ready` (readiness), and `/health`. Liveness MUST NOT restart healthy processes because an external service is unavailable. Readiness reflects ability to serve traffic; use startup probes for slow initialization. Probe commands MUST exist in the shipped image; tune intervals/timeouts to the workload.
- Use graceful shutdown, bounded worker concurrency, and tenant-aware admission to contain noisy neighbors. Define deployment rollback and backup/restore expectations; validate restores and tenant recovery before production readiness claims.
- Emit structured, redacted logs and correlated traces/metrics for latency, errors, saturation, and dependency failures. Audit security, tenant lifecycle, and administrative changes. Avoid unbounded tenant/user metric labels and exposing internal health details publicly.

## 7. Testing strategy

Test observable behavior and risks, not private implementation details. Add a regression test for bug fixes; choose the smallest meaningful suite, with broader tests for changes crossing boundaries.

| Layer | Required evidence when affected |
| --- | --- |
| Unit | Domain invariants, validators, handler outcomes, authorization decisions, cancellation, and failure paths; deterministic clocks/data; mock external boundaries only. |
| Integration | Real SQL Server/Redis in isolated disposable environments for persistence, transactions, constraints, RLS, migrations, Lua, concurrency, and cache semantics. EF InMemory/SQLite cannot prove SQL Server behavior. |
| API/contract | Real host pipeline, authentication/authorization, tenant binding, DTO validation, status/error contracts, and backward compatibility. |
| Frontend | User-visible component behavior, forms, accessibility, async errors, cache invalidation, and tenant switching. |
| End-to-end/operations | Critical login/project/task flows, two-tenant adversarial access, provisioning/upgrade/recovery, and relevant container/probe behavior. |

Tenant-sensitive changes MUST test at least two tenants with colliding entity/user IDs: valid access within each tenant, denied cross-tenant reads/writes, spoofed/conflicting selectors, unauthorized claims, and absence of default-database fallback. Cover affected cache keys/invalidation, background scopes, stale placement, and concurrent requests. Test every affected storage strategy, including reused connections/model caches where relevant.

Use unique databases/key prefixes and clean up only test-owned resources; never flush shared Redis or use production data. Do not use sleeps as synchronization or hide flaky tests through retries. Coverage identifies gaps; percentages do not replace assertions. Skipped tests and placeholder acceptance tests are missing evidence, not passes.

## 8. Verification commands

Run from the repository root unless noted. Inspect current manifests and CI before execution; use installed repository tooling and locked dependencies. Run checks relevant to the change, and report exact outcomes. Documentation-only edits need path/content and diff checks, not service startup or a full application build.

**Backend changes:**

```powershell
dotnet restore DatavancedBD.AspNetCore.SmartTaskManagementSystem.slnx
dotnet build DatavancedBD.AspNetCore.SmartTaskManagementSystem.slnx --configuration Release --no-restore /p:TreatWarningsAsErrors=true
dotnet test Infrastructure.Tests/Infrastructure.Tests.csproj --configuration Release --no-build --no-restore --logger trx --results-directory TestResults
```

Only use `--no-build` after a successful matching Release build. The strict build above is the target gate; central props/current CI do not yet enforce it. Report existing warnings separately rather than disabling the gate or claiming success. Include new test projects explicitly if the suite grows.

**Angular changes** — working directory `Frontend/Angular`:

```powershell
npm ci
npm run lint
npm run build:prod
npm test -- --watch=false
```

**React changes** — working directory `Frontend/React`:

```powershell
npm ci
npm run lint
npm run build
```

React currently has no `test` script. For behavioral changes, add appropriate test tooling and tests within scope, or report the missing automated coverage explicitly; never invent a passing `npm test`. Use the existing formatter to check changed frontend files. Do not rewrite unrelated files to satisfy baseline formatting/lint failures.

**Infrastructure/tenancy changes** — select applicable checks:

```powershell
docker compose -f docker-compose.saas.yml config --quiet
docker build -f Dockerfile.api -t stms-api:verify .
docker build -f Dockerfile.admin -t stms-admin:verify .
docker build -f Dockerfile.worker -t stms-worker:verify .
helm lint deploy/aks/chart
helm template stms deploy/aks/chart -f deploy/aks/chart/values-dev.yaml
helm template stms deploy/aks/chart -f deploy/aks/chart/values-prod.yaml
```

Compose validation requires configured environment variables, including `MSSQL_SA_PASSWORD`; do not print secret-bearing rendered configuration. Build the affected frontend Dockerfile using its frontend directory as context. Helm rendering is not cluster validation: validate affected schemas, admission policies, probes, rollout, and runtime behavior in an appropriate test environment.

Redis integration tests require `SAAS_TEST_REDIS_CONNECTION` pointing to an isolated Redis service. `TenancyAcceptanceTests` includes explicitly skipped deployment placeholders; these MUST be implemented/executed before asserting the corresponding production guarantees. See `deploy/local/README.md` for local acceptance. `Start-LocalSaas.ps1` deletes prior local containers/volumes; do not run it as a routine verification step without authorization to discard that data. Use `Test-LocalSaas.ps1` for an existing suitable deployment.

## 9. Definition of done and agent reporting

- [ ] Change is scoped, follows architectural boundaries, and preserves public contracts or documents migration.
- [ ] Applicable builds, analyzers, and meaningful tests pass; tenant/security failure paths have evidence.
- [ ] Data changes preserve isolation/integrity and include tested migration/recovery where applicable.
- [ ] No secrets or sensitive data are introduced; authorization and operational safeguards remain intact.
- [ ] Affected deployment configuration, runtime behavior, documentation, and ADRs are updated and verified.
- [ ] Review `git diff --check` and the final diff; preserve unrelated user changes and leave no accidental artifacts.

Report what changed, checks actually executed and their results, skipped/blocked checks with reasons, and remaining risks. Never claim a build, test, deployment, isolation guarantee, or production readiness without evidence. Never silently weaken a security rule or a test to make verification pass.
