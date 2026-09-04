using Infrastructure.Caching.Options;
using Microsoft.Extensions.Configuration;

namespace Infrastructure.Tests.Configuration;

public class CachingOptionsBindingTests
{
    [Fact]
    public void Binding_MapsProviderAndNestedProviderOptions_FromConfiguration()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Caching:Provider"] = "Redis",
                ["Caching:KeyPrefix"] = "stms",
                ["Caching:Memory:SizeLimit"] = "5000",
                ["Caching:Redis:ConnectionString"] = "localhost:6379",
                ["Caching:Redis:InstanceName"] = "MyApplication:"
            })
            .Build();

        var options = new CachingOptions();
        configuration.GetSection(CachingOptions.SectionName).Bind(options);

        Assert.Equal(CacheProvider.Redis, options.Provider);
        Assert.Equal("stms", options.KeyPrefix);
        Assert.Equal(5000, options.Memory.SizeLimit);
        Assert.Equal("localhost:6379", options.Redis.ConnectionString);
        Assert.Equal("MyApplication:", options.Redis.InstanceName);
    }

    [Fact]
    public void Defaults_SelectMemoryProvider_WhenSectionIsAbsent()
    {
        var options = new CachingOptions();

        Assert.Equal(CacheProvider.Memory, options.Provider);
        Assert.Null(options.Memory.SizeLimit);
    }
}
