namespace Infrastructure.Caching.Options;

public sealed class MemoryCacheProviderOptions
{
    /// <summary>
    /// Total size budget for the in-memory cache. Each entry's size is estimated from its serialized
    /// payload so the cache evicts entries (least-recently-used first) once the limit is reached.
    /// Leave unset for unbounded growth (previous behavior).
    /// </summary>
    public long? SizeLimit { get; set; }
}
