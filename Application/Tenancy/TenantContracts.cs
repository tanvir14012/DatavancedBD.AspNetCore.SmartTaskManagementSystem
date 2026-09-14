namespace Application.Tenancy;

public sealed record TenantRequest(string? Host, string? TenantSelector);
public sealed record TenantAccess(Guid TenantId, string SubjectId);
public sealed record TenantContext(TenantPlacement Placement, string SubjectId);

/// <summary>Looks up organization placement; null means absent, never a dependency failure.</summary>
/// <remarks>Lookup does not authorize access or guarantee that a cached revision is current.</remarks>
public interface ITenantCatalog
{
    Task<TenantPlacement?> FindAsync(Guid tenantId, CancellationToken cancellationToken);
}

/// <summary>A disposable cache of durable catalog snapshots, never the source of truth.</summary>
/// <remarks>
/// Implementations enforce expiry and atomic version-aware publication. Expired entries are misses.
/// Translate only transport outages/timeouts to TenantPlacementCacheUnavailableException.
/// Honor cancellation and bounded transport deadlines. Corrupt payloads must not become valid placements.
/// </remarks>
public interface ITenantPlacementCache
{
    Task<TenantPlacement?> GetAsync(Guid tenantId, CancellationToken cancellationToken);
    Task SetAsync(TenantPlacement placement, CancellationToken cancellationToken);
    Task InvalidateAsync(Guid tenantId, CancellationToken cancellationToken);
}

public interface ITenantResolver
{
    Task<Guid> ResolveAsync(TenantRequest request, CancellationToken cancellationToken);
}

public interface ITenantAccessValidator
{
    Task ValidateAsync(TenantAccess access, CancellationToken cancellationToken);
}

// TODO(SAAS-02): Supply exactly one immutable context per authorized request/job scope.
public interface ITenantContextAccessor
{
    TenantContext Current { get; }
}
