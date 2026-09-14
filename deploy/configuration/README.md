# Configuration boundary — SAAS-01

The API binds these external sections at its composition root. Environment variables, Azure App
Configuration and Key Vault references use the normal .NET hierarchical binding form; no tenant
inventory, connection string or credential is committed to source, an image, a pipeline or Helm values.

- `Saas__TenantCatalog__Sql__ConnectionString`, `ConnectTimeoutSeconds`, and `MaxPoolSize` configure the control-plane SQL pool.
- `Saas__TenantCatalog__Read__CommandTimeoutSeconds` and `LookupTimeoutSeconds` bound catalog reads/writes.
- `Saas__TenantCatalog__Cache__KeyPrefix`, `AbsoluteExpiration`, and `MaxPayloadBytes` control disposable placement entries.
- `Saas__TenantCatalog__Redis__ConnectionString`, `Database`, and `CommandTimeoutMilliseconds` configure the placement Redis pool.

`AddTenantCatalog` binds these settings without contacting either provider. Resolution of a provider
validates required values and then creates one bounded singleton pool. The SQL catalog remains the
authority; Redis is a versioned cache and post-commit publication target. Placement writes require an
expected revision. Cache deletion is not a relocation fence and must be paired with later cutover work.

AKS should supply secret references through workload identity/Key Vault and rotate them by restarting
disposable processes. Never log connection strings, tenant target identifiers from untrusted requests,
or serialized placement payloads.
