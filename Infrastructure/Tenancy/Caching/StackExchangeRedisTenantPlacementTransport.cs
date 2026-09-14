using System.Globalization;
using Application.Tenancy;
using StackExchange.Redis;

namespace Infrastructure.Tenancy.Caching;

/// <summary>StackExchange.Redis transport with one hash record per organization placement.</summary>
/// <remarks>
/// The Lua compare-and-set compares the stored revision and sets the payload and expiry in one
/// server-side operation. All writes demand the primary. Redis is still only a cache; the durable
/// catalog owns lifecycle and placement truth.
/// A timeout/cancellation bounds the caller's wait, not execution of an already queued Redis command.
/// Deletion/expiry also removes the revision: callers must not use this cache as a relocation fence.
/// </remarks>
public sealed class StackExchangeRedisTenantPlacementTransport : IRedisTenantPlacementTransport
{
    private const string VersionField = "version";
    private const string PayloadField = "payload";
    private const string SetIfNewerScript = """
        local function validRevision(value)
            return type(value) == 'string'
                and string.match(value, '^[1-9][0-9]*$') ~= nil
                and (#value < 19 or (#value == 19 and value <= '9223372036854775807'))
        end
        -- Never convert revisions to Lua numbers: adjacent Int64 revisions above 2^53
        -- cannot be represented exactly. Canonical decimals compare by length then text.
        if not validRevision(ARGV[1]) or #ARGV[2] == 0 then return -1 end
        local keyType = redis.call('TYPE', KEYS[1]).ok
        if keyType ~= 'none' then
            if keyType ~= 'hash' or redis.call('HLEN', KEYS[1]) ~= 2 then return -1 end
            local stored = redis.call('HMGET', KEYS[1], 'version', 'payload')
            local current = stored[1]
            if not validRevision(current) or not stored[2] or #stored[2] == 0 then return -1 end
            if current == ARGV[1] then
                if stored[2] ~= ARGV[2] then return -2 end
                return 0
            end
            if #current > #ARGV[1] or (#current == #ARGV[1] and current > ARGV[1]) then return 0 end
        end
        -- Unix milliseconds are within Lua's exact integer range for DateTimeOffset values.
        -- Check Redis time so a command delayed in the client queue cannot publish expired data.
        local now = redis.call('TIME')
        local nowMilliseconds = tonumber(now[1]) * 1000 + math.floor(tonumber(now[2]) / 1000)
        if tonumber(ARGV[3]) <= nowMilliseconds then return 0 end
        redis.call('HSET', KEYS[1], 'version', ARGV[1], 'payload', ARGV[2])
        redis.call('PEXPIREAT', KEYS[1], ARGV[3])
        return 1
        """;

    private readonly IDatabase _database;
    private readonly TimeProvider _timeProvider;
    private readonly TimeSpan _commandTimeout;

    /// <summary>Uses the selected logical Redis database; construction does not contact Redis.</summary>
    public StackExchangeRedisTenantPlacementTransport(
        IConnectionMultiplexer connectionMultiplexer,
        TimeProvider timeProvider,
        int database = -1,
        TimeSpan? commandTimeout = null)
    {
        ArgumentNullException.ThrowIfNull(connectionMultiplexer);
        ArgumentNullException.ThrowIfNull(timeProvider);
        if (database < -1)
            throw new ArgumentOutOfRangeException(nameof(database));
        var timeout = commandTimeout ?? TimeSpan.FromSeconds(2);
        if (timeout <= TimeSpan.Zero || timeout > TimeSpan.FromMinutes(1))
            throw new ArgumentOutOfRangeException(nameof(commandTimeout), "Redis command timeout must be positive and at most one minute.");

        _database = connectionMultiplexer.GetDatabase(database);
        _timeProvider = timeProvider;
        _commandTimeout = timeout;
    }

    /// <inheritdoc />
    public async Task<RedisTenantPlacementEntry?> GetAsync(string key, CancellationToken cancellationToken)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(key);
        cancellationToken.ThrowIfCancellationRequested();

        // Placement reads must observe the primary. A replica can lag a successful newer write and
        // return an apparently valid but stale route, which is unsafe during a tenant move.
        var values = await WaitForCommandAsync(_database.HashGetAsync(
            key, [VersionField, PayloadField], CommandFlags.DemandMaster), cancellationToken).ConfigureAwait(false);
        cancellationToken.ThrowIfCancellationRequested();

        if (values is null || values.Length != 2)
            throw new InvalidDataException("Redis tenant placement returned an invalid hash response.");

        var hasVersion = values[0].HasValue;
        var hasPayload = values[1].HasValue;
        if (!hasVersion && !hasPayload)
            return null;
        var revision = values[0].ToString();
        if (!hasVersion || !hasPayload ||
            !long.TryParse(revision, NumberStyles.None, CultureInfo.InvariantCulture, out var version) ||
            version <= 0 || !string.Equals(revision, version.ToString(CultureInfo.InvariantCulture), StringComparison.Ordinal))
            throw new InvalidDataException("Redis tenant placement hash is incomplete or has an invalid revision.");

        var payload = (byte[]?)values[1];
        if (payload is null || payload.Length == 0)
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

        var expirationMilliseconds = expiresAtUtc.ToUnixTimeMilliseconds();
        if (expirationMilliseconds <= _timeProvider.GetUtcNow().ToUnixTimeMilliseconds())
            throw new ArgumentOutOfRangeException(nameof(expiresAtUtc), "Redis entry expiration must be in the future.");

        var result = await WaitForCommandAsync(_database.ScriptEvaluateAsync(
            SetIfNewerScript,
            [new RedisKey(key)],
            new RedisValue[] { entry.Version.ToString(CultureInfo.InvariantCulture), entry.Payload, expirationMilliseconds },
            CommandFlags.DemandMaster), cancellationToken).ConfigureAwait(false);
        cancellationToken.ThrowIfCancellationRequested();

        var code = (int)result;
        return code switch
        {
            1 => true,
            0 => false,
            -1 => throw new InvalidDataException("Redis tenant placement hash has an invalid shape, revision, or payload."),
            -2 => throw new InvalidDataException("Redis tenant placement revision has conflicting payloads."),
            _ => throw new InvalidDataException("Redis tenant placement compare-and-set returned an unknown result.")
        };
    }

    /// <inheritdoc />
    public async Task RemoveAsync(string key, CancellationToken cancellationToken)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(key);
        cancellationToken.ThrowIfCancellationRequested();
        _ = await WaitForCommandAsync(_database.KeyDeleteAsync(key, CommandFlags.DemandMaster), cancellationToken).ConfigureAwait(false);
        cancellationToken.ThrowIfCancellationRequested();
    }

    private async Task<T> WaitForCommandAsync<T>(Task<T> command, CancellationToken cancellationToken)
    {
        // A separate timeout token identifies this boundary's timeout without classifying arbitrary
        // TimeoutExceptions from dependencies as cache outages. WaitAsync does not cancel Redis I/O.
        using var timeout = new CancellationTokenSource(_commandTimeout);
        using var waitCancellation = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, timeout.Token);
        try
        {
            return await command.WaitAsync(waitCancellation.Token).ConfigureAwait(false);
        }
        catch (OperationCanceledException) when (timeout.IsCancellationRequested)
        {
            cancellationToken.ThrowIfCancellationRequested();
            throw new TenantPlacementCacheUnavailableException(new TimeoutException("Redis tenant placement command exceeded its wait budget."));
        }
    }
}
