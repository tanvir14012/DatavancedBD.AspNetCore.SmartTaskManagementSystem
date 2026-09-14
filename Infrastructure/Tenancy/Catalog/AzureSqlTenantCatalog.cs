using Application.Tenancy;
namespace Infrastructure.Tenancy.Catalog;

// TODO(SAAS-01): Inject a catalog connection factory; parameterize queries and validate version/status.
// TODO(SAAS-01): Keep catalog reads independent of tenant DbContext resolution.
// Compose this durable adapter inside CachedTenantCatalog; null means absent, not a SQL failure.
public sealed class AzureSqlTenantCatalog : ITenantCatalog
{
    public Task<TenantPlacement?> FindAsync(Guid tenantId, CancellationToken cancellationToken)
        => throw new NotImplementedException("TODO(SAAS-01): Durable tenant catalog.");
}
