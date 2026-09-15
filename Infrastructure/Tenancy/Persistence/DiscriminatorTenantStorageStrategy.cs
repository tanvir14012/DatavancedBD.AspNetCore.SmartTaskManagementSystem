using Application.Tenancy;
using Infrastructure.Data.EfCore.Persistence;
namespace Infrastructure.Tenancy.Persistence;

/// <summary>Creates a fresh row-isolated context through validated target resolution.</summary>
public sealed class DiscriminatorTenantStorageStrategy(TenantStorageContextFactory factory) : ITenantStorageStrategy
{
    public TenantIsolation Isolation => TenantIsolation.Row;
    public Task<AppDbContext> CreateContextAsync(TenantContext context, CancellationToken cancellationToken)
        => factory.CreateAsync(context, Isolation, cancellationToken);
}
