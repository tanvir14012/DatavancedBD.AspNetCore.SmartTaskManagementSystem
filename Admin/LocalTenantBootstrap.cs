using Domain;
using Infrastructure.Data.EfCore.Persistence.EntityTypeConfigurations;
using Infrastructure.Tenancy.Persistence;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Application.Tenancy;

internal static class LocalTenantBootstrap
{
    // Only for new local acceptance databases, never an upgrade path for existing production data.
    public static async Task RunAsync(IConfiguration configuration, CancellationToken token)
    {
        var binding = new LocalTenantBinding(configuration);
        var connection = new SqlConnectionStringBuilder(binding.ConnectionString);
        var database = connection.InitialCatalog;
        if (!database.StartsWith("StmsLocal", StringComparison.Ordinal))
            throw new InvalidOperationException("Local bootstrap requires a StmsLocal database.");
        connection.InitialCatalog = "master";
        await using (var master = new SqlConnection(connection.ConnectionString))
        {
            await master.OpenAsync(token);
            await using var create = master.CreateCommand();
            create.CommandText = "IF DB_ID(@name) IS NULL BEGIN DECLARE @sql nvarchar(max) = N'CREATE DATABASE ' + QUOTENAME(@name); EXEC(@sql); END;";
            create.Parameters.AddWithValue("@name", database);
            await create.ExecuteNonQueryAsync(token);
        }
        await using (var admin = binding.CreateContext(enforceRowSecurity: false))
        {
            await admin.Database.OpenConnectionAsync(token);
            await using var probe = admin.Database.GetDbConnection().CreateCommand();
            probe.CommandText = "SELECT COUNT(*) FROM sys.tables WHERE schema_id = SCHEMA_ID(@schema)";
            var schema = probe.CreateParameter();
            schema.ParameterName = "@schema";
            schema.Value = binding.Schema;
            probe.Parameters.Add(schema);
            if (Convert.ToInt32(await probe.ExecuteScalarAsync(token)) == 0)
            {
                await using var transaction = await admin.Database.BeginTransactionAsync(token);
                // Generate the composite-key tenant model, not the legacy hard-coded migrations.
                var script = admin.Database.GenerateCreateScript();
                foreach (var batch in System.Text.RegularExpressions.Regex.Split(script, @"^GO\s*$",
                             System.Text.RegularExpressions.RegexOptions.Multiline))
                    if (!string.IsNullOrWhiteSpace(batch))
                        await admin.Database.ExecuteSqlRawAsync(batch, token);
                await transaction.CommitAsync(token);
            }
            if (binding.Current.Placement.Isolation == TenantIsolation.Row)
                await admin.Database.ExecuteSqlRawAsync(TenantRowSecurityScript.Create(admin.Model, binding.Schema), token);
        }
        await using var db = binding.CreateContext();
        if (!await db.MenuItems.AnyAsync(token))
        {
            var menus = MenuItemConfig.GetSeedMenuItems().ToDictionary(m => m.Id);
            foreach (var menu in menus.Values)
            {
                if (menu.ParentId is int parent) menu.Parent = menus[parent];
                menu.ParentId = null;
                menu.Id = 0;
            }
            db.MenuItems.AddRange(menus.Values);
            await db.SaveChangesAsync(token);
        }
        Console.WriteLine($"Local tenant {binding.Current.Placement.TenantId:D}: {database}/{binding.Schema} ready.");
    }
}
