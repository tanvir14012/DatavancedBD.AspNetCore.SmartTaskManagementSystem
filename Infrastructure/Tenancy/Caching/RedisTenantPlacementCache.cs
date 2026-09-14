using System.Net.Sockets;
using System.Text.Json;
using Application.Tenancy;
using Infrastructure.Caching.Serialization;
using Microsoft.Extensions.Options;
using StackExchange.Redis;

namespace Infrastructure.Tenancy.Caching;

/// <summary>Redis-backed, revision-aware cache for durable organization placements.</summary>
/// <remarks>
/// The cache is deliberately a thin boundary: Redis is never authoritative, entries expire, and
/// an older revision cannot replace a newer revision. The transport owns atomic compare-and-set;
/// this class owns key derivation, payload validation, cancellation and outage classification.
/// </remarks>
public sealed class RedisTenantPlacementCache : ITenantPlacementCache
{
    private const string KeyNamespace = "tenant-placement";
    private readonly IRedisTenantPlacementTransport _transport;
    private readonly ICacheSerializer _serializer;
    private readonly TenantPlacementCacheOptions _options;
    private readonly TimeProvider _timeProvider;

    /// <summary>Creates an adapter without performing any Redis or clock I/O.</summary>
    public RedisTenantPlacementCache(
        IRedisTenantPlacementTransport transport,
        ICacheSerializer serializer,
        IOptions<TenantPlacementCacheOptions> options,
        TimeProvider timeProvider)
    {
        ArgumentNullException.ThrowIfNull(transport);
        ArgumentNullException.ThrowIfNull(serializer);
        ArgumentNullException.ThrowIfNull(options);
        ArgumentNullException.ThrowIfNull(timeProvider);

        options.Value.Validate();
        _transport = transport;
        _serializer = serializer;
        _options = options.Value;
        _timeProvider = timeProvider;
    }

    /// <inheritdoc />
    public async Task<TenantPlacement?> GetAsync(Guid tenantId, CancellationToken cancellationToken)
    {
        ValidateTenantId(tenantId);
        cancellationToken.ThrowIfCancellationRequested();

        RedisTenantPlacementEntry? entry;
        try
        {
            entry = await _transport.GetAsync(BuildKey(tenantId), cancellationToken).ConfigureAwait(false);
        }
        catch (Exception exception) when (IsUnavailable(exception))
        {
            cancellationToken.ThrowIfCancellationRequested();
            throw exception as TenantPlacementCacheUnavailableException
                ?? new TenantPlacementCacheUnavailableException(exception);
        }

        cancellationToken.ThrowIfCancellationRequested();
        if (entry is null)
            return null;

        return Deserialize(entry, tenantId);
    }

    /// <inheritdoc />
    public async Task SetAsync(TenantPlacement placement, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(placement);
        ValidateTenantId(placement.TenantId);
        cancellationToken.ThrowIfCancellationRequested();

        var payload = Serialize(placement);
        var entry = new RedisTenantPlacementEntry(placement.Version, payload);
        var expiresAtUtc = _timeProvider.GetUtcNow().Add(_options.AbsoluteExpiration);

        try
        {
            // A false result is an expected stale-writer no-op. The interface intentionally has no
            // result because callers only need cache publication, never cache authority.
            _ = await _transport.SetIfNewerAsync(
                BuildKey(placement.TenantId), entry, expiresAtUtc, cancellationToken).ConfigureAwait(false);
        }
        catch (Exception exception) when (IsUnavailable(exception))
        {
            cancellationToken.ThrowIfCancellationRequested();
            throw exception as TenantPlacementCacheUnavailableException
                ?? new TenantPlacementCacheUnavailableException(exception);
        }

        cancellationToken.ThrowIfCancellationRequested();
    }

    /// <inheritdoc />
    public async Task InvalidateAsync(Guid tenantId, CancellationToken cancellationToken)
    {
        ValidateTenantId(tenantId);
        cancellationToken.ThrowIfCancellationRequested();

        try
        {
            await _transport.RemoveAsync(BuildKey(tenantId), cancellationToken).ConfigureAwait(false);
        }
        catch (Exception exception) when (IsUnavailable(exception))
        {
            cancellationToken.ThrowIfCancellationRequested();
            throw exception as TenantPlacementCacheUnavailableException
                ?? new TenantPlacementCacheUnavailableException(exception);
        }

        cancellationToken.ThrowIfCancellationRequested();
    }

    private TenantPlacement Deserialize(RedisTenantPlacementEntry entry, Guid tenantId)
    {
        if (entry.Version <= 0 || entry.Payload is null || entry.Payload.Length == 0)
            throw new InvalidDataException("Tenant placement cache entry has an invalid revision or empty payload.");
        if (entry.Payload.Length > _options.MaxPayloadBytes)
            throw new InvalidDataException("Tenant placement cache entry exceeds the configured payload limit.");

        TenantPlacement? placement;
        try
        {
            placement = _serializer.Deserialize<TenantPlacement>(entry.Payload);
        }
        catch (JsonException exception)
        {
            throw new InvalidDataException("Tenant placement cache entry is not valid JSON.", exception);
        }
        catch (ArgumentException exception)
        {
            throw new InvalidDataException("Tenant placement cache entry violates placement invariants.", exception);
        }

        if (placement is null)
            throw new InvalidDataException("Tenant placement cache entry deserialized to null.");
        if (placement.TenantId != tenantId)
            throw new InvalidDataException("Tenant placement cache entry belongs to another organization.");
        if (placement.Version != entry.Version)
            throw new InvalidDataException("Tenant placement cache revision does not match its payload.");

        return placement;
    }

    private byte[] Serialize(TenantPlacement placement)
    {
        byte[] payload;
        try
        {
            payload = _serializer.Serialize(placement);
        }
        catch (Exception exception) when (exception is JsonException or ArgumentException)
        {
            throw new InvalidDataException("Tenant placement could not be serialized.", exception);
        }

        if (payload is null || payload.Length == 0)
            throw new InvalidDataException("Tenant placement serializer returned an empty payload.");
        if (payload.Length > _options.MaxPayloadBytes)
            throw new InvalidDataException("Tenant placement exceeds the configured payload limit.");

        return payload.ToArray();
    }

    private string BuildKey(Guid tenantId)
        => $"{_options.KeyPrefix}:{KeyNamespace}:{tenantId:N}";

    private static void ValidateTenantId(Guid tenantId)
    {
        if (tenantId == Guid.Empty)
            throw new ArgumentException("Organization identity must not be empty.", nameof(tenantId));
    }

    // Exception filters must not throw: CLR discards exceptions raised while evaluating a filter.
    private static bool IsUnavailable(Exception exception)
        => exception is TenantPlacementCacheUnavailableException or RedisTimeoutException or SocketException
            || exception is RedisConnectionException
            {
                FailureType: ConnectionFailureType.UnableToConnect
                    or ConnectionFailureType.UnableToResolvePhysicalConnection
                    or ConnectionFailureType.SocketFailure or ConnectionFailureType.SocketClosed
                    or ConnectionFailureType.Loading
            };
}
