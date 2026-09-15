using Application.Tenancy;
using Infrastructure.Tenancy.Migrations;
using Infrastructure.Tenancy.Persistence;
using Microsoft.Data.SqlClient;

namespace Infrastructure.Tenancy.Provisioning;

/// <summary>Runs the reviewed target migration and validates connectivity before activation.</summary>
public sealed class SqlTenantProvisioningExecutor(
    ITenantStorageTargetProvider targets,
    IMigrationTargetExecutor migrations) : ITenantProvisioningExecutor
{
    public Task ExecuteAsync(TenantPlacement placement, CancellationToken cancellationToken)
        => migrations.ExecuteAsync(
            new MigrationTarget(placement.TargetId,
                placement.Isolation == TenantIsolation.Schema ? placement.Schema : null,
                placement.Isolation), cancellationToken);

    public async Task ValidateAsync(TenantPlacement placement, CancellationToken cancellationToken)
    {
        var target = await targets.ResolveAsync(placement.TargetId, cancellationToken).ConfigureAwait(false);
        if (target.Region != placement.Region || target.Isolation != placement.Isolation ||
            (placement.Isolation == TenantIsolation.Schema && target.Schema != placement.Schema))
            throw new InvalidOperationException("Provisioning placement does not match its backing target.");

        await using var connection = new SqlConnection(target.ConnectionString);
        await connection.OpenAsync(cancellationToken).ConfigureAwait(false);
        await using var command = connection.CreateCommand();
        command.CommandText = "SELECT 1;";
        command.CommandTimeout = target.CommandTimeoutSeconds;
        if (await command.ExecuteScalarAsync(cancellationToken).ConfigureAwait(false) is not 1)
            throw new InvalidOperationException("Provisioning connectivity validation failed.");
    }
}
