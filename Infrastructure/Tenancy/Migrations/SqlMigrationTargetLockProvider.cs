using Application.Tenancy;
using Infrastructure.Tenancy.Persistence;
using Microsoft.Data.SqlClient;

namespace Infrastructure.Tenancy.Migrations;

/// <summary>Uses SQL Server application locks held by the same session as the migration run.</summary>
public sealed class SqlMigrationTargetLockProvider(ITenantStorageTargetProvider targets) : IMigrationTargetLockProvider
{
    public async Task<IAsyncDisposable> AcquireAsync(MigrationTarget target, CancellationToken cancellationToken)
    {
        var physical = await targets.ResolveAsync(target.TargetId, cancellationToken).ConfigureAwait(false);
        if (physical.Isolation != target.Isolation || (target.Schema is not null && physical.Schema != target.Schema))
            throw new InvalidOperationException("Migration target does not match deployment configuration.");

        var connection = new SqlConnection(physical.ConnectionString);
        try
        {
            await connection.OpenAsync(cancellationToken).ConfigureAwait(false);
            await using var command = connection.CreateCommand();
            command.CommandTimeout = physical.CommandTimeoutSeconds;
            command.CommandText = "EXEC @result = sys.sp_getapplock @Resource=@resource, @LockMode=N'Exclusive', @LockOwner=N'Session', @LockTimeout=@timeout;";
            var result = command.Parameters.Add("@result", System.Data.SqlDbType.Int);
            result.Direction = System.Data.ParameterDirection.Output;
            var resource = command.Parameters.Add("@resource", System.Data.SqlDbType.NVarChar, 255);
            resource.Value = ResourceName(target);
            var timeout = command.Parameters.Add("@timeout", System.Data.SqlDbType.Int);
            timeout.Value = checked(physical.CommandTimeoutSeconds * 1000);
            await command.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false);
            if (result.Value is not int status || status < 0)
                throw new TimeoutException("Migration target lock could not be acquired.");
            return new SqlLockLease(connection, physical.CommandTimeoutSeconds, ResourceName(target));
        }
        catch
        {
            await connection.DisposeAsync().ConfigureAwait(false);
            throw;
        }
    }

    private static string ResourceName(MigrationTarget target)
    {
        var value = $"saas-migration:{target.TargetId}:{target.Schema}:{(int)target.Isolation}";
        return value.Length <= 255 ? value : value[..255];
    }

    private sealed class SqlLockLease(SqlConnection connection, int commandTimeoutSeconds, string resourceName) : IAsyncDisposable
    {
        private int _disposed;

        public async ValueTask DisposeAsync()
        {
            if (Interlocked.Exchange(ref _disposed, 1) != 0) return;
            try
            {
                await using var command = connection.CreateCommand();
                command.CommandTimeout = commandTimeoutSeconds;
                command.CommandText = "EXEC sys.sp_releaseapplock @Resource=@resource, @LockOwner=N'Session';";
                var resource = command.Parameters.Add("@resource", System.Data.SqlDbType.NVarChar, 255);
                resource.Value = resourceName;
                await command.ExecuteNonQueryAsync().ConfigureAwait(false);
            }
            finally
            {
                await connection.CloseAsync().ConfigureAwait(false);
                await connection.DisposeAsync().ConfigureAwait(false);
            }
        }
    }
}
