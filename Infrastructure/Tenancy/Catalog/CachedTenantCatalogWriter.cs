using Application.Tenancy;
using Microsoft.Extensions.Logging;

namespace Infrastructure.Tenancy.Catalog;

/// <summary>Publishes a committed placement to the disposable cache after durable CAS succeeds.</summary>
/// <remarks>
/// A stale expected revision is returned without touching Redis. Cache transport outages do not turn
/// a committed write into a failure; malformed cache responses and cancellation still propagate.
/// </remarks>
public sealed class CachedTenantCatalogWriter : ITenantCatalogWriter
{
    private readonly ITenantCatalogWriter _source;
    private readonly ITenantPlacementCache _cache;
    private readonly ILogger<CachedTenantCatalogWriter> _logger;

    /// <summary>Captures durable writer and cache dependencies without performing I/O.</summary>
    public CachedTenantCatalogWriter(
        ITenantCatalogWriter source,
        ITenantPlacementCache cache,
        ILogger<CachedTenantCatalogWriter> logger)
    {
        _source = source ?? throw new ArgumentNullException(nameof(source));
        _cache = cache ?? throw new ArgumentNullException(nameof(cache));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    /// <inheritdoc />
    public async Task<bool> TrySaveAsync(TenantPlacement placement, long expectedVersion, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(placement);
        cancellationToken.ThrowIfCancellationRequested();
        var applied = await _source.TrySaveAsync(placement, expectedVersion, cancellationToken).ConfigureAwait(false);
        cancellationToken.ThrowIfCancellationRequested();
        if (!applied)
            return false;

        try
        {
            await _cache.SetAsync(placement, cancellationToken).ConfigureAwait(false);
            cancellationToken.ThrowIfCancellationRequested();
        }
        catch (TenantPlacementCacheUnavailableException)
        {
            cancellationToken.ThrowIfCancellationRequested();
            _logger.LogWarning(new EventId(6103, nameof(CachedTenantCatalogWriter)),
                "Tenant placement cache publication unavailable after durable commit.");
        }

        return true;
    }
}
