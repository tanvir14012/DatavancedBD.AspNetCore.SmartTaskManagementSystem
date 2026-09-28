using Application.Models;

namespace Application.Interfaces;

/// <summary>Asynchronous cache operations with caller-controlled keys and cancellation.</summary>
public interface ICacheService
{
    /// <summary>Get async<t> for this application interfaces contract.</summary>
    Task<T?> GetAsync<T>(string key, CancellationToken cancellationToken = default);
    /// <summary>Set async<t> for this application interfaces contract.</summary>
    Task SetAsync<T>(string key, T value, CacheEntryOptions? options = null, CancellationToken cancellationToken = default);
    /// <summary>Removes the specified cache entry.</summary>
    Task RemoveAsync(string key, CancellationToken cancellationToken = default);
    /// <summary>Get or create async<t> for this application interfaces contract.</summary>
    Task<T> GetOrCreateAsync<T>(
        string key,
        Func<CancellationToken, Task<T>> factory,
        CacheEntryOptions? options = null,
        CancellationToken cancellationToken = default);
    /// <summary>Get many async<t> for this application interfaces contract.</summary>
    Task<IReadOnlyDictionary<string, T?>> GetManyAsync<T>(IEnumerable<string> keys, CancellationToken cancellationToken = default);
    /// <summary>Set many async<t> for this application interfaces contract.</summary>
    Task SetManyAsync<T>(
        IReadOnlyDictionary<string, T> entries,
        CacheEntryOptions? options = null,
        CancellationToken cancellationToken = default);
    /// <summary>Removes the supplied cache keys.</summary>
    Task RemoveManyAsync(IEnumerable<string> keys, CancellationToken cancellationToken = default);

    /// <summary>Removes entries matching the supplied tenant-scoped pattern.</summary>
    Task RemoveByPatternAsync(string pattern, CancellationToken cancellationToken = default);
}
