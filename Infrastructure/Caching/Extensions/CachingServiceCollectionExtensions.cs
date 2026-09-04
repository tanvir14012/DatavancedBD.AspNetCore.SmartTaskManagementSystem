using Application.Interfaces;
using Infrastructure.Caching.Keys;
using Infrastructure.Caching.Options;
using Infrastructure.Caching.Serialization;
using Infrastructure.Caching.Services;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Caching.StackExchangeRedis;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Options;
using StackExchange.Redis;

namespace Infrastructure.Caching.Extensions;

public static class CachingServiceCollectionExtensions
{
    public static IServiceCollection AddCaching(
        this IServiceCollection services,
        IConfiguration? configuration = null)
    {
        services.AddOptions<CachingOptions>();
        if (configuration is not null)
            services.Configure<CachingOptions>(configuration.GetSection(CachingOptions.SectionName));

        services.PostConfigure<CachingOptions>(options =>
        {
            options.KeyPrefix = string.IsNullOrWhiteSpace(options.KeyPrefix) ? "stms" : options.KeyPrefix;
            options.DefaultAbsoluteExpirationSeconds = options.DefaultAbsoluteExpirationSeconds <= 0
                ? 300
                : options.DefaultAbsoluteExpirationSeconds;
            options.CompressionThresholdBytes = options.CompressionThresholdBytes <= 0
                ? 1024
                : options.CompressionThresholdBytes;
            options.Redis.ConnectionString = string.IsNullOrWhiteSpace(options.Redis.ConnectionString)
                ? "localhost:6379"
                : options.Redis.ConnectionString;
        });

        services.TryAddSingleton<ICacheSerializer, SystemTextJsonCacheSerializer>();
        services.TryAddSingleton<ICacheKeyGenerator, DefaultCacheKeyGenerator>();

        // Provider selection happens exactly once, here, at startup. Consumers only ever see ICacheService.
        var provider = configuration
            ?.GetSection(CachingOptions.SectionName)
            .GetValue<CacheProvider?>(nameof(CachingOptions.Provider))
            ?? CacheProvider.Memory;

        return provider switch
        {
            CacheProvider.Redis => services.AddRedisCacheProvider(),
            _ => services.AddMemoryCacheProvider()
        };
    }

    private static IServiceCollection AddMemoryCacheProvider(this IServiceCollection services)
    {
        services.AddMemoryCache();

        // Enforce a total size budget (LRU-oriented eviction) only when configured; entries opt in via Size in InMemoryCacheService.
        services.AddOptions<MemoryCacheOptions>()
            .Configure<IOptions<CachingOptions>>((memoryCacheOptions, cachingOptions) =>
            {
                if (cachingOptions.Value.Memory.SizeLimit is > 0 and var sizeLimit)
                    memoryCacheOptions.SizeLimit = sizeLimit;
            });

        services.TryAddSingleton<ICacheService, InMemoryCacheService>();
        return services;
    }

    private static IServiceCollection AddRedisCacheProvider(this IServiceCollection services)
    {
        // A single IConnectionMultiplexer is shared with IDistributedCache below to avoid opening a second connection.
        services.TryAddSingleton<IConnectionMultiplexer>(sp =>
        {
            var redis = sp.GetRequiredService<IOptions<CachingOptions>>().Value.Redis;
            var configurationOptions = ConfigurationOptions.Parse(redis.ConnectionString);
            configurationOptions.ConnectRetry = redis.ConnectRetry;
            configurationOptions.ConnectTimeout = redis.ConnectTimeoutMilliseconds;
            configurationOptions.SyncTimeout = redis.SyncTimeoutMilliseconds;
            configurationOptions.AbortOnConnectFail = false;
            return ConnectionMultiplexer.Connect(configurationOptions);
        });

        services.AddStackExchangeRedisCache(_ => { });
        services.AddOptions<RedisCacheOptions>()
            .Configure<IServiceProvider>((redisCacheOptions, sp) =>
            {
                redisCacheOptions.InstanceName = sp.GetRequiredService<IOptions<CachingOptions>>().Value.Redis.InstanceName;
                redisCacheOptions.ConnectionMultiplexerFactory = () =>
                    Task.FromResult(sp.GetRequiredService<IConnectionMultiplexer>());
            });

        services.TryAddSingleton<ICacheService, RedisCacheService>();
        return services;
    }
}
