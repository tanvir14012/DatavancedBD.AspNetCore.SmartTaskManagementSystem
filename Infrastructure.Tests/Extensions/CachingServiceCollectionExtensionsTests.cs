using Application.Interfaces;
using Infrastructure.Caching.Extensions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Infrastructure.Tests.Extensions;

/// <summary>
/// Verifies provider selection happens once, at DI registration time, based on configuration -
/// consumers only ever depend on ICacheService. Descriptors are inspected without building the
/// ServiceProvider so the Redis branch doesn't attempt a real connection during tests.
/// </summary>
public class CachingServiceCollectionExtensionsTests
{
    [Theory]
    [InlineData("Memory", "InMemoryCacheService")]
    [InlineData("Redis", "RedisCacheService")]
    public void AddCaching_RegistersImplementationMatchingConfiguredProvider(string provider, string expectedTypeName)
    {
        var services = new ServiceCollection();
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Caching:Provider"] = provider
            })
            .Build();

        services.AddCaching(configuration);

        var descriptor = services.Single(sd => sd.ServiceType == typeof(ICacheService));
        Assert.Equal(expectedTypeName, descriptor.ImplementationType?.Name);
    }

    [Fact]
    public void AddCaching_DefaultsToMemoryProvider_WhenNoConfigurationSupplied()
    {
        var services = new ServiceCollection();

        services.AddCaching();

        var descriptor = services.Single(sd => sd.ServiceType == typeof(ICacheService));
        Assert.Equal("InMemoryCacheService", descriptor.ImplementationType?.Name);
    }
}
