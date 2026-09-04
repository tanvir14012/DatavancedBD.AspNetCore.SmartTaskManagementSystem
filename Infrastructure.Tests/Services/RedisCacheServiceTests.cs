using Application.Models;
using Infrastructure.Caching.Keys;
using Infrastructure.Caching.Options;
using Infrastructure.Caching.Serialization;
using Infrastructure.Caching.Services;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using StackExchange.Redis;

namespace Infrastructure.Tests.Services;

/// <summary>
/// Exercises RedisCacheService's Get/Set/Remove/GetOrCreate contract against MemoryDistributedCache,
/// the in-process IDistributedCache implementation, so tests don't require a live Redis server.
/// RemoveByPatternAsync relies on Redis SCAN via IConnectionMultiplexer and is covered by integration/manual testing.
/// </summary>
public class RedisCacheServiceTests
{
    private static RedisCacheService CreateService(CachingOptions? cachingOptions = null)
    {
        var options = Options.Create(cachingOptions ?? new CachingOptions());
        var distributedCache = new MemoryDistributedCache(Options.Create(new MemoryDistributedCacheOptions()));
        var connectionMultiplexer = new Mock<IConnectionMultiplexer>(MockBehavior.Loose).Object;

        return new RedisCacheService(
            distributedCache,
            connectionMultiplexer,
            new SystemTextJsonCacheSerializer(options),
            new DefaultCacheKeyGenerator(),
            options,
            NullLogger<RedisCacheService>.Instance);
    }

    [Fact]
    public async Task SetAsync_ThenGetAsync_RoundTripsValue()
    {
        var sut = CreateService();

        await sut.SetAsync("Project:42", new SamplePayload("Alpha"));
        var result = await sut.GetAsync<SamplePayload>("Project:42");

        Assert.Equal("Alpha", result?.Name);
    }

    [Fact]
    public async Task GetAsync_MissingKey_ReturnsDefault()
    {
        var sut = CreateService();

        var result = await sut.GetAsync<SamplePayload>("missing");

        Assert.Null(result);
    }

    [Fact]
    public async Task RemoveAsync_RemovesEntry()
    {
        var sut = CreateService();
        await sut.SetAsync("key-1", "value-1");

        await sut.RemoveAsync("key-1");

        Assert.Null(await sut.GetAsync<string>("key-1"));
    }

    [Fact]
    public async Task RemoveAsync_IsSafeToCallWithAnAlreadyNormalizedKey()
    {
        var sut = CreateService(new CachingOptions { KeyPrefix = "stms" });
        await sut.SetAsync("key-1", "value-1");

        // Simulates a caller (e.g. RemoveByPatternAsync) passing a key that already carries the "stms:" prefix.
        await sut.RemoveAsync("stms:key-1");

        Assert.Null(await sut.GetAsync<string>("key-1"));
    }

    [Fact]
    public async Task GetOrCreateAsync_InvokesFactoryOnceForConcurrentCallers()
    {
        var sut = CreateService();
        var factoryCalls = 0;

        Task<int> Factory(CancellationToken _)
        {
            Interlocked.Increment(ref factoryCalls);
            return Task.FromResult(123);
        }

        var results = await Task.WhenAll(Enumerable.Range(0, 10)
            .Select(_ => sut.GetOrCreateAsync("shared-key", Factory)));

        Assert.All(results, value => Assert.Equal(123, value));
        Assert.Equal(1, factoryCalls);
    }

    private sealed record SamplePayload(string Name);
}
