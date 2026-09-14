namespace Infrastructure.Tenancy.Catalog;

/// <summary>Catalog backing-service settings bound externally; tenant targets are separate resources.</summary>
public sealed class SqlTenantCatalogConnectionOptions
{
    /// <summary>External configuration section; values may be supplied by environment/App Configuration.</summary>
    public const string SectionName = "Saas:TenantCatalog:Sql";
    /// <summary>SQL Client connection settings, preferably using workload identity. Never log this value.</summary>
    public string ConnectionString { get; init; } = string.Empty;

    /// <summary>Finite connection acquisition/open timeout.</summary>
    public int ConnectTimeoutSeconds { get; init; } = 15;

    /// <summary>Maximum physical connections for this catalog pool in one process.</summary>
    public int MaxPoolSize { get; init; } = 100;

    /// <summary>Validates operational limits without making a network request.</summary>
    public void Validate()
    {
        if (string.IsNullOrWhiteSpace(ConnectionString))
            throw new ArgumentException("Catalog connection settings are required.", nameof(ConnectionString));
        if (ConnectTimeoutSeconds is < 1 or > 120)
            throw new ArgumentOutOfRangeException(nameof(ConnectTimeoutSeconds), "Connection timeout must be between 1 and 120 seconds.");
        if (MaxPoolSize is < 1 or > 1000)
            throw new ArgumentOutOfRangeException(nameof(MaxPoolSize), "Catalog pool size must be between 1 and 1000 connections.");
    }
}
