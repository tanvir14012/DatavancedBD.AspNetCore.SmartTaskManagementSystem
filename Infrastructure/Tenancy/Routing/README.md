# Resolution and regional routing — TODO(SAAS-02, SAAS-07)

Implement ITenantResolver and ITenantAccessValidator using injected domain mapping and identity/membership readers. Set an immutable scoped ITenantContextAccessor once. Never fall back to a default tenant. Resolve home region and versioned target; fence old writers during relocation. Test selector conflicts, independent scopes and stale placement.
