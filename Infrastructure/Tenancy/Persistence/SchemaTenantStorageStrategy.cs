using Application.Tenancy;
using Infrastructure.Data.EfCore.Persistence;
namespace Infrastructure.Tenancy.Persistence;

// TODO(SAAS-03): Inject target resolution and EF options construction; enforce tenant ownership.
// TODO(SAAS-03): Include schema in model-cache identity; handle schema-aware migrations explicitly.
public sealed class SchemaTenantStorageStrategy : ITenantStorageStrategy
{
    public TenantIsolation Isolation => TenantIsolation.Schema;
    public Task<AppDbContext> CreateContextAsync(TenantContext context, CancellationToken cancellationToken)
        => throw new NotImplementedException("TODO(SAAS-03): Schema persistence.");
}
