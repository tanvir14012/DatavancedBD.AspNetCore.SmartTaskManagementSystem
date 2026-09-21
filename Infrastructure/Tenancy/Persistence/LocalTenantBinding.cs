using Application.Tenancy;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Infrastructure.Data.EfCore.Persistence;

namespace Infrastructure.Tenancy.Persistence;

/// <summary>Explicit, server-owned placement for the local Docker acceptance environment.</summary>
public sealed class LocalTenantBinding : ITenantContextAccessor
{
    public LocalTenantBinding(IConfiguration configuration)
    {
        if (configuration["ASPNETCORE_ENVIRONMENT"] != "LocalDocker")
            throw new InvalidOperationException("Local tenant binding requires LocalDocker.");
        var section = configuration.GetSection("LocalTenant");
        var isolation = Enum.Parse<TenantIsolation>(section["Isolation"]!);
        Schema = section["Schema"] ?? "dbo";
        var placement = new TenantPlacement(Guid.Parse(section["Id"]!), isolation,
            section["Target"]!, isolation == TenantIsolation.Schema ? Schema : null,
            "local", 1, TenantLifecycle.Active);
        Current = new TenantContext(placement, "local-deployment", "local-deployment");
        ConnectionString = configuration.GetConnectionString("DefaultConnection")!;
    }

    public TenantContext Current { get; }
    public string Schema { get; }
    public string ConnectionString { get; }

    public AppDbContext CreateContext(bool enforceRowSecurity = true)
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlServer(ConnectionString, sql => sql.CommandTimeout(60));
        if (enforceRowSecurity && Current.Placement.Isolation == TenantIsolation.Row)
            options.AddInterceptors(new TenantSqlSessionInterceptor(Current.Placement.TenantId, Schema, 60));
        return new AppDbContext(options.Options, Current, Schema);
    }
}
