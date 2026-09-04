using Application.Interfaces;
using Application.Models;
using Infrastructure.Caching.Keys;
using Infrastructure.Caching.Options;
using Infrastructure.Caching.Serialization;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using StackExchange.Redis;

namespace Infrastructure.Caching.Services;

/// <summary>
/// Redis-backed <see cref="ICacheService"/>. Get/Set/Remove/expiration go through <see cref="IDistributedCache"/>
/// (Microsoft.Extensions.Caching.StackExchangeRedis), which natively supports sliding expiration on Redis.
/// Pattern-based invalidation uses the shared <see cref="IConnectionMultiplexer"/> directly since
/// IDistributedCache has no key-enumeration API.
/// </summary>
internal sealed class RedisCacheService(
    IDistributedCache distributedCache,
    IConnectionMultiplexer connectionMultiplexer,
    ICacheSerializer serializer,
    ICacheKeyGenerator keyGenerator,
    IOptions<CachingOptions> options,
    ILogger<RedisCacheService> logger) : ICacheService
{
    private readonly IDistributedCache _distributedCache = distributedCache;
    private readonly IConnectionMultiplexer _connectionMultiplexer = connectionMultiplexer;
    private readonly ICacheSerializer _serializer = serializer;
    private readonly ICacheKeyGenerator _keyGenerator = keyGenerator;
    private readonly CachingOptions _options = options.Value;
    private readonly ILogger<RedisCacheService> _logger = logger;

    // Key-level locks only protect against races within this process; Redis itself is the cross-process
    // source of truth, so a duplicate factory invocation across instances is possible but harmless (last write wins).
    private readonly Dictionary<string, SemaphoreSlim> _keyLocks = new(StringComparer.Ordinal);
    private readonly Lock _keyLockGuard = new();

    public async Task<T?> GetAsync<T>(string key, CancellationToken cancellationToken = default)
    {
        var (_, value) = await TryGetValueAsync<T>(key, cancellationToken).ConfigureAwait(false);
        return value;
    }

    public Task SetAsync<T>(string key, T value, CacheEntryOptions? options = null, CancellationToken cancellationToken = default)
    {
        var bytes = _serializer.Serialize(value);
        return _distributedCache.SetAsync(NormalizeKey(key), bytes, ResolveOptions(options), cancellationToken);
    }

    public Task RemoveAsync(string key, CancellationToken cancellationToken = default)
        => _distributedCache.RemoveAsync(NormalizeKey(key), cancellationToken);

    public async Task<T> GetOrCreateAsync<T>(
        string key,
        Func<CancellationToken, Task<T>> factory,
        CacheEntryOptions? options = null,
        CancellationToken cancellationToken = default)
    {
        var (found, cached) = await TryGetValueAsync<T>(key, cancellationToken).ConfigureAwait(false);
        if (found)
            return cached!;

        var semaphore = GetOrCreateKeySemaphore(key);
        await semaphore.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            (found, cached) = await TryGetValueAsync<T>(key, cancellationToken).ConfigureAwait(false);
            if (found)
                return cached!;

            var value = await factory(cancellationToken).ConfigureAwait(false);
            await SetAsync(key, value, options, cancellationToken).ConfigureAwait(false);
            return value;
        }
        finally
        {
            semaphore.Release();
            TryReleaseKeySemaphore(key, semaphore);
        }
    }

    /// <summary>
    /// Reads and deserializes a value, distinguishing "not found" from "found with the type's default value".
    /// Checking nullability on the raw <c>byte[]</c> payload (always a reference type) avoids the pitfall of an
    /// unconstrained <c>T?</c> erasing to plain <c>T</c> for value types, where <c>default(int)</c> would otherwise
    /// be indistinguishable from a genuinely missing key.
    /// </summary>
    private async Task<(bool Found, T? Value)> TryGetValueAsync<T>(string key, CancellationToken cancellationToken)
    {
        var bytes = await _distributedCache.GetAsync(NormalizeKey(key), cancellationToken).ConfigureAwait(false);
        return bytes is null ? (false, default) : (true, _serializer.Deserialize<T>(bytes));
    }

    public async Task<IReadOnlyDictionary<string, T?>> GetManyAsync<T>(IEnumerable<string> keys, CancellationToken cancellationToken = default)
    {
        var materializedKeys = keys.Distinct(StringComparer.Ordinal).ToArray();
        var results = new Dictionary<string, T?>(materializedKeys.Length, StringComparer.Ordinal);

        foreach (var key in materializedKeys)
        {
            cancellationToken.ThrowIfCancellationRequested();
            results[key] = await GetAsync<T>(key, cancellationToken).ConfigureAwait(false);
        }

        return results;
    }

    public async Task SetManyAsync<T>(
        IReadOnlyDictionary<string, T> entries,
        CacheEntryOptions? options = null,
        CancellationToken cancellationToken = default)
    {
        foreach (var (key, value) in entries)
        {
            cancellationToken.ThrowIfCancellationRequested();
            await SetAsync(key, value, options, cancellationToken).ConfigureAwait(false);
        }
    }

    public async Task RemoveManyAsync(IEnumerable<string> keys, CancellationToken cancellationToken = default)
    {
        foreach (var key in keys.Distinct(StringComparer.Ordinal))
        {
            cancellationToken.ThrowIfCancellationRequested();
            await RemoveAsync(key, cancellationToken).ConfigureAwait(false);
        }
    }

    /// <summary>
    /// Removes all cache keys matching <paramref name="pattern"/> (must end with ":*") by scanning Redis
    /// via SCAN (non-blocking, cursor based) and deleting each matched key.
    /// </summary>
    public async Task RemoveByPatternAsync(string pattern, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var normalizedPattern = NormalizeKey(pattern);
        if (!normalizedPattern.EndsWith(":*", StringComparison.Ordinal))
        {
            _logger.LogWarning("Pattern '{Pattern}' does not end with ':*'. Treating as exact key removal.", pattern);
            await RemoveAsync(pattern, cancellationToken).ConfigureAwait(false);
            return;
        }

        var physicalPattern = $"{_options.Redis.InstanceName}{normalizedPattern}";
        var database = _connectionMultiplexer.GetDatabase();
        var removedCount = 0;

        foreach (var endpoint in _connectionMultiplexer.GetEndPoints())
        {
            var server = _connectionMultiplexer.GetServer(endpoint);
            if (server.IsReplica)
                continue;

            await foreach (var physicalKey in server.KeysAsync(database.Database, physicalPattern).WithCancellation(cancellationToken))
            {
                await database.KeyDeleteAsync(physicalKey).ConfigureAwait(false);
                removedCount++;
            }
        }

        _logger.LogInformation("Invalidated {Count} Redis cache entries for pattern '{Pattern}'", removedCount, pattern);
    }

    private string NormalizeKey(string key) => _keyGenerator.Normalize(_options.KeyPrefix, key);

    private DistributedCacheEntryOptions ResolveOptions(CacheEntryOptions? options)
    {
        var effectiveAbsoluteSeconds = options?.AbsoluteExpirationRelativeToNow?.TotalSeconds
            ?? _options.DefaultAbsoluteExpirationSeconds;
        var effectiveSlidingSeconds = options?.SlidingExpiration?.TotalSeconds
            ?? _options.DefaultSlidingExpirationSeconds;

        var entryOptions = new DistributedCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = TimeSpan.FromSeconds(effectiveAbsoluteSeconds)
        };

        if (effectiveSlidingSeconds is > 0)
            entryOptions.SlidingExpiration = TimeSpan.FromSeconds(effectiveSlidingSeconds.Value);

        return entryOptions;
    }

    private SemaphoreSlim GetOrCreateKeySemaphore(string key)
    {
        var normalizedKey = NormalizeKey(key);
        lock (_keyLockGuard)
        {
            if (_keyLocks.TryGetValue(normalizedKey, out var existing))
                return existing;

            var created = new SemaphoreSlim(1, 1);
            _keyLocks[normalizedKey] = created;
            return created;
        }
    }

    private void TryReleaseKeySemaphore(string key, SemaphoreSlim semaphore)
    {
        if (semaphore.CurrentCount == 0)
            return;

        var normalizedKey = NormalizeKey(key);
        lock (_keyLockGuard)
        {
            if (_keyLocks.TryGetValue(normalizedKey, out var current) && ReferenceEquals(current, semaphore))
                _keyLocks.Remove(normalizedKey);
        }
    }
}
