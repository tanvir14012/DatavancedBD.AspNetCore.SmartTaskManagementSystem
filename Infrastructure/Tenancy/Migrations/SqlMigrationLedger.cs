using Application.Tenancy;
using Infrastructure.Tenancy.Persistence;
using Microsoft.Data.SqlClient;

namespace Infrastructure.Tenancy.Migrations;

/// <summary>Stores target completion state in the target database with parameterized SQL.</summary>
public sealed class SqlMigrationLedger(ITenantStorageTargetProvider targets) : IMigrationLedger
{
    private const string TableName = "[dbo].[__SaasMigrationLedger]";

    public async Task<bool> IsAppliedAsync(MigrationTarget target, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(target, cancellationToken).ConfigureAwait(false);
        await EnsureTableAsync(connection, cancellationToken).ConfigureAwait(false);
        await using var command = connection.CreateCommand();
        command.CommandText = $"SELECT 1 FROM {TableName} WHERE TargetId=@target AND SchemaName=@schema AND Isolation=@isolation;";
        AddParameters(command, target);
        return await command.ExecuteScalarAsync(cancellationToken).ConfigureAwait(false) is not null;
    }

    public async Task RecordAppliedAsync(MigrationTarget target, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(target, cancellationToken).ConfigureAwait(false);
        await EnsureTableAsync(connection, cancellationToken).ConfigureAwait(false);
        await using var command = connection.CreateCommand();
        command.CommandText = $"""
            INSERT INTO {TableName}(TargetId, SchemaName, Isolation, AppliedAtUtc)
            SELECT @target, @schema, @isolation, SYSUTCDATETIME()
            WHERE NOT EXISTS (SELECT 1 FROM {TableName} WHERE TargetId=@target AND SchemaName=@schema AND Isolation=@isolation);
            """;
        AddParameters(command, target);
        await command.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false);
    }

    private async Task<SqlConnection> OpenAsync(MigrationTarget target, CancellationToken cancellationToken)
    {
        var physical = await targets.ResolveAsync(target.TargetId, cancellationToken).ConfigureAwait(false);
        if (physical.Isolation != target.Isolation || (target.Schema is not null && physical.Schema != target.Schema))
            throw new InvalidOperationException("Migration target does not match deployment configuration.");
        var connection = new SqlConnection(physical.ConnectionString);
        try
        {
            await connection.OpenAsync(cancellationToken).ConfigureAwait(false);
            return connection;
        }
        catch
        {
            await connection.DisposeAsync().ConfigureAwait(false);
            throw;
        }
    }

    private static async Task EnsureTableAsync(SqlConnection connection, CancellationToken cancellationToken)
    {
        await using var command = connection.CreateCommand();
        command.CommandText = $"""
            IF OBJECT_ID(N'{TableName.Replace("'", "''", StringComparison.Ordinal)}', N'U') IS NULL
            BEGIN
                CREATE TABLE {TableName} (
                    TargetId nvarchar(128) NOT NULL,
                    SchemaName nvarchar(128) NOT NULL,
                    Isolation tinyint NOT NULL,
                    AppliedAtUtc datetime2(7) NOT NULL,
                    CONSTRAINT PK___SaasMigrationLedger PRIMARY KEY (TargetId, SchemaName, Isolation)
                );
            END
            """;
        await command.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false);
    }

    private static void AddParameters(SqlCommand command, MigrationTarget target)
    {
        command.Parameters.Add("@target", System.Data.SqlDbType.NVarChar, 128).Value = target.TargetId;
        command.Parameters.Add("@schema", System.Data.SqlDbType.NVarChar, 128).Value = target.Schema ?? string.Empty;
        command.Parameters.Add("@isolation", System.Data.SqlDbType.TinyInt).Value = (byte)target.Isolation;
    }
}
