using Application.Tenancy;
using Infrastructure.Data.EfCore.Persistence;
namespace Infrastructure.Tenancy.Persistence;

// TODO(SAAS-03): Inject target resolution and EF options construction; enforce tenant ownership.
// TODO(SAAS-03): Canonicalize target connections and budget pools across replicas.
public sealed class DatabaseTenantStorageStrategy : ITenantStorageStrategy
{
    public TenantIsolation Isolation => TenantIsolation.Database;
    public Task<AppDbContext> CreateContextAsync(TenantContext context, CancellationToken cancellationToken)
        => throw new NotImplementedException("TODO(SAAS-03): Database persistence.");
}
