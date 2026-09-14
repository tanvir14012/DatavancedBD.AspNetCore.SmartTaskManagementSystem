using System.Globalization;
using Application.Tenancy;
using StackExchange.Redis;

namespace Infrastructure.Tenancy.Caching;

/// <summary>StackExchange.Redis transport with one hash record per organization placement.</summary>
/// <remarks>
/// The Lua compare-and-set compares the stored revision and sets the payload and expiry in one
/// server-side operation. All writes demand the primary. Redis is still only a cache; the durable
/// catalog owns lifecycle and placement truth.
/// </remarks>
public sealed class StackExchangeRedisTenantPlacementTransport : IRedisTenantPlacementTransport
{
    private const string VersionField = "version";
    private const string PayloadField = "payload";
    private const string SetIfNewerScript = """
        local current = redis.call('HGET', KEYS[1], 'version')
        if current then
            local currentVersion = tonumber(current)
            if not currentVersion then return -1 end
            if currentVersion >= tonumber(ARGV[1]) then return 0 end
        end
        redis.call('HSET', KEYS[1], 'version', ARGV[1], 'payload', ARGV[2])
        redis.call('EXPIRE', KEYS[1], ARGV[3])
        return 1
        """;

    private readonly IDatabase _database;
    private readonly TimeProvider _timeProvider;

    /// <summary>Uses the selected logical Redis database; construction does not contact Redis.</summary>
    public StackExchangeRedisTenantPlacementTransport(
        IConnectionMultiplexer connectionMultiplexer,
        TimeProvider timeProvider,
        int database = -1)
    {
        ArgumentNullException.ThrowIfNull(connectionMultiplexer);
        ArgumentNullException.ThrowIfNull(timeProvider);
        if (database < -1)
            throw new ArgumentOutOfRangeException(nameof(database));

        _database = connectionMultiplexer.GetDatabase(database);
        _timeProvider = timeProvider;
    }

    /// <inheritdoc />
    public async Task<RedisTenantPlacementEntry?> GetAsync(string key, CancellationToken cancellationToken)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(key);
        cancellationToken.ThrowIfCancellationRequested();

        // Placement reads must observe the primary. A replica can lag a successful newer write and
        // return an apparently valid but stale route, which is unsafe during a tenant move.
        var values = await _database.HashGetAsync(
            key, [VersionField, PayloadField], CommandFlags.DemandMaster).WaitAsync(cancellationToken).ConfigureAwait(false);
        cancellationToken.ThrowIfCancellationRequested();

        var hasVersion = values[0].HasValue;
        var hasPayload = values[1].HasValue;
        if (!hasVersion && !hasPayload)
            return null;
        if (!hasVersion || !hasPayload || !long.TryParse(values[0].ToString(), NumberStyles.None, CultureInfo.InvariantCulture, out var version))
            throw new InvalidDataException("Redis tenant placement hash is incomplete or has an invalid revision.");

        var payload = (byte[]?)values[1];
        if (payload is null)
            throw new InvalidDataException("Redis tenant placement hash has no payload.");

        return new(version, payload);
    }

    /// <inheritdoc />
    public async Task<bool> SetIfNewerAsync(
        string key,
        RedisTenantPlacementEntry entry,
        DateTimeOffset expiresAtUtc,
        CancellationToken cancellationToken)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(key);
        ArgumentNullException.ThrowIfNull(entry);
        cancellationToken.ThrowIfCancellationRequested();
        if (entry.Version <= 0 || entry.Payload is null || entry.Payload.Length == 0)
            throw new InvalidDataException("Redis tenant placement entry must have a positive revision and payload.");

        var remaining = expiresAtUtc - _timeProvider.GetUtcNow();
        var ttlSeconds = (long)Math.Ceiling(remaining.TotalSeconds);
        if (ttlSeconds <= 0)
            throw new ArgumentOutOfRangeException(nameof(expiresAtUtc), "Redis entry expiration must be in the future.");

        var result = await _database.ScriptEvaluateAsync(
            SetIfNewerScript,
            [new RedisKey(key)],
            new RedisValue[] { entry.Version, entry.Payload, ttlSeconds },
            CommandFlags.DemandMaster).WaitAsync(cancellationToken).ConfigureAwait(false);
        cancellationToken.ThrowIfCancellationRequested();

        var code = (int)result;
        return code switch
        {
            1 => true,
            0 => false,
            -1 => throw new InvalidDataException("Redis tenant placement hash contains an invalid revision."),
            _ => throw new InvalidDataException("Redis tenant placement compare-and-set returned an unknown result.")
        };
    }

    /// <inheritdoc />
    public async Task RemoveAsync(string key, CancellationToken cancellationToken)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(key);
        cancellationToken.ThrowIfCancellationRequested();
        _ = await _database.KeyDeleteAsync(key, CommandFlags.DemandMaster).WaitAsync(cancellationToken).ConfigureAwait(false);
        cancellationToken.ThrowIfCancellationRequested();
    }
}
