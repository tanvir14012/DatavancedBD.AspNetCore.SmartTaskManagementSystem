using System.Data;
using System.Data.Common;
using System.Data.SqlTypes;
using Application.Tenancy;
using Microsoft.Extensions.Options;

namespace Infrastructure.Tenancy.Catalog;

/// <summary>Reads authoritative placements independently of tenant database resolution.</summary>
public sealed class AzureSqlTenantCatalog : IAuthoritativeTenantCatalog
{
    private const string FindPlacementSql = """
        SELECT TOP (2) [TenantId], [Isolation], [TargetId], [SchemaName], [Region], [Version], [Lifecycle]
        FROM [catalog].[TenantPlacements]
        WHERE [TenantId] = @TenantId;
        """;

    private readonly ITenantCatalogConnectionFactory _connections;
    private readonly int _commandTimeoutSeconds;
    private readonly TimeSpan _lookupTimeout;
    private readonly TimeProvider _timeProvider;

    /// <summary>Captures validated operational settings without connecting to the catalog.</summary>
    public AzureSqlTenantCatalog(
        ITenantCatalogConnectionFactory connections,
        IOptions<TenantCatalogReadOptions> options,
        TimeProvider timeProvider)
    {
        ArgumentNullException.ThrowIfNull(connections);
        ArgumentNullException.ThrowIfNull(options);
        ArgumentNullException.ThrowIfNull(timeProvider);
        var settings = options.Value;
        settings.Validate();
        _connections = connections;
        _commandTimeoutSeconds = settings.CommandTimeoutSeconds;
        _lookupTimeout = TimeSpan.FromSeconds(settings.LookupTimeoutSeconds);
        _timeProvider = timeProvider;
    }

    /// <summary>Returns null only when no organization row exists; failures are never converted to absence.</summary>
    public async Task<TenantPlacement?> FindAsync(Guid tenantId, CancellationToken cancellationToken)
    {
        if (tenantId == Guid.Empty)
            throw new ArgumentException("Organization identity must not be empty.", nameof(tenantId));
        cancellationToken.ThrowIfCancellationRequested();

        using var timeout = new CancellationTokenSource(_lookupTimeout, _timeProvider);
        using var deadline = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, timeout.Token);
        try
        {
            var placement = await FindCoreAsync(tenantId, cancellationToken, deadline.Token).ConfigureAwait(false);
            ThrowIfCanceled(cancellationToken, deadline.Token);
            return placement;
        }
        catch
        {
            // Prefer caller cancellation, then our deadline, over a racing provider failure.
            cancellationToken.ThrowIfCancellationRequested();
            if (timeout.IsCancellationRequested)
                throw new TimeoutException("The tenant catalog lookup deadline expired.");
            throw;
        }
    }

    private async Task<TenantPlacement?> FindCoreAsync(Guid tenantId, CancellationToken cancellationToken,
        CancellationToken operationToken)
    {
        await using var connection = _connections.CreateConnection();
        await connection.OpenAsync(operationToken).ConfigureAwait(false);
        ThrowIfCanceled(cancellationToken, operationToken);

        await using var command = connection.CreateCommand();
        command.CommandText = FindPlacementSql;
        command.CommandType = CommandType.Text;
        command.CommandTimeout = _commandTimeoutSeconds;
        var parameter = command.CreateParameter();
        parameter.ParameterName = "@TenantId";
        parameter.DbType = DbType.Guid;
        parameter.Value = tenantId;
        command.Parameters.Add(parameter);

        // Do not use SingleRow: a duplicate result must be detected rather than silently discarded.
        await using var reader = await command.ExecuteReaderAsync(CommandBehavior.Default, operationToken)
            .ConfigureAwait(false);
        ThrowIfCanceled(cancellationToken, operationToken);
        var found = await reader.ReadAsync(operationToken).ConfigureAwait(false);
        ThrowIfCanceled(cancellationToken, operationToken);
        if (!found)
            return null;

        var placement = ReadPlacement(reader);
        if (placement.TenantId != tenantId)
            throw new InvalidDataException("The tenant catalog returned a different organization.");

        var duplicate = await reader.ReadAsync(operationToken).ConfigureAwait(false);
        ThrowIfCanceled(cancellationToken, operationToken);
        if (duplicate)
            throw new InvalidDataException("The tenant catalog returned multiple placements for one organization.");
        return placement;
    }

    private static TenantPlacement ReadPlacement(DbDataReader reader)
    {
        try
        {
            if (reader.FieldCount != 7)
                throw new InvalidDataException("The tenant catalog returned an invalid placement shape.");
            return new TenantPlacement(
                reader.GetGuid(0),
                (TenantIsolation)reader.GetByte(1),
                reader.GetString(2),
                reader.IsDBNull(3) ? null : reader.GetString(3),
                reader.GetString(4),
                reader.GetInt64(5),
                (TenantLifecycle)reader.GetByte(6));
        }
        catch (Exception exception) when (exception is ArgumentException or InvalidCastException
                                         or OverflowException or IndexOutOfRangeException or SqlNullValueException)
        {
            // Malformed values may contain connection details; do not retain them in an inner exception.
            throw new InvalidDataException("The tenant catalog returned an invalid placement.");
        }
    }

    private static void ThrowIfCanceled(CancellationToken caller, CancellationToken operation)
    {
        caller.ThrowIfCancellationRequested();
        operation.ThrowIfCancellationRequested();
    }
}
