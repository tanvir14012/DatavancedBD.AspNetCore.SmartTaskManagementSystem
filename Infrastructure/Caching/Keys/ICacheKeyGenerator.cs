namespace Infrastructure.Caching.Keys;

public interface ICacheKeyGenerator
{
    string Build(params string?[] segments);

    /// <summary>
    /// Ensures <paramref name="key"/> is sanitized and prefixed with <paramref name="prefix"/>.
    /// Idempotent: keys that are already normalized (or patterns derived from them) are returned unchanged,
    /// so every cache provider can normalize on every Get/Set/Remove call without ever double-prefixing.
    /// </summary>
    string Normalize(string prefix, string key);
}
