using Application.Tenancy;
namespace Infrastructure.Tenancy.Caching;

// TODO(SAAS-01): Inject Redis transport, serializer, and TimeProvider for deterministic tests.
// TODO(SAAS-01): Version entries, bound TTL/fallback, and never store credentials in placement values.
// TODO(SAAS-01): Translate only transport outages/timeouts to TenantPlacementCacheUnavailableException.
// CachedTenantCatalog owns lookup fallback; cancellation/corruption must propagate from this adapter.
public sealed class RedisTenantPlacementCache : ITenantPlacementCache
{
    public Task<TenantPlacement?> GetAsync(Guid tenantId, CancellationToken cancellationToken)
        => throw new NotImplementedException("TODO(SAAS-01): Cache read.");
    public Task SetAsync(TenantPlacement placement, CancellationToken cancellationToken)
        => throw new NotImplementedException("TODO(SAAS-01): Version-aware cache write.");
    public Task InvalidateAsync(Guid tenantId, CancellationToken cancellationToken)
        => throw new NotImplementedException("TODO(SAAS-01): Cache invalidation.");
}
