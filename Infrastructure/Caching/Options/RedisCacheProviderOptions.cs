namespace Infrastructure.Caching.Options;

public sealed class RedisCacheProviderOptions
{
    public string ConnectionString { get; set; } = "localhost:6379";

    /// <summary>Optional physical key prefix applied by Redis itself, useful when several apps share one Redis instance.</summary>
    public string InstanceName { get; set; } = string.Empty;

    public int ConnectRetry { get; set; } = 3;
    public int ConnectTimeoutMilliseconds { get; set; } = 5000;
    public int SyncTimeoutMilliseconds { get; set; } = 5000;
}
