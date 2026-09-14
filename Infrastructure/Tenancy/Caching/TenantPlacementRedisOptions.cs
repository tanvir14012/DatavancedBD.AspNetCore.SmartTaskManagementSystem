namespace Infrastructure.Tenancy.Caching;

/// <summary>External Redis binding for placement cache infrastructure; it contains no tenant inventory.</summary>
public sealed class TenantPlacementRedisOptions
{
    /// <summary>Configuration section populated by environment/App Configuration and secret references.</summary>
    public const string SectionName = "Saas:TenantCatalog:Redis";

    /// <summary>Redis endpoint/credential reference. Never log or place this value in a placement.</summary>
    public string ConnectionString { get; init; } = string.Empty;

    /// <summary>Logical Redis database, or -1 for the provider default.</summary>
    public int Database { get; init; } = -1;

    /// <summary>Maximum time a caller waits for one Redis command.</summary>
    public int CommandTimeoutMilliseconds { get; init; } = 2000;

    /// <summary>Validates finite infrastructure limits without contacting Redis.</summary>
    public void Validate()
    {
        if (string.IsNullOrWhiteSpace(ConnectionString))
            throw new ArgumentException("Tenant placement Redis settings are required.", nameof(ConnectionString));
        if (Database < -1 || Database > 15)
            throw new ArgumentOutOfRangeException(nameof(Database), "Redis database must be -1 or between 0 and 15.");
        if (CommandTimeoutMilliseconds is < 100 or > 60000)
            throw new ArgumentOutOfRangeException(nameof(CommandTimeoutMilliseconds), "Redis command timeout must be between 100 and 60000 milliseconds.");
    }
}
