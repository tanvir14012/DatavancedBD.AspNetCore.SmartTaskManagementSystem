using Infrastructure.Tenancy.Caching;
using Application.Tenancy;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Options;
using StackExchange.Redis;

namespace Infrastructure.Tenancy.Catalog;

/// <summary>Composes the tenant catalog providers from external deployment configuration.</summary>
/// <remarks>
/// No tenant placement, credential, endpoint or connection is created at registration time. A SQL
/// catalog remains authoritative; Redis is a disposable cache. Call this from an explicit composition
/// root only after the deployment has supplied the four external sections.
/// </remarks>
public static class TenantCatalogServiceCollectionExtensions
{
    /// <summary>Registers durable catalog, Redis cache and cache-first decorators idempotently.</summary>
    public static IServiceCollection AddTenantCatalog(this IServiceCollection services, IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentNullException.ThrowIfNull(configuration);

        services.AddOptions<SqlTenantCatalogConnectionOptions>()
            .Bind(configuration.GetSection(SqlTenantCatalogConnectionOptions.SectionName));
        services.AddOptions<TenantCatalogReadOptions>()
            .Bind(configuration.GetSection(TenantCatalogReadOptions.SectionName));
        services.AddOptions<TenantPlacementCacheOptions>()
            .Bind(configuration.GetSection(TenantPlacementCacheOptions.SectionName));
        services.AddOptions<TenantPlacementRedisOptions>()
            .Bind(configuration.GetSection(TenantPlacementRedisOptions.SectionName));

        services.TryAddSingleton<ITenantCatalogConnectionFactory, SqlTenantCatalogConnectionFactory>();
        services.TryAddSingleton(TimeProvider.System);
        services.TryAddSingleton<IAuthoritativeTenantCatalog, AzureSqlTenantCatalog>();
        services.TryAddSingleton<AzureSqlTenantCatalogWriter>();
        services.TryAddSingleton<ITenantCatalogWriter>(provider => new CachedTenantCatalogWriter(
            provider.GetRequiredService<AzureSqlTenantCatalogWriter>(),
            provider.GetRequiredService<ITenantPlacementCache>(),
            provider.GetRequiredService<Microsoft.Extensions.Logging.ILogger<CachedTenantCatalogWriter>>()));

        services.TryAddSingleton<TenantPlacementRedisConnection>();
        services.TryAddSingleton<IRedisTenantPlacementTransport>(provider =>
        {
            var connection = provider.GetRequiredService<TenantPlacementRedisConnection>();
            var options = provider.GetRequiredService<IOptions<TenantPlacementRedisOptions>>().Value;
            return new StackExchangeRedisTenantPlacementTransport(
                connection.Multiplexer,
                TimeProvider.System,
                options.Database,
                TimeSpan.FromMilliseconds(options.CommandTimeoutMilliseconds));
        });
        services.TryAddSingleton<ITenantPlacementSerializer, JsonTenantPlacementSerializer>();
        services.TryAddSingleton<ITenantPlacementCache, RedisTenantPlacementCache>();
        services.TryAddSingleton<ITenantCatalog>(provider => new CachedTenantCatalog(
            provider.GetRequiredService<IAuthoritativeTenantCatalog>(),
            provider.GetRequiredService<ITenantPlacementCache>(),
            provider.GetRequiredService<Microsoft.Extensions.Logging.ILogger<CachedTenantCatalog>>()));
        return services;
    }
}
