using Application.Models;
using Infrastructure.Caching.Keys;
using Infrastructure.Caching.Options;
using Infrastructure.Caching.Serialization;
using Infrastructure.Caching.Services;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace Infrastructure.Tests.Services;

public class InMemoryCacheServiceTests
{
    private static InMemoryCacheService CreateService(out MemoryCache memoryCache, CachingOptions? cachingOptions = null)
    {
        cachingOptions ??= new CachingOptions();
        memoryCache = new MemoryCache(new MemoryCacheOptions { SizeLimit = cachingOptions.Memory.SizeLimit });
        var options = Options.Create(cachingOptions);

        return new InMemoryCacheService(
            memoryCache,
            new SystemTextJsonCacheSerializer(options),
            new DefaultCacheKeyGenerator(),
            options,
            NullLogger<InMemoryCacheService>.Instance);
    }

    [Fact]
    public async Task SetAsync_ThenGetAsync_RoundTripsValue()
    {
        var sut = CreateService(out _);

        await sut.SetAsync("Project:42", new SamplePayload("Alpha"));
        var result = await sut.GetAsync<SamplePayload>("Project:42");

        Assert.NotNull(result);
        Assert.Equal("Alpha", result.Name);
    }

    [Fact]
    public async Task GetAsync_MissingKey_ReturnsDefault()
    {
        var sut = CreateService(out _);

        var result = await sut.GetAsync<string>("missing");

        Assert.Null(result);
    }

    [Fact]
    public async Task RemoveAsync_RemovesEntry()
    {
        var sut = CreateService(out _);
        await sut.SetAsync("key-1", "value-1");

        await sut.RemoveAsync("key-1");

        Assert.Null(await sut.GetAsync<string>("key-1"));
    }

    [Fact]
    public async Task RemoveManyAsync_RemovesEveryKeyExactlyOnce()
    {
        var sut = CreateService(out var memoryCache);
        await sut.SetAsync("a", 1);
        await sut.SetAsync("b", 2);
        await sut.SetAsync("c", 3);

        await sut.RemoveManyAsync(["a", "b", "c"]);

        Assert.Null(await sut.GetAsync<int?>("a"));
        Assert.Null(await sut.GetAsync<int?>("b"));
        Assert.Null(await sut.GetAsync<int?>("c"));
        Assert.Equal(0, memoryCache.Count);
    }

    [Fact]
    public async Task RemoveByPatternAsync_RemovesOnlyMatchingCategoryEntries()
    {
        var sut = CreateService(out _);
        await sut.SetAsync("Task:1", "one");
        await sut.SetAsync("Task:2", "two");
        await sut.SetAsync("Project:1", "kept");

        // Exercises the previously-broken path: RemoveByPatternAsync feeds already-normalized keys
        // back through RemoveManyAsync -> RemoveAsync, which must not double-prefix them.
        await sut.RemoveByPatternAsync("Task:*");

        Assert.Null(await sut.GetAsync<string>("Task:1"));
        Assert.Null(await sut.GetAsync<string>("Task:2"));
        Assert.Equal("kept", await sut.GetAsync<string>("Project:1"));
    }

    [Fact]
    public async Task GetOrCreateAsync_InvokesFactoryOnceForConcurrentCallers()
    {
        var sut = CreateService(out _);
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

    [Fact]
    public async Task SetAsync_WhenSizeLimitConfigured_EvictsEntriesOnceBudgetIsExceeded()
    {
        var sut = CreateService(out var memoryCache, new CachingOptions
        {
            Memory = new MemoryCacheProviderOptions { SizeLimit = 200 }
        });

        for (var i = 0; i < 20; i++)
            await sut.SetAsync($"item-{i}", new string('x', 50));

        // A trailing write gives the cache a chance to run its over-capacity compaction pass.
        await sut.SetAsync("trigger", "x");

        Assert.True(memoryCache.Count < 21, $"Expected eviction to keep entry count below 21, but found {memoryCache.Count}.");
    }

    private sealed record SamplePayload(string Name);
}
