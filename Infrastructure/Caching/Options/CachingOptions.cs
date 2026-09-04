namespace Infrastructure.Caching.Options;

public sealed class CachingOptions
{
    public const string SectionName = "Caching";

    /// <summary>Which ICacheService implementation to register at startup. See CachingServiceCollectionExtensions.</summary>
    public CacheProvider Provider { get; set; } = CacheProvider.Memory;

    public string KeyPrefix { get; set; } = "stms";
    public int DefaultAbsoluteExpirationSeconds { get; set; } = 300;
    public int? DefaultSlidingExpirationSeconds { get; set; }
    public bool EnableCompression { get; set; } = true;
    public int CompressionThresholdBytes { get; set; } = 1024;
    public bool UseCamelCaseJson { get; set; } = true;

    public MemoryCacheProviderOptions Memory { get; set; } = new();
    public RedisCacheProviderOptions Redis { get; set; } = new();
}
