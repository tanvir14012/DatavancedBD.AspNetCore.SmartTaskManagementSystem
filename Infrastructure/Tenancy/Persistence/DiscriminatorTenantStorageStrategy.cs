using Application.Tenancy;
using Infrastructure.Data.EfCore.Persistence;
namespace Infrastructure.Tenancy.Persistence;

// TODO(SAAS-03): Inject target resolution and EF options construction; enforce tenant ownership.
// TODO(SAAS-03): Compose tenant and soft-delete filters; initialize RLS session context on every connection checkout.
public sealed class DiscriminatorTenantStorageStrategy : ITenantStorageStrategy
{
    public TenantIsolation Isolation => TenantIsolation.Row;
    public Task<AppDbContext> CreateContextAsync(TenantContext context, CancellationToken cancellationToken)
        => throw new NotImplementedException("TODO(SAAS-03): Discriminator persistence.");
}
