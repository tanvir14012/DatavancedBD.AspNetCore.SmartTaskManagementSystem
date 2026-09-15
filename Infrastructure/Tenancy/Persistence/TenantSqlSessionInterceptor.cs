using System.Data;
using System.Data.Common;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace Infrastructure.Tenancy.Persistence;

/// <summary>Sets immutable SQL session ownership on every physical/logical pool checkout.</summary>
public sealed class TenantSqlSessionInterceptor : DbConnectionInterceptor
{
    private readonly Guid _tenantId;
    private readonly int _timeout;
    private readonly string _schema;

    public TenantSqlSessionInterceptor(Guid tenantId, string schema, int commandTimeoutSeconds)
    {
        if (tenantId == Guid.Empty) throw new ArgumentException("Tenant identity is required.", nameof(tenantId));
        if (commandTimeoutSeconds is < 1 or > 120) throw new ArgumentOutOfRangeException(nameof(commandTimeoutSeconds));
        _tenantId = tenantId;
        _timeout = commandTimeoutSeconds;
        _schema = schema ?? throw new ArgumentNullException(nameof(schema));
    }

    public override void ConnectionOpened(DbConnection connection, ConnectionEndEventData eventData)
    {
        try
        {
            using var command = CreateCommand(connection);
            command.ExecuteNonQuery();
        }
        catch { connection.Close(); throw; }
    }

    public override async Task ConnectionOpenedAsync(DbConnection connection, ConnectionEndEventData eventData,
        CancellationToken cancellationToken = default)
    {
        try
        {
            await using var command = CreateCommand(connection);
            await command.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false);
            cancellationToken.ThrowIfCancellationRequested();
        }
        catch { await connection.CloseAsync().ConfigureAwait(false); throw; }
    }

    private DbCommand CreateCommand(DbConnection connection)
    {
        var command = connection.CreateCommand();
        command.CommandTimeout = _timeout;
        command.CommandText = """
            EXEC sys.sp_set_session_context @key=N'TenantId', @value=@tenant, @read_only=1;
            DECLARE @policy int = (
                SELECT object_id FROM sys.security_policies
                WHERE schema_id=SCHEMA_ID(@schema) AND name=N'TenantIsolationPolicy' AND is_enabled=1);
            IF @policy IS NULL
                THROW 51001, 'Tenant row security is not installed or enabled.', 1;
            IF EXISTS (
                SELECT 1 FROM sys.tables t
                WHERE t.schema_id=SCHEMA_ID(@schema)
                  AND EXISTS (SELECT 1 FROM sys.columns c WHERE c.object_id=t.object_id AND c.name=N'TenantId')
                  AND (
                    NOT EXISTS (SELECT 1 FROM sys.security_predicates p WHERE p.object_id=@policy
                      AND p.target_object_id=t.object_id AND p.predicate_type=0)
                    OR NOT EXISTS (SELECT 1 FROM sys.security_predicates p WHERE p.object_id=@policy
                      AND p.target_object_id=t.object_id AND p.predicate_type=1 AND p.operation=1)
                    OR NOT EXISTS (SELECT 1 FROM sys.security_predicates p WHERE p.object_id=@policy
                      AND p.target_object_id=t.object_id AND p.predicate_type=1 AND p.operation=2)))
                THROW 51002, 'Tenant row security is incomplete.', 1;
            """;
        var parameter = command.CreateParameter();
        parameter.ParameterName = "@tenant";
        parameter.DbType = DbType.Guid;
        parameter.Value = _tenantId;
        command.Parameters.Add(parameter);
        var schemaParameter = command.CreateParameter();
        schemaParameter.ParameterName = "@schema";
        schemaParameter.DbType = DbType.String;
        schemaParameter.Size = 128;
        schemaParameter.Value = _schema;
        command.Parameters.Add(schemaParameter);
        return command;
    }
}
