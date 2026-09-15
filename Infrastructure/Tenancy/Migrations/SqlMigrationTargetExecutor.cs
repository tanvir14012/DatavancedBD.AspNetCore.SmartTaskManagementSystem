using Application.Tenancy;
using Infrastructure.Data.EfCore.Persistence;
using Infrastructure.Tenancy.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Tenancy.Migrations;

/// <summary>Applies the application EF baseline and installs row-security objects for row targets.</summary>
public sealed class SqlMigrationTargetExecutor(ITenantStorageTargetProvider targets) : IMigrationTargetExecutor
{
    public async Task ExecuteAsync(MigrationTarget target, CancellationToken cancellationToken)
    {
        var physical = await targets.ResolveAsync(target.TargetId, cancellationToken).ConfigureAwait(false);
        Validate(target, physical);
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlServer(physical.ConnectionString, sql =>
            {
                sql.CommandTimeout(physical.CommandTimeoutSeconds);
                sql.MigrationsHistoryTable("__EFMigrationsHistory", physical.Schema);
            })
            .Options;

        await using var db = new AppDbContext(options, physical.Schema);
        await db.Database.MigrateAsync(cancellationToken).ConfigureAwait(false);
        cancellationToken.ThrowIfCancellationRequested();

        if (target.Isolation == TenantIsolation.Row)
        {
            // Build the tenant model solely to derive the table contract. The Admin connection
            // never uses this fake tenant context for application reads or writes.
            var modelContext = new TenantContext(
                new TenantPlacement(Guid.NewGuid(), TenantIsolation.Row, physical.TargetId, null,
                    physical.Region, 1, TenantLifecycle.Active),
                "admin-migration", "admin-migration");
            await using var tenantModel = new AppDbContext(options, modelContext, physical.Schema);
            var script = TenantRowSecurityScript.Create(tenantModel.Model, physical.Schema);
            await using var command = db.Database.GetDbConnection().CreateCommand();
            command.CommandText = script;
            command.CommandTimeout = physical.CommandTimeoutSeconds;
            if (command.Connection!.State != System.Data.ConnectionState.Open)
                await command.Connection.OpenAsync(cancellationToken).ConfigureAwait(false);
            await command.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false);
        }
    }

    private static void Validate(MigrationTarget target, TenantStorageTarget physical)
    {
        if (physical.TargetId != target.TargetId || physical.Isolation != target.Isolation ||
            (target.Schema is not null && physical.Schema != target.Schema))
            throw new InvalidOperationException("Migration target does not match deployment configuration.");
    }
}
