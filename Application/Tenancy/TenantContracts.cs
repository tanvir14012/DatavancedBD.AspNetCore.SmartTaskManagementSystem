namespace Application.Tenancy;

/// <summary>Untrusted request authority and tenant selector to resolve.</summary>
public sealed record TenantRequest(string? Host, string? TenantSelector);

/// <summary>Looks up organization placement; null means absent, never a dependency failure.</summary>
/// <remarks>Lookup does not authorize access or guarantee that a cached revision is current.</remarks>
public interface ITenantCatalog
{
    /// <summary>Looks up tenant placement; absence returns null.</summary>
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
    /// <summary>Reads the entry or returns a cache miss when absent.</summary>
    Task<TenantPlacement?> GetAsync(Guid tenantId, CancellationToken cancellationToken);
    /// <summary>Stores an entry according to its expiration and version rules.</summary>
    Task SetAsync(TenantPlacement placement, CancellationToken cancellationToken);
    /// <summary>Invalidates the tenant's cached placement.</summary>
    Task InvalidateAsync(Guid tenantId, CancellationToken cancellationToken);
}

/// <summary>Resolves a tenant identity without granting access to it.</summary>
public interface ITenantResolver
{
    /// <summary>Resolves the request selectors to a tenant identifier without granting access.</summary>
    Task<Guid> ResolveAsync(TenantRequest request, CancellationToken cancellationToken);
}

/// <summary>Validates subject membership and access against authoritative tenant data.</summary>
public interface ITenantAccessValidator
{
    /// <summary>Validates the supplied tenant operation against the implementing authority.</summary>
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

/// <summary>Persists a placement only when its expected durable revision still matches.</summary>
/// <remarks>Implementations must advance revisions monotonically and must not publish cache state before commit.</remarks>
public interface ITenantCatalogWriter
{
    /// <summary>Returns false when the expected revision is stale or an initial insert already exists.</summary>
    Task<bool> TrySaveAsync(TenantPlacement placement, long expectedVersion, CancellationToken cancellationToken);
}

/// <summary>Used by the request/job boundary after authentication and access validation.</summary>
public interface ITenantContextInitializer
{
    /// <summary>Establishes context once; repeated initialization is always rejected.</summary>
    void Initialize(TenantContext context);
}

/// <summary>Builds application cache keys inside the current organization boundary.</summary>
/// <remarks>
/// The legacy scope is retained for endpoints that have not yet opted into tenant authorization.
/// Tenant-aware endpoints must establish <see cref="TenantContext"/> before using this service.
/// </remarks>
public interface ITenantCacheKeyBuilder
{
    /// <summary>Builds a key inside the current tenant cache namespace.</summary>
    string Build(string key);
    /// <summary>Builds an invalidation pattern inside the current tenant cache namespace.</summary>
    string BuildPattern(string pattern);
}
