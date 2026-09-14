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

## Completed increments

### Completed increment: SAAS-01a — placement value object

TenantPlacement is now an immutable, constructor-validated catalog snapshot with organization identity,
explicit isolation/lifecycle, target reference, optional schema override, region and positive revision.
Logical target/region handles start with an ASCII letter/digit and permit ASCII letters/digits plus
dot, underscore and hyphen (maximum 128 characters). Schema identifiers start with a letter/underscore
and permit ASCII letters/digits/underscore (maximum 128). Values are not normalized.
These are catalog naming conventions, not a list of Azure regions or a substitute for SQL quoting.

Schema overrides are required only for schema isolation; database/row placements use the schema in
the target definition. Provisioning, Active, Moving and Suspended snapshots are representable; the
model does not activate tenants, authorize access, enforce transitions or establish revision freshness.
Catalog adapters must still validate required serialized fields, target existence, compatibility and
concurrent version updates. TenantPlacementTests covers structural invariants without external services.
The catalog/cache acceptance placeholder remains skipped because provider behavior is not implemented.

### Completed increment: SAAS-01b — catalog lookup orchestration

CachedTenantCatalog wraps a durable ITenantCatalog and ITenantPlacementCache with constructor-injected
dependencies. It is not registered in the web application. A cache hit is returned only when the
snapshot belongs to the requested organization. A miss reads the durable catalog once and publishes
positive results. Null results are not cached, allowing subsequent onboarding to become visible.

Only TenantPlacementCacheUnavailableException permits graceful cache fallback. Adapters must classify
transport outages/timeouts into this exception; corruption, programming errors and cancellation must
not be classified as outages. Read outages skip cache population on that lookup. Write outages return
the authoritative result. Durable lookup failures always propagate and never masquerade as absence.
Wrong-organization snapshots from either dependency fail closed without invalidation or publication.

Cancellation is forwarded and rechecked after each await, including dependencies that complete after
cancellation. There are no local tenant locks, retries, negative caching or background refresh tasks.
Warning events 6101/6102 identify cache read/write unavailability without logging provider exceptions,
connection details or schema names. Routine hits and misses stay quiet.

This unit does not guarantee a cached snapshot is current or authorize its lifecycle. Redis TTL,
atomic version-aware writes, invalidation races and writer fencing still require adapter/integration
work. Bounded transport deadlines and catalog capacity limits are responsibilities of those dependency
implementations; no timeout or distributed capacity claim is made by this decorator. Compose it
explicitly around the durable adapter to avoid resolving ITenantCatalog recursively through DI.

### Completed increment: SAAS-01c — Redis placement cache adapter

RedisTenantPlacementCache now accepts an injected transport, serializer, validated operational options,
and TimeProvider. It derives an environment/key-prefix-isolated key from the organization identifier;
never accepts a connection string, schema or credential from a placement value; enforces a bounded
serialized payload; and propagates caller cancellation before and after every transport operation.

Placement records are stored as a revision plus opaque serialized payload. Get rejects empty, oversized,
malformed, cross-organization or revision-mismatched entries as InvalidDataException; these are not
classified as cache outages. Set publishes a positive revision with an absolute expiry. The transport
performs the revision comparison, payload write and expiry atomically; an older revision is a harmless
no-op. Invalidate deletes only the derived organization key. There is no local cache, retry loop,
negative cache or background refresh.

StackExchangeRedisTenantPlacementTransport implements the production transport with a Redis hash and
Lua compare-and-set script. Reads and writes demand the primary to avoid replica-lagged placement
routes during a move. It uses WaitAsync for caller cancellation, validates stored hash shape and
revision, and maps only Redis connection/timeout/socket failures at the cache boundary to
TenantPlacementCacheUnavailableException. Server errors and data corruption propagate. TTL and payload
limits are operational options intended to be bound from external deployment configuration; no tenant
metadata or credential is hardcoded. The transport is not registered yet, so web processes do not gain
partial runtime behavior.

RedisTenantPlacementCacheTests cover round-trips, expiry, stale revisions, isolation, corruption,
limits, outage classification and noncooperative cancellation. StackExchangeRedisTenantPlacementTransportTests
cover primary command flags, hash parsing, atomic script arguments, stale results, expiry rejection and
targeted deletion using a mocked database. A live Redis integration test remains part of the deployment
acceptance suite before runtime wiring.

Next bounded unit: durable Azure SQL catalog schema/reader, then explicit DI composition of the two
providers after their integration tests pass.

## Existing code still awaiting integration

### SAAS-01c follow-up — strict placement payload format

JsonTenantPlacementSerializer replaces the general application cache serializer for placements. Its
format version 1 requires every field, rejects duplicates/unknown fields, preserves Int64 revisions,
and accepts only bounded uncompressed JSON. Missing isolation/lifecycle values never become defaults.
The Redis adapter still verifies requested tenant identity and hash/payload revision agreement.
Old unversioned development cache values are intentionally rejected; use a new deployment key prefix
when adopting this format. No durable data conversion is needed. Serializer tests exercise all tiers,
missing fields, malformed values, oversize documents and rejection of compressed input.

### SAAS-01c follow-up — cancellation and failure classification

Cancellation is checked inside catch bodies, never exception filters, so a canceled caller wins over
a simultaneous cache transport failure. Authentication, protocol, disposed-client and integrity errors
propagate as faults instead of being hidden behind durable-catalog fallback. Regression tests cover all
three cache operations and both raw and provider-neutral failure paths.

ServiceDbContext, AppDbContextFactory, entity mappings, Identity stores, AuthService, all cache key builders and invalidators, Angular auth interceptor and observability/bootstrap still need tenant-aware implementation. The old migration hosted service remains as legacy source but is no longer registered by web bootstrap.

Do not rewrite deployed migration history blindly. Plan a reviewed baseline/upgrade path for the fixed stms schema, hardcoded partition SQL and ownership backfill. A dedicated database and a schema do not automatically isolate CPU or enforce organization ownership.

## Release acceptance

Every module must pass its unit tests plus relevant infrastructure scenarios before wiring it into production. Existing passing cache tests do not prove SaaS isolation. Track skipped tests explicitly. Pipelines remain placeholders until SAAS-08.
