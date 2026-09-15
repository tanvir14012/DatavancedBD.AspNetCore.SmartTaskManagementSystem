using Application.Tenancy;
using Infrastructure.Data.EfCore.Persistence;
namespace Infrastructure.Tenancy.Persistence;

/// <summary>Creates a fresh database-isolated context through validated target resolution.</summary>
public sealed class DatabaseTenantStorageStrategy(TenantStorageContextFactory factory) : ITenantStorageStrategy
{
    public TenantIsolation Isolation => TenantIsolation.Database;
    public Task<AppDbContext> CreateContextAsync(TenantContext context, CancellationToken cancellationToken)
        => factory.CreateAsync(context, Isolation, cancellationToken);
}
