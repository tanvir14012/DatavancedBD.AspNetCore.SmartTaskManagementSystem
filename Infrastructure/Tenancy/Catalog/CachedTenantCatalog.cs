using Application.Tenancy;
using Microsoft.Extensions.Logging;

namespace Infrastructure.Tenancy.Catalog;

/// <summary>Reads placement from cache, falling back once to the authoritative catalog on a miss or outage.</summary>
/// <remarks>
/// Compose explicitly around a durable ITenantCatalog implementation; do not resolve the decorator
/// as its own inner catalog. Dependencies own transport deadlines and capacity limits.
/// No retries, negative caching, background refresh, tenant-local state or authorization are performed.
/// Cache publication must reject older revisions; routing still requires lifecycle checks and writer fencing.
/// </remarks>
public sealed class CachedTenantCatalog : ITenantCatalog
{
    private readonly ITenantCatalog _source;
    private readonly ITenantPlacementCache _cache;
    private readonly ILogger<CachedTenantCatalog> _logger;

    /// <summary>Creates an inert decorator; construction performs no backing-service I/O.</summary>
    public CachedTenantCatalog(
        ITenantCatalog source, ITenantPlacementCache cache, ILogger<CachedTenantCatalog> logger)
    {
        ArgumentNullException.ThrowIfNull(source);
        ArgumentNullException.ThrowIfNull(cache);
        ArgumentNullException.ThrowIfNull(logger);
        _source = source;
        _cache = cache;
        _logger = logger;
    }

    /// <summary>Returns the matching snapshot, or null only when the durable catalog reports absence.</summary>
    public async Task<TenantPlacement?> FindAsync(Guid tenantId, CancellationToken cancellationToken)
    {
        if (tenantId == Guid.Empty)
            throw new ArgumentException("Organization identity must not be empty.", nameof(tenantId));
        cancellationToken.ThrowIfCancellationRequested();

        TenantPlacement? cached = null;
        var cacheAvailable = true;
        try
        {
            cached = await _cache.GetAsync(tenantId, cancellationToken).ConfigureAwait(false);
        }
        catch (TenantPlacementCacheUnavailableException)
        {
            cancellationToken.ThrowIfCancellationRequested();
            cacheAvailable = false;
            // Do not log the provider exception: its message can contain connection details.
            _logger.LogWarning(new EventId(6101, "TenantCacheReadUnavailable"),
                "Tenant placement cache read unavailable for {TenantId}; using durable catalog.", tenantId);
        }

        cancellationToken.ThrowIfCancellationRequested();
        EnsureMatchingTenant(cached, tenantId);
        if (cached is not null)
            return cached;

        var placement = await _source.FindAsync(tenantId, cancellationToken).ConfigureAwait(false);
        cancellationToken.ThrowIfCancellationRequested();
        EnsureMatchingTenant(placement, tenantId);
        if (placement is null || !cacheAvailable)
            return placement;

        try
        {
            await _cache.SetAsync(placement, cancellationToken).ConfigureAwait(false);
        }
        catch (TenantPlacementCacheUnavailableException)
        {
            cancellationToken.ThrowIfCancellationRequested();
            _logger.LogWarning(new EventId(6102, "TenantCacheWriteUnavailable"),
                "Tenant placement cache write unavailable for {TenantId}; returning durable catalog result.", tenantId);
        }

        cancellationToken.ThrowIfCancellationRequested();
        return placement;
    }

    private static void EnsureMatchingTenant(TenantPlacement? placement, Guid tenantId)
    {
        if (placement is not null && placement.TenantId != tenantId)
            throw new InvalidDataException("Tenant placement identity does not match the requested organization.");
    }
}
