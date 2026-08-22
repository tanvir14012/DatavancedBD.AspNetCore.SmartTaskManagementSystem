namespace Infrastructure.Caching.Options;

public sealed class CachingOptions
{
    public const string SectionName = "Caching:Memory";
    public string KeyPrefix { get; set; } = "stms";
    public int DefaultAbsoluteExpirationSeconds { get; set; } = 300;
    public int? DefaultSlidingExpirationSeconds { get; set; }
    public bool EnableCompression { get; set; } = true;
    public int CompressionThresholdBytes { get; set; } = 1024;
    public int ConnectRetry { get; set; } = 3;
    public int ConnectTimeoutMilliseconds { get; set; } = 5000;
    public int SyncTimeoutMilliseconds { get; set; } = 5000;
    public bool UseCamelCaseJson { get; set; } = true;
}
