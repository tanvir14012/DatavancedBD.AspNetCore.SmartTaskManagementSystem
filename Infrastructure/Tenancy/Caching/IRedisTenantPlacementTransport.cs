namespace Infrastructure.Tenancy.Caching;

/// <summary>Opaque Redis operations required by the placement cache.</summary>
/// <remarks>
/// Implementations must make SetIfNewerAsync atomic with the revision comparison and expiry.
/// Transport outages/timeouts should be translated to TenantPlacementCacheUnavailableException
/// by the cache boundary; malformed stored data must remain an InvalidDataException. Placement reads
/// should use the primary (or an equivalent monotonic-read policy) because replica lag can expose a
/// stale route during a placement move.
/// </remarks>
public interface IRedisTenantPlacementTransport
{
    Task<RedisTenantPlacementEntry?> GetAsync(string key, CancellationToken cancellationToken);

    Task<bool> SetIfNewerAsync(
        string key,
        RedisTenantPlacementEntry entry,
        DateTimeOffset expiresAtUtc,
        CancellationToken cancellationToken);

    Task RemoveAsync(string key, CancellationToken cancellationToken);
}

/// <summary>Payload and revision returned by one Redis placement record.</summary>
public sealed record RedisTenantPlacementEntry(long Version, byte[] Payload);
