namespace Application.Tenancy;

public sealed record TenantRequest(string? Host, string? TenantSelector);

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

/// <summary>Reads the immutable tenant context established for this request or job scope.</summary>
public interface ITenantContextAccessor
{
    /// <summary>Throws if the authenticated, authorized context has not been established.</summary>
    TenantContext Current { get; }
}

/// <summary>Reads the durable authority for access decisions; a placement cache cannot implement this contract.</summary>
/// <remarks>A read does not fence an already running operation against a later placement change.</remarks>
public interface IAuthoritativeTenantCatalog : ITenantCatalog
{
}

/// <summary>Used by the request/job boundary after authentication and access validation.</summary>
public interface ITenantContextInitializer
{
    /// <summary>Establishes context once; repeated initialization is always rejected.</summary>
    void Initialize(TenantContext context);
}
