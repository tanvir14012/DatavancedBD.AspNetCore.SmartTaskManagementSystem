using Application.Interfaces;
using Application.Models;
using Infrastructure.Caching.Keys;
using Infrastructure.Caching.Options;
using Infrastructure.Caching.Serialization;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Infrastructure.Caching.Services;

internal sealed class InMemoryCacheService(
    IMemoryCache memoryCache,
    ICacheSerializer serializer,
    ICacheKeyGenerator keyGenerator,
    IOptions<CachingOptions> options,
    ILogger<InMemoryCacheService> logger) : ICacheService
{
    private readonly IMemoryCache _memoryCache = memoryCache;
    private readonly ICacheSerializer _serializer = serializer;
    private readonly ICacheKeyGenerator _keyGenerator = keyGenerator;
    private readonly CachingOptions _options = options.Value;
    private readonly ILogger<InMemoryCacheService> _logger = logger;

    // Locks for key-level concurrency
    private readonly Dictionary<string, SemaphoreSlim> _keyLocks = new(StringComparer.Ordinal);
    private readonly Lock _keyLockGuard = new();

    // Category → Set of normalized cache keys
    private readonly Dictionary<string, HashSet<string>> _categoryKeys = new(StringComparer.Ordinal);
    private readonly Lock _categoryLockGuard = new();

    // ─── Public Interface ──────────────────────────────────────────────────────

    public async Task<T?> GetAsync<T>(string key, CancellationToken cancellationToken = default)
    {
        var result = TryGetValue<T>(key);
        return result.Value;
    }

    public Task SetAsync<T>(string key, T value, CacheEntryOptions? options = null, CancellationToken cancellationToken = default)
    {
        var normalizedKey = NormalizeKey(key);
        var effectiveOptions = ResolveOptions(options);

        StoreInCache(normalizedKey, value, effectiveOptions);
        RegisterCategory(normalizedKey);          // <-- Track category

        return Task.CompletedTask;
    }

    public Task RemoveAsync(string key, CancellationToken cancellationToken = default)
    {
        var normalizedKey = NormalizeKey(key);
        _memoryCache.Remove(normalizedKey);
        UnregisterCategory(normalizedKey);        // <-- Remove from category index

        return Task.CompletedTask;
    }

    public async Task<T> GetOrCreateAsync<T>(
        string key,
        Func<CancellationToken, Task<T>> factory,
        CacheEntryOptions? options = null,
        CancellationToken cancellationToken = default)
    {
        var cachedResult = TryGetValue<T>(key);
        if (cachedResult.Found)
            return cachedResult.Value!;

        var semaphore = GetOrCreateKeySemaphore(key);
        await semaphore.WaitAsync(cancellationToken);
        try
        {
            cachedResult = TryGetValue<T>(key);
            if (cachedResult.Found)
                return cachedResult.Value!;

            var value = await factory(cancellationToken);
            await SetAsync(key, value, options, cancellationToken);
            return value;
        }
        finally
        {
            semaphore.Release();
            TryReleaseKeySemaphore(key, semaphore);
        }
    }

    public async Task<IReadOnlyDictionary<string, T?>> GetManyAsync<T>(IEnumerable<string> keys, CancellationToken cancellationToken = default)
    {
        var materializedKeys = keys.Distinct(StringComparer.Ordinal).ToArray();
        var results = new Dictionary<string, T?>(materializedKeys.Length, StringComparer.Ordinal);

        foreach (var key in materializedKeys)
        {
            cancellationToken.ThrowIfCancellationRequested();
            results[key] = await GetAsync<T>(key, cancellationToken);
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
            await SetAsync(key, value, options, cancellationToken);
        }
    }

    public async Task RemoveManyAsync(IEnumerable<string> keys, CancellationToken cancellationToken = default)
    {
        foreach (var key in keys.Distinct(StringComparer.Ordinal))
        {
            cancellationToken.ThrowIfCancellationRequested();
            await RemoveAsync(key, cancellationToken);
        }
    }

    /// <summary>
    /// Removes all cache keys that match a pattern. The pattern must be in the form:
    /// <c>"{KeyPrefix}:{category}:*"</c> (e.g., "MyApp:Product:*").
    /// The trailing "*" is required and indicates a category‑wide invalidation.
    /// </summary>
    public async Task RemoveByPatternAsync(string pattern, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        // Normalize pattern (prefix added if not present)
        var normalizedPattern = NormalizeKey(pattern);

        // The pattern should end with ":*" – extract the category
        if (!normalizedPattern.EndsWith(":*", StringComparison.Ordinal))
        {
            _logger.LogWarning("Pattern '{Pattern}' does not end with ':*'. Treating as exact key removal.", pattern);
            await RemoveAsync(pattern, cancellationToken);
            return;
        }

        var category = normalizedPattern[..^2]; // Remove trailing ":*"
        var keysToRemove = GetKeysForCategory(category);

        if (keysToRemove.Count == 0)
        {
            _logger.LogDebug("No cache keys found for category '{Category}'", category);
            return;
        }

        _logger.LogInformation("Invalidating {Count} cache entries for category '{Category}'", keysToRemove.Count, category);

        await RemoveManyAsync(keysToRemove, cancellationToken);
        // The category set will be cleared when each key is removed individually
    }

    // ─── Private Helpers ──────────────────────────────────────────────────────

    private string NormalizeKey(string key)
    {
        var builtKey = _keyGenerator.Build(key);
        return _keyGenerator.Build(_options.KeyPrefix, builtKey);
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

    private (bool Found, T? Value) TryGetValue<T>(string key)
    {
        var normalizedKey = NormalizeKey(key);

        if (_memoryCache.TryGetValue(normalizedKey, out CacheValue<T>? cachedValue) && cachedValue is not null)
            return (cachedValue.HasValue, cachedValue.Value);

        return (false, default);
    }

    private void StoreInCache<T>(string normalizedKey, T? value, MemoryCacheEntryOptions options)
    {
        _memoryCache.Set(normalizedKey, new CacheValue<T>(true, value), options);
    }

    private MemoryCacheEntryOptions ResolveOptions(CacheEntryOptions? options)
    {
        var effectiveAbsoluteSeconds = options?.AbsoluteExpirationRelativeToNow?.TotalSeconds
            ?? _options.DefaultAbsoluteExpirationSeconds;
        var effectiveSlidingSeconds = options?.SlidingExpiration?.TotalSeconds
            ?? _options.DefaultSlidingExpirationSeconds;

        var memoryOptions = new MemoryCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = TimeSpan.FromSeconds(effectiveAbsoluteSeconds)
        };

        if (effectiveSlidingSeconds is > 0)
            memoryOptions.SlidingExpiration = TimeSpan.FromSeconds(effectiveSlidingSeconds.Value);

        return memoryOptions;
    }

    // ─── Category Index Management ────────────────────────────────────────────

    private string? ExtractCategory(string normalizedKey)
    {
        // Expects format: "{KeyPrefix}:{category}:{rest}"
        // We split and take the segment after the prefix.
        var parts = normalizedKey.Split(':');
        if (parts.Length >= 3 && parts[0] == _options.KeyPrefix)
            return parts[1];

        // If the key doesn't start with the prefix, we can't extract a category.
        return null;
    }

    private void RegisterCategory(string normalizedKey)
    {
        var category = ExtractCategory(normalizedKey);
        if (string.IsNullOrEmpty(category))
            return;

        lock (_categoryLockGuard)
        {
            if (!_categoryKeys.TryGetValue(category, out var keys))
            {
                keys = new HashSet<string>(StringComparer.Ordinal);
                _categoryKeys[category] = keys;
            }
            keys.Add(normalizedKey);
        }
    }

    private void UnregisterCategory(string normalizedKey)
    {
        var category = ExtractCategory(normalizedKey);
        if (string.IsNullOrEmpty(category))
            return;

        lock (_categoryLockGuard)
        {
            if (_categoryKeys.TryGetValue(category, out var keys))
            {
                keys.Remove(normalizedKey);
                if (keys.Count == 0)
                    _categoryKeys.Remove(category);
            }
        }
    }

    private IReadOnlyCollection<string> GetKeysForCategory(string category)
    {
        lock (_categoryLockGuard)
        {
            return _categoryKeys.TryGetValue(category, out var keys)
                ? keys.ToList().AsReadOnly()
                : Array.Empty<string>();
        }
    }

    private sealed record CacheValue<T>(bool HasValue, T? Value);
}
