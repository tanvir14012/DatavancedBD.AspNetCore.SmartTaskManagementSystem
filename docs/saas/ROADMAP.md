# SaaS implementation and acceptance roadmap

## Testability rules

- Pure application contracts have no Azure SDK or HTTP dependency.
- Inject catalog/cache transports, credential/target providers, lock and migration executors, and TimeProvider into implementations.
- Use cancellation tokens for all I/O. Avoid static current-tenant state, service location and constructors that perform I/O.
- Unit tests use deterministic fakes; infrastructure tests use real disposable SQL Server/Redis. EF in-memory does not verify schemas, RLS or SQL migrations.
- HTTP composition uses WebApplicationFactory. Angular context/interceptor tests use HttpTestingController.
- Separate process entry points only compose dependencies and map command results to exit codes.
- Do not register incomplete adapters. Replace skipped/TODO tests with behavioral tests as each module lands.

| ID | Work and acceptance |
| --- | --- |
| SAAS-01 | Catalog schema/status/version, external configuration, Redis invalidation and fallback. Test eviction, missing tenant, invalid mapping, stale publication and dependency failure. |
| SAAS-02 | Resolver, immutable context, organization-bound JWT/Identity and authorization. Test spoofed/conflicting selectors, membership revocation, refresh isolation and independent concurrent scopes. |
| SAAS-03 | All storage strategies, owned entities, constraints, filters/RLS and schema model cache. Test reads/writes, raw SQL, pooled connection reuse, duplicate local IDs and model reuse against SQL Server. |
| SAAS-04 | Application/HTTP cache isolation and frontend propagation/switching. Test cache collisions, invalidation scope, API origin allowlist and late responses after switching. |
| SAAS-05 | Admin runner, durable target source, deduplication, locks, ledger and schema-aware migrations. Test repeated/concurrent/interrupted runs and database-level partition objects. |
| SAAS-06 | Provisioning and existing-data conversion. Test capacity allocation, inactive failures, validation before activation, and fenced tier relocation. |
| SAAS-07 | Pool budgets, quotas, workers, regional routing and backpressure. Test cancellation, duplicate jobs, fairness, target outage and stale writer rejection. |
| SAAS-08 | Docker/AKS, workload identities, release pipeline, probes and observability. Test fast startup without DDL, graceful disposal, rollout compatibility and all-tier smoke tests. |

## Existing code still awaiting integration

ServiceDbContext, AppDbContextFactory, entity mappings, Identity stores, AuthService, all cache key builders and invalidators, Angular auth interceptor and observability/bootstrap still need tenant-aware implementation. The old migration hosted service remains as legacy source but is no longer registered by web bootstrap.

Do not rewrite deployed migration history blindly. Plan a reviewed baseline/upgrade path for the fixed stms schema, hardcoded partition SQL and ownership backfill. A dedicated database and a schema do not automatically isolate CPU or enforce organization ownership.

## Release acceptance

Every module must pass its unit tests plus relevant infrastructure scenarios before wiring it into production. Existing passing cache tests do not prove SaaS isolation. Track skipped tests explicitly. Pipelines remain placeholders until SAAS-08.
