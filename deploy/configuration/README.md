# Configuration boundary — SAAS-01

The API binds these external sections at its composition root. Environment variables, Azure App
Configuration and Key Vault references use the normal .NET hierarchical binding form; no tenant
inventory, connection string or credential is committed to source, an image, a pipeline or Helm values.

- `Saas__TenantCatalog__Sql__ConnectionString`, `ConnectTimeoutSeconds`, and `MaxPoolSize` configure the control-plane SQL pool.
- `Saas__TenantCatalog__Read__CommandTimeoutSeconds` and `LookupTimeoutSeconds` bound catalog reads/writes.
- `Saas__TenantCatalog__Cache__KeyPrefix`, `AbsoluteExpiration`, and `MaxPayloadBytes` control disposable placement entries.
- `Saas__TenantCatalog__Redis__ConnectionString`, `Database`, and `CommandTimeoutMilliseconds` configure the placement Redis pool.
- `Saas__Tenancy__SharedApiAuthorities__0` (and subsequent indexed values) lists shared API
  authorities that require an explicit `X-Tenant-ID`; tenant-specific authorities are resolved from
  the durable SQL authority directory.
- `Saas__Storage__Targets__{targetId}__Isolation`, `Region`, `Schema`, `ConnectionString`,
  `MaxPoolSize`, and `CommandTimeoutSeconds` define a validated backing-service target. The
  `{targetId}` is a catalog-issued logical handle; it is never accepted directly from a client.
- `Saas__Migration__MaxConcurrency` bounds the Admin migration runner. `Saas__Resilience__*` bounds
  worker global, target and organization concurrency and its admission wait budget.
- `Saas__Provisioning__Defaults__{Database|Schema|Row}__TargetId`, `Region`, and (for Schema)
  `Schema` define trusted provisioning templates. They are read only by the Admin process.

`AddTenantCatalog` binds these settings without contacting either provider. Resolution of a provider
validates required values and then creates one bounded singleton pool. The SQL catalog remains the
authority; Redis is a versioned cache and post-commit publication target. Placement writes require an
expected revision. Cache deletion is not a relocation fence and must be paired with later cutover work.

`AddTenantAuthorization` composes the SQL authority directory, tenant resolver, durable membership
validator and `SaasTenant` policy. `AddTenantStorage` composes the three tenant context factories and
strategy adapters without opening a connection. It reads no tenant inventory during startup. Endpoints
should opt into `RequireTenantContext` only when they use the tenant context factory; legacy endpoints
continue using the legacy context until their cutover is reviewed.

AKS should supply secret references through workload identity/Key Vault and rotate them by restarting
disposable processes. Never log connection strings, tenant target identifiers from untrusted requests,
or serialized placement payloads.
