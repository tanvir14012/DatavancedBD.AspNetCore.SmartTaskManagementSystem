namespace Infrastructure.Caching.Options;

/// <summary>
/// Selects which <see cref="Application.Interfaces.ICacheService"/> implementation is wired up at startup.
/// Add new members here (and a matching branch in CachingServiceCollectionExtensions) to support additional providers.
/// </summary>
public enum CacheProvider
{
    Memory,
    Redis
}
