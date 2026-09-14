using System.Data;
using System.Data.Common;
using System.Data.SqlTypes;
using Application.Tenancy;
using Application.Tenancy.Authorization;
using Infrastructure.Tenancy.Catalog;
using Microsoft.Extensions.Options;

namespace Infrastructure.Tenancy.Authorization;

/// <summary>Reads current organization membership from the independent control-plane database.</summary>
/// <remarks>
/// Membership is keyed by organization, validated issuer and subject using ordinal semantics.
/// Each decision reads the durable store; a placement cache or token role never grants membership.
/// </remarks>
public sealed class SqlTenantMembershipReader : ITenantMembershipReader
{
    private const string FindMembershipSql = """
        SELECT TOP (2) [IsActive]
        FROM [catalog].[TenantMemberships]
        WHERE [TenantId] = @TenantId AND [Issuer] = @Issuer AND [SubjectId] = @SubjectId;
        """;

    private readonly ITenantCatalogConnectionFactory _connections;
    private readonly int _commandTimeoutSeconds;
    private readonly TimeSpan _lookupTimeout;
    private readonly TimeProvider _timeProvider;

    /// <summary>Captures finite external lookup budgets without opening a database connection.</summary>
    public SqlTenantMembershipReader(
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

    /// <summary>Returns false only for absent or inactive membership; dependency failures propagate.</summary>
    public async Task<bool> IsActiveMemberAsync(TenantAccess access, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(access);
        cancellationToken.ThrowIfCancellationRequested();

        using var timeout = new CancellationTokenSource(_lookupTimeout, _timeProvider);
        using var deadline = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, timeout.Token);
        try
        {
            var active = await FindCoreAsync(access, cancellationToken, deadline.Token).ConfigureAwait(false);
            // Async disposal can race cancellation after the final read.
            ThrowIfCanceled(cancellationToken, deadline.Token);
            return active;
        }
        catch
        {
            cancellationToken.ThrowIfCancellationRequested();
            if (timeout.IsCancellationRequested)
                throw new TimeoutException("The tenant membership lookup deadline expired.");
            throw;
        }
    }

    private async Task<bool> FindCoreAsync(TenantAccess access, CancellationToken cancellationToken,
        CancellationToken operationToken)
    {
        await using var connection = _connections.CreateConnection();
        await connection.OpenAsync(operationToken).ConfigureAwait(false);
        ThrowIfCanceled(cancellationToken, operationToken);

        await using var command = connection.CreateCommand();
        command.CommandText = FindMembershipSql;
        command.CommandType = CommandType.Text;
        command.CommandTimeout = _commandTimeoutSeconds;
        AddParameter(command, "@TenantId", DbType.Guid, access.TenantId);
        AddParameter(command, "@Issuer", DbType.String, access.Issuer, 256);
        AddParameter(command, "@SubjectId", DbType.String, access.SubjectId, 256);

        // SingleRow would suppress duplicate detection and could hide corrupt membership data.
        await using var reader = await command.ExecuteReaderAsync(CommandBehavior.Default, operationToken)
            .ConfigureAwait(false);
        ThrowIfCanceled(cancellationToken, operationToken);
        var found = await reader.ReadAsync(operationToken).ConfigureAwait(false);
        ThrowIfCanceled(cancellationToken, operationToken);
        if (!found)
            return false;

        var active = ReadActive(reader);
        var duplicate = await reader.ReadAsync(operationToken).ConfigureAwait(false);
        ThrowIfCanceled(cancellationToken, operationToken);
        if (duplicate)
            throw new InvalidDataException("The tenant catalog returned multiple memberships for one identity.");
        return active;
    }

    private static bool ReadActive(DbDataReader reader)
    {
        try
        {
            if (reader.FieldCount != 1 || reader.IsDBNull(0))
                throw new InvalidDataException("The tenant catalog returned an invalid membership shape.");
            return reader.GetBoolean(0);
        }
        catch (Exception exception) when (exception is ArgumentException or InvalidCastException
                                         or OverflowException or IndexOutOfRangeException or SqlNullValueException)
        {
            // Provider values may contain identity details; do not retain them in the exception.
            throw new InvalidDataException("The tenant catalog returned an invalid membership.");
        }
    }

    private static void AddParameter(DbCommand command, string name, DbType type, object value, int? size = null)
    {
        var parameter = command.CreateParameter();
        parameter.ParameterName = name;
        parameter.DbType = type;
        parameter.Value = value;
        if (size.HasValue)
            parameter.Size = size.Value;
        command.Parameters.Add(parameter);
    }

    private static void ThrowIfCanceled(CancellationToken caller, CancellationToken operation)
    {
        caller.ThrowIfCancellationRequested();
        operation.ThrowIfCancellationRequested();
    }
}
