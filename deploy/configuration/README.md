# Configuration boundary — TODO(SAAS-01)

- Define and validate environment bindings for App Configuration, catalog, Redis, region and operational budgets.
- Authenticate with AKS workload identity; resolve secret references without logging credentials.
- Catalog is durable authority; Redis is a versioned cache. API resolves only requested organizations.
- Keep release settings separate from live placement. Placement updates require safe activation, not a config-only data move.
- Test malformed bootstrap settings, unavailable providers, cache eviction, version races and credential rotation.
