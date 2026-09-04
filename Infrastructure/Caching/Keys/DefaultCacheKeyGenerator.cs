namespace Infrastructure.Caching.Keys;

public sealed class DefaultCacheKeyGenerator : ICacheKeyGenerator
{
    public string Build(params string?[] segments)
    {
        return string.Join(':',
            segments
                .Where(static value => !string.IsNullOrWhiteSpace(value))
                .Select(static value => NormalizeSegment(value!)));
    }

    public string Normalize(string prefix, string key)
    {
        var sanitized = Build(key);

        if (string.IsNullOrWhiteSpace(prefix))
            return sanitized;

        return IsAlreadyPrefixed(sanitized, prefix) ? sanitized : Build(prefix, sanitized);
    }

    private static bool IsAlreadyPrefixed(string key, string prefix)
    {
        return key.Equals(prefix, StringComparison.Ordinal)
            || key.StartsWith(prefix + ':', StringComparison.Ordinal);
    }

    private static string NormalizeSegment(string value)
    {
        var trimmed = value.Trim();
        return trimmed.Replace(" ", "-", StringComparison.Ordinal)
            .Replace("\r", string.Empty, StringComparison.Ordinal)
            .Replace("\n", string.Empty, StringComparison.Ordinal);
    }
}
