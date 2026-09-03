using Infrastructure.Caching.Abstractions;
using Infrastructure.Caching.Keys;
using Infrastructure.Caching.Middlewears;
using Infrastructure.Caching.Options;
using Infrastructure.Caching.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace Infrastructure.Caching.Extensions;

public static class HttpResponseCachingServiceCollectionExtensions
{
    public static IServiceCollection AddHttpResponseCaching(
        this IServiceCollection services,
        IConfiguration? configuration = null)
    {
        services.AddOptions<HttpResponseCachingOptions>();
        if (configuration is not null)
            services.Configure<HttpResponseCachingOptions>(configuration.GetSection(HttpResponseCachingOptions.SectionName));

        services.PostConfigure<HttpResponseCachingOptions>(options =>
        {
            options.KeyNamespace = string.IsNullOrWhiteSpace(options.KeyNamespace) ? "http" : options.KeyNamespace;
            options.DefaultDurationSeconds = options.DefaultDurationSeconds <= 0 ? 60 : options.DefaultDurationSeconds;
            options.VaryByHeaders = options.VaryByHeaders
                .Where(static header => !string.IsNullOrWhiteSpace(header))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToArray();
        });

        services.TryAddSingleton<HttpResponseCachingMiddleware>();
        services.TryAddSingleton<IHttpResponseCacheKeyBuilder, HttpResponseCacheKeyBuilder>();
        services.TryAddSingleton<IHttpResponseCacheInvalidator, HttpResponseCacheInvalidator>();
        return services;
    }
}
