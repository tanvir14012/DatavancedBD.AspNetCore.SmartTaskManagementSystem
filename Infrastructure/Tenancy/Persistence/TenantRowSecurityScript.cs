using System.Text;
using Application.Tenancy;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Tenancy.Persistence;

/// <summary>Generates SQL for the Admin release process, never executes DDL in web startup.</summary>
public static class TenantRowSecurityScript
{
    public static string Create(IModel model, string schema)
    {
        ArgumentNullException.ThrowIfNull(model);
        _ = new TenantPlacement(Guid.NewGuid(), TenantIsolation.Schema, "validation", schema, "validation", 1, TenantLifecycle.Active);
        var tables = model.GetEntityTypes().Where(e => e.GetSchema() == schema)
            .Select(e => (Table: e.GetTableName(), Tenant: e.FindProperty("TenantId")))
            .ToArray();
        if (tables.Length == 0 || tables.Any(t => t.Table == null || t.Tenant == null))
            throw new InvalidOperationException("RLS requires a tenant-aware schema model.");
        static string Quote(string name) => "[" + name.Replace("]", "]]") + "]";
        var s = Quote(schema);
        var function = s + ".[TenantAccessPredicate]";
        var policy = s + ".[TenantIsolationPolicy]";
        var sql = new StringBuilder();
        // Deployment runner supplies an exclusive migration lock. The function update and policy
        // rebuild are one transaction; readers never observe a committed unprotected interval.
        sql.AppendLine("SET XACT_ABORT ON; BEGIN TRANSACTION;");
        sql.AppendLine($"IF EXISTS (SELECT 1 FROM sys.security_policies WHERE object_id=OBJECT_ID(N'{schema}.TenantIsolationPolicy')) DROP SECURITY POLICY {policy};");
        var functionSql = $"CREATE OR ALTER FUNCTION {function}(@TenantId uniqueidentifier) RETURNS TABLE WITH SCHEMABINDING AS RETURN SELECT 1 AS Allowed WHERE @TenantId = TRY_CONVERT(uniqueidentifier, SESSION_CONTEXT(N'TenantId'));";
        sql.AppendLine("EXEC(N'" + functionSql.Replace("'", "''") + "');");
        var predicates = tables.Select(t => t.Table!).Distinct(StringComparer.Ordinal).OrderBy(t => t, StringComparer.Ordinal)
            .SelectMany(table =>
            {
                var target = s + "." + Quote(table);
                return new[]
                {
                    $"ADD FILTER PREDICATE {function}([TenantId]) ON {target}",
                    $"ADD BLOCK PREDICATE {function}([TenantId]) ON {target} AFTER INSERT",
                    $"ADD BLOCK PREDICATE {function}([TenantId]) ON {target} AFTER UPDATE"
                };
            });
        sql.AppendLine($"CREATE SECURITY POLICY {policy}");
        sql.AppendLine(string.Join(",\n", predicates));
        sql.AppendLine("WITH (STATE = ON, SCHEMABINDING = ON);");
        sql.AppendLine("COMMIT TRANSACTION;");
        return sql.ToString();
    }
}
