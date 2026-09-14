namespace Infrastructure.Tenancy.Caching;

/// <summary>Deployment-supplied controls for organization-placement cache entries.</summary>
/// <remarks>These values are operational configuration; tenant placement data is never stored here.</remarks>
public sealed class TenantPlacementCacheOptions
{
    /// <summary>External configuration section for cache key and payload policy.</summary>
    public const string SectionName = "Saas:TenantCatalog:Cache";
    /// <summary>Key prefix isolating this service from other Redis consumers.</summary>
    public string KeyPrefix { get; init; } = "stms";

    /// <summary>Maximum time a placement may be served without a catalog refresh.</summary>
    public TimeSpan AbsoluteExpiration { get; init; } = TimeSpan.FromMinutes(5);

    /// <summary>Maximum serialized placement size accepted from or written to Redis.</summary>
    public int MaxPayloadBytes { get; init; } = 32 * 1024;

    /// <summary>Validates configuration before a cache is exposed to request processing.</summary>
    public void Validate()
    {
        ValidateSegment(KeyPrefix, nameof(KeyPrefix), 64);

        if (AbsoluteExpiration <= TimeSpan.Zero || AbsoluteExpiration > TimeSpan.FromDays(1))
            throw new ArgumentOutOfRangeException(nameof(AbsoluteExpiration),
                "Placement cache expiration must be greater than zero and no longer than one day.");

        if (MaxPayloadBytes is < 256 or > 1024 * 1024)
            throw new ArgumentOutOfRangeException(nameof(MaxPayloadBytes),
                "Placement cache payload limit must be between 256 bytes and 1 MiB.");
    }

    private static void ValidateSegment(string value, string parameterName, int maxLength)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(value, parameterName);
        if (value.Length > maxLength || !char.IsAsciiLetterOrDigit(value[0]) ||
            value.Any(character => !(char.IsAsciiLetterOrDigit(character) || character is '.' or '_' or '-')))
            throw new ArgumentException($"{parameterName} must start with a letter or digit and contain only ASCII letters, digits, dots, underscores or hyphens.", parameterName);
    }
}
