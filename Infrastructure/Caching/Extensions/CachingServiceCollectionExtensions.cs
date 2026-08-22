using Infrastructure.Caching.Abstractions;
using Infrastructure.Caching.Keys;
using Infrastructure.Caching.Options;
using Infrastructure.Caching.Serialization;
using Infrastructure.Caching.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

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
        });

        services.AddMemoryCache();

        services.TryAddSingleton<ICacheSerializer, SystemTextJsonCacheSerializer>();
        services.TryAddSingleton<ICacheKeyGenerator, DefaultCacheKeyGenerator>();
        services.TryAddSingleton<ICacheService, InMemoryCacheService>();

        return services;
    }
}
