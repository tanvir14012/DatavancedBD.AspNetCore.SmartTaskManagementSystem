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

    private static string NormalizeSegment(string value)
    {
        var trimmed = value.Trim();
        return trimmed.Replace(" ", "-", StringComparison.Ordinal)
            .Replace("\r", string.Empty, StringComparison.Ordinal)
            .Replace("\n", string.Empty, StringComparison.Ordinal);
    }
}
