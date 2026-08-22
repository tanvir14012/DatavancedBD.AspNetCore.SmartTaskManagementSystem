using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Infrastructure.Caching.Abstractions;
using Infrastructure.Caching.Models;
using Infrastructure.Data.EfCore.Options;

namespace Infrastructure.Data.EfCore.Extensions;

public static class EntityFrameworkQueryCachingExtensions
{
    public static Task<IReadOnlyList<TEntity>> CacheAsync<TEntity>(
        this IQueryable<TEntity> query,
        string cacheKey,
        TimeSpan? expiration = null,
        CancellationToken cancellationToken = default)
        where TEntity : class
    {
        var serviceProvider = GetServiceProvider(query);
        var cacheService = serviceProvider.GetRequiredService<ICacheService>();
        var options = serviceProvider.GetService<IOptions<EntityFrameworkCachingOptions>>()?.Value
            ?? new EntityFrameworkCachingOptions();

        var entryOptions = expiration is not null
            ? new CacheEntryOptions { AbsoluteExpirationRelativeToNow = expiration }
            : new CacheEntryOptions { AbsoluteExpirationRelativeToNow = TimeSpan.FromSeconds(options.DefaultExpirationSeconds) };

        return CacheAsync(
            query,
            cacheService,
            cacheKey,
            entryOptions,
            options.KeyNamespace,
            cancellationToken);
    }

    public static Task<IReadOnlyList<TEntity>> CacheAsync<TEntity>(
        this IQueryable<TEntity> query,
        ICacheService cacheService,
        string cacheKey,
        CacheEntryOptions? options = null,
        string keyNamespace = "ef",
        CancellationToken cancellationToken = default)
        where TEntity : class
    {
        var key = BuildEntityCacheKey<TEntity>(cacheKey, keyNamespace);
        return cacheService.GetOrCreateAsync(
            key,
            async token => (IReadOnlyList<TEntity>)await query.AsNoTracking().ToListAsync(token).ConfigureAwait(false),
            options,
            cancellationToken);
    }

    public static string BuildEntityCacheKey<TEntity>(string cacheKey, string keyNamespace = "ef")
    {
        if (string.IsNullOrWhiteSpace(cacheKey))
            throw new ArgumentException("Cache key is required.", nameof(cacheKey));

        var namespaceValue = string.IsNullOrWhiteSpace(keyNamespace) ? "ef" : keyNamespace.Trim();
        return $"{namespaceValue}:{typeof(TEntity).Name}:{cacheKey.Trim()}";
    }

    private static IServiceProvider GetServiceProvider<TEntity>(IQueryable<TEntity> query)
    {
        if (query.Provider is IInfrastructure<IServiceProvider> infrastructure)
            return infrastructure.Instance;

        throw new InvalidOperationException("Unable to resolve EF service provider for query Infrastructure.Caching.");
    }
}
