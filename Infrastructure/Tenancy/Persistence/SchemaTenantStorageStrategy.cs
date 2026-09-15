using Application.Tenancy;
using Infrastructure.Data.EfCore.Persistence;
namespace Infrastructure.Tenancy.Persistence;

/// <summary>Creates a fresh schema-isolated context through validated target resolution.</summary>
public sealed class SchemaTenantStorageStrategy(TenantStorageContextFactory factory) : ITenantStorageStrategy
{
    public TenantIsolation Isolation => TenantIsolation.Schema;
    public Task<AppDbContext> CreateContextAsync(TenantContext context, CancellationToken cancellationToken)
        => factory.CreateAsync(context, Isolation, cancellationToken);
}
