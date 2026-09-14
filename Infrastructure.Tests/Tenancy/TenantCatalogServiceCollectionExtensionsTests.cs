using Infrastructure.Tenancy.Caching;
using Infrastructure.Tenancy.Catalog;
using Application.Tenancy;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using StackExchange.Redis;

namespace Infrastructure.Tests.Tenancy;

public sealed class TenantCatalogServiceCollectionExtensionsTests
{
    [Fact]
    public void Binds_only_external_sections_and_registers_lazy_provider_graph()
    {
        var configuration = Configuration(new Dictionary<string, string?>
        {
            [$"{SqlTenantCatalogConnectionOptions.SectionName}:ConnectionString"] = "Server=catalog;Database=control;Integrated Security=true",
            [$"{SqlTenantCatalogConnectionOptions.SectionName}:ConnectTimeoutSeconds"] = "9",
            [$"{SqlTenantCatalogConnectionOptions.SectionName}:MaxPoolSize"] = "23",
            [$"{TenantCatalogReadOptions.SectionName}:CommandTimeoutSeconds"] = "8",
            [$"{TenantCatalogReadOptions.SectionName}:LookupTimeoutSeconds"] = "12",
            [$"{TenantPlacementCacheOptions.SectionName}:KeyPrefix"] = "stms:qa",
            [$"{TenantPlacementRedisOptions.SectionName}:ConnectionString"] = "redis.internal:6380,ssl=true,password=secret-reference",
            [$"{TenantPlacementRedisOptions.SectionName}:Database"] = "4",
            [$"{TenantPlacementRedisOptions.SectionName}:CommandTimeoutMilliseconds"] = "1800"
        });
        var services = new ServiceCollection().AddLogging().AddTenantCatalog(configuration);
        services.AddTenantCatalog(configuration);

        using var provider = services.BuildServiceProvider(new ServiceProviderOptions { ValidateScopes = true });
        var sql = provider.GetRequiredService<IOptions<SqlTenantCatalogConnectionOptions>>().Value;
        var read = provider.GetRequiredService<IOptions<TenantCatalogReadOptions>>().Value;
        var cache = provider.GetRequiredService<IOptions<TenantPlacementCacheOptions>>().Value;
        var redis = provider.GetRequiredService<IOptions<TenantPlacementRedisOptions>>().Value;

        Assert.Equal("Server=catalog;Database=control;Integrated Security=true", sql.ConnectionString);
        Assert.Equal(9, sql.ConnectTimeoutSeconds);
        Assert.Equal(23, sql.MaxPoolSize);
        Assert.Equal(8, read.CommandTimeoutSeconds);
        Assert.Equal(12, read.LookupTimeoutSeconds);
        Assert.Equal("stms:qa", cache.KeyPrefix);
        Assert.Equal(4, redis.Database);
        Assert.Equal(1800, redis.CommandTimeoutMilliseconds);
        Assert.Equal(1, services.Count(descriptor => descriptor.ServiceType == typeof(ITenantCatalog)));
        Assert.Equal(1, services.Count(descriptor => descriptor.ServiceType == typeof(IAuthoritativeTenantCatalog)));
        Assert.Equal(1, services.Count(descriptor => descriptor.ServiceType == typeof(ITenantPlacementCache)));
        Assert.DoesNotContain(services, descriptor => descriptor.ServiceType == typeof(IConnectionMultiplexer));
    }

    [Fact]
    public void Registration_does_not_connect_or_validate_missing_provider_values()
    {
        var services = new ServiceCollection().AddLogging().AddTenantCatalog(Configuration(new Dictionary<string, string?>()));
        using var provider = services.BuildServiceProvider();

        Assert.NotNull(provider.GetRequiredService<IOptions<TenantPlacementRedisOptions>>().Value);
        Assert.Throws<ArgumentException>(() => provider.GetRequiredService<ITenantCatalogConnectionFactory>());
        Assert.Throws<ArgumentException>(() => provider.GetRequiredService<TenantPlacementRedisConnection>());
    }

    [Fact]
    public void Registered_graph_keeps_durable_authority_separate_from_cache_decorator()
    {
        var services = new ServiceCollection().AddLogging().AddTenantCatalog(Configuration(new Dictionary<string, string?>
        {
            [$"{SqlTenantCatalogConnectionOptions.SectionName}:ConnectionString"] = "Server=catalog;Database=control;Integrated Security=true",
            [$"{TenantPlacementRedisOptions.SectionName}:ConnectionString"] = "redis.internal"
        }));

        Assert.Equal(ServiceLifetime.Singleton, services.Single(d => d.ServiceType == typeof(IAuthoritativeTenantCatalog)).Lifetime);
        Assert.Equal(ServiceLifetime.Singleton, services.Single(d => d.ServiceType == typeof(ITenantCatalog)).Lifetime);
        Assert.Equal(ServiceLifetime.Singleton, services.Single(d => d.ServiceType == typeof(ITenantPlacementCache)).Lifetime);
    }

    private static IConfiguration Configuration(IReadOnlyDictionary<string, string?> values)
        => new ConfigurationBuilder().AddInMemoryCollection(values).Build();
}
