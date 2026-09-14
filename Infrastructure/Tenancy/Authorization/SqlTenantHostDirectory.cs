using System.Data;
using System.Data.Common;
using System.Data.SqlTypes;
using Application.Tenancy.Resolution;
using Infrastructure.Tenancy.Catalog;
using Microsoft.Extensions.Options;

namespace Infrastructure.Tenancy.Authorization;

/// <summary>Reads the approved request-authority to organization mapping from the control plane.</summary>
/// <remarks>
/// Authority rows are durable tenant metadata and are never supplied by appsettings. The resolver
/// normalizes the request before calling this adapter; this boundary still rejects noncanonical
/// input so it cannot become an accidental directory lookup contract.
/// </remarks>
public sealed class SqlTenantHostDirectory : ITenantHostDirectory
{
    private const string FindTenantSql = """
        SELECT TOP (2) [TenantId]
        FROM [catalog].[TenantAuthorities]
        WHERE [Authority] = @Authority AND [IsActive] = 1;
        """;

    private readonly ITenantCatalogConnectionFactory _connections;
    private readonly int _commandTimeoutSeconds;
    private readonly TimeSpan _lookupTimeout;
    private readonly TimeProvider _timeProvider;

    /// <summary>Captures finite external lookup budgets without opening a database connection.</summary>
    public SqlTenantHostDirectory(
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

    /// <inheritdoc />
    public async Task<Guid?> FindTenantAsync(string canonicalAuthority, CancellationToken cancellationToken)
    {
        ValidateAuthority(canonicalAuthority);
        cancellationToken.ThrowIfCancellationRequested();

        using var timeout = new CancellationTokenSource(_lookupTimeout, _timeProvider);
        using var deadline = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, timeout.Token);
        try
        {
            var tenantId = await FindCoreAsync(canonicalAuthority, cancellationToken, deadline.Token)
                .ConfigureAwait(false);
            ThrowIfCanceled(cancellationToken, deadline.Token);
            return tenantId;
        }
        catch
        {
            cancellationToken.ThrowIfCancellationRequested();
            if (timeout.IsCancellationRequested)
                throw new TimeoutException("The tenant authority lookup deadline expired.");
            throw;
        }
    }

    private async Task<Guid?> FindCoreAsync(
        string canonicalAuthority,
        CancellationToken callerToken,
        CancellationToken operationToken)
    {
        await using var connection = _connections.CreateConnection();
        await connection.OpenAsync(operationToken).ConfigureAwait(false);
        ThrowIfCanceled(callerToken, operationToken);

        await using var command = connection.CreateCommand();
        command.CommandText = FindTenantSql;
        command.CommandType = CommandType.Text;
        command.CommandTimeout = _commandTimeoutSeconds;
        var parameter = command.CreateParameter();
        parameter.ParameterName = "@Authority";
        parameter.DbType = DbType.String;
        parameter.Size = 259;
        parameter.Value = canonicalAuthority;
        command.Parameters.Add(parameter);

        await using var reader = await command.ExecuteReaderAsync(CommandBehavior.Default, operationToken)
            .ConfigureAwait(false);
        ThrowIfCanceled(callerToken, operationToken);
        if (!await reader.ReadAsync(operationToken).ConfigureAwait(false))
            return null;

        var tenantId = ReadTenantId(reader);
        var duplicate = await reader.ReadAsync(operationToken).ConfigureAwait(false);
        ThrowIfCanceled(callerToken, operationToken);
        if (duplicate)
            throw new InvalidDataException("The tenant authority directory returned multiple active organizations.");
        return tenantId;
    }

    private static Guid ReadTenantId(DbDataReader reader)
    {
        try
        {
            if (reader.FieldCount != 1 || reader.IsDBNull(0))
                throw new InvalidDataException("The tenant authority directory returned an invalid row.");
            var tenantId = reader.GetGuid(0);
            if (tenantId == Guid.Empty)
                throw new InvalidDataException("The tenant authority directory returned an empty organization.");
            return tenantId;
        }
        catch (Exception exception) when (exception is ArgumentException or InvalidCastException
                                         or OverflowException or IndexOutOfRangeException or SqlNullValueException)
        {
            throw new InvalidDataException("The tenant authority directory returned an invalid organization.");
        }
    }

    private static void ValidateAuthority(string value)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(value);
        if (!TenantAuthority.TryNormalize(value, out var canonicalAuthority) ||
            !string.Equals(value, canonicalAuthority, StringComparison.Ordinal))
            throw new ArgumentException("The tenant authority must be a canonical external authority.", nameof(value));
    }

    private static void ThrowIfCanceled(CancellationToken caller, CancellationToken operation)
    {
        caller.ThrowIfCancellationRequested();
        operation.ThrowIfCancellationRequested();
    }
}
