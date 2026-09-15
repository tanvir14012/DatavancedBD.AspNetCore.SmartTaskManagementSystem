using Application.Tenancy;
using Microsoft.Data.SqlClient;

namespace Infrastructure.Tenancy.Persistence;

/// <summary>A validated backing-service snapshot supplied by trusted deployment configuration.</summary>
public sealed class TenantStorageTarget
{
    public TenantStorageTarget(string targetId, string region, TenantIsolation isolation, string schema,
        string connectionString, int maxPoolSize = 50, int commandTimeoutSeconds = 30)
    {
        // Reuse the catalog naming contract, including SQL-safe schema validation.
        _ = new TenantPlacement(Guid.NewGuid(), TenantIsolation.Schema, targetId, schema, region, 1, TenantLifecycle.Active);
        if (!Enum.IsDefined(isolation)) throw new ArgumentOutOfRangeException(nameof(isolation));
        if (maxPoolSize is < 1 or > 1000) throw new ArgumentOutOfRangeException(nameof(maxPoolSize));
        if (commandTimeoutSeconds is < 1 or > 120) throw new ArgumentOutOfRangeException(nameof(commandTimeoutSeconds));
        try
        {
            var builder = new SqlConnectionStringBuilder(connectionString);
            if (string.IsNullOrWhiteSpace(builder.DataSource) || string.IsNullOrWhiteSpace(builder.InitialCatalog))
                throw new ArgumentException();
            builder.Pooling = true;
            builder.MinPoolSize = 0;
            builder.MaxPoolSize = maxPoolSize;
            builder.ConnectTimeout = 15;
            builder.ConnectRetryCount = 0;
            builder.MultipleActiveResultSets = false;
            builder.Enlist = false;
            builder.ApplicationIntent = ApplicationIntent.ReadWrite;
            builder.PersistSecurityInfo = false;
            ConnectionString = builder.ConnectionString;
        }
        catch (Exception error) when (error is ArgumentException or FormatException or OverflowException)
        {
            throw new ArgumentException("Tenant storage connection configuration is invalid.");
        }
        TargetId = targetId;
        Region = region;
        Isolation = isolation;
        Schema = schema;
        CommandTimeoutSeconds = commandTimeoutSeconds;
    }

    public string TargetId { get; }
    public string Region { get; }
    public TenantIsolation Isolation { get; }
    public string Schema { get; }
    // Intentionally not a record: generated ToString must never print credentials.
    internal string ConnectionString { get; }
    public int CommandTimeoutSeconds { get; }
}

public interface ITenantStorageTargetProvider
{
    Task<TenantStorageTarget> ResolveAsync(string targetId, CancellationToken cancellationToken);
}
