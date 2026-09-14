namespace Application.Tenancy;

/// <summary>Physical isolation between purchasing organizations.</summary>
public enum TenantIsolation
{
    /// <summary>A dedicated organization database.</summary>
    Database = 0,
    /// <summary>An organization schema in a shared database.</summary>
    Schema = 1,
    /// <summary>Organization rows in shared tables.</summary>
    Row = 2
}

/// <summary>Catalog lifecycle; only Active is eligible for subsequent access validation.</summary>
public enum TenantLifecycle
{
    /// <summary>The target has not yet been validated and activated.</summary>
    Provisioning = 0,
    /// <summary>The placement has been activated.</summary>
    Active = 1,
    /// <summary>A controlled placement change is in progress.</summary>
    Moving = 2,
    /// <summary>Access has been administratively suspended.</summary>
    Suspended = 3
}

/// <summary>
/// An immutable, structurally valid catalog placement. Construction performs no I/O and
/// does not prove target existence, authorization, schema compatibility or routing freshness.
/// </summary>
/// <remarks>
/// Logical handles are case-preserving ASCII identifiers (letters, digits, dot, underscore,
/// hyphen), up to 128 characters. Schema names use a narrower portable identifier policy.
/// Values are rejected rather than normalized, so distinct catalog keys are never aliased.
/// Database and row placements obtain their fixed schema from the referenced target definition.
/// Schema validation does not replace SQL identifier quoting in the storage adapter.
/// </remarks>
public sealed record TenantPlacement
{
    /// <summary>Creates a validated placement; invalid catalog data throws an argument exception.</summary>
    public TenantPlacement(
        Guid tenantId,
        TenantIsolation isolation,
        string targetId,
        string? schema,
        string region,
        long version,
        TenantLifecycle lifecycle)
    {
        if (tenantId == Guid.Empty)
            throw new ArgumentException("Organization identity must not be empty.", nameof(tenantId));
        if (!Enum.IsDefined(isolation))
            throw new ArgumentOutOfRangeException(nameof(isolation), "Unknown isolation strategy.");
        if (!Enum.IsDefined(lifecycle))
            throw new ArgumentOutOfRangeException(nameof(lifecycle), "Unknown tenant lifecycle.");

        ValidateHandle(targetId, nameof(targetId));
        ValidateHandle(region, nameof(region));

        if (version <= 0)
            throw new ArgumentOutOfRangeException(nameof(version), "Placement version must be positive.");

        if (isolation == TenantIsolation.Schema)
        {
            ArgumentException.ThrowIfNullOrWhiteSpace(schema);
            if (schema.Length > 128 || !(char.IsAsciiLetter(schema[0]) || schema[0] == '_') ||
                schema.Any(character => !(char.IsAsciiLetterOrDigit(character) || character == '_')))
                throw new ArgumentException("Schema must be an identifier of at most 128 ASCII characters.", nameof(schema));
        }
        else if (schema is not null)
        {
            throw new ArgumentException("Only schema isolation accepts a placement schema override.", nameof(schema));
        }

        TenantId = tenantId;
        Isolation = isolation;
        TargetId = targetId;
        Schema = schema;
        Region = region;
        Version = version;
        Lifecycle = lifecycle;
    }

    /// <summary>Purchasing organization identity, independent of physical storage.</summary>
    public Guid TenantId { get; }
    /// <summary>Physical storage strategy.</summary>
    public TenantIsolation Isolation { get; }
    /// <summary>Logical target reference; never a connection string or credential.</summary>
    public string TargetId { get; }
    /// <summary>Organization schema override for schema isolation only.</summary>
    public string? Schema { get; }
    /// <summary>Logical home-region handle, resolved through external configuration.</summary>
    public string Region { get; }
    /// <summary>Positive placement revision; monotonic updates require catalog concurrency control.</summary>
    public long Version { get; }
    /// <summary>Lifecycle recorded by the catalog; does not replace authorization checks.</summary>
    public TenantLifecycle Lifecycle { get; }

    private static void ValidateHandle(string value, string parameterName)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(value, parameterName);
        if (value.Length > 128 || !char.IsAsciiLetterOrDigit(value[0]) ||
            value.Any(character => !(char.IsAsciiLetterOrDigit(character) || character is '.' or '_' or '-')))
            throw new ArgumentException("Handle must start with a letter or digit and contain at most 128 ASCII letters, digits, dots, underscores or hyphens.", parameterName);
    }
}
