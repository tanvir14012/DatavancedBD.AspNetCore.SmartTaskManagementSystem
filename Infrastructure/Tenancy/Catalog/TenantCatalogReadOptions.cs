namespace Infrastructure.Tenancy.Catalog;

/// <summary>Finite lookup budgets supplied by external deployment configuration.</summary>
public sealed class TenantCatalogReadOptions
{
    /// <summary>External configuration section for finite catalog I/O budgets.</summary>
    public const string SectionName = "Saas:TenantCatalog:Read";
    /// <summary>Provider command timeout, including command execution and network reads.</summary>
    public int CommandTimeoutSeconds { get; init; } = 15;

    /// <summary>Total cooperative cancellation deadline, including connection acquisition.</summary>
    public int LookupTimeoutSeconds { get; init; } = 30;

    /// <summary>Rejects unbounded or excessive lookup budgets.</summary>
    public void Validate()
    {
        if (CommandTimeoutSeconds is < 1 or > 120)
            throw new ArgumentOutOfRangeException(nameof(CommandTimeoutSeconds), "Command timeout must be between 1 and 120 seconds.");
        if (LookupTimeoutSeconds is < 1 or > 180)
            throw new ArgumentOutOfRangeException(nameof(LookupTimeoutSeconds), "Lookup timeout must be between 1 and 180 seconds.");
        if (CommandTimeoutSeconds > LookupTimeoutSeconds)
            throw new ArgumentException("Command timeout must not exceed the total lookup timeout.");
    }
}
