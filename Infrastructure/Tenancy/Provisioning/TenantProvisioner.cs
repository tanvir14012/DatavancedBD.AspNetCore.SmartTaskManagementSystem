using Application.Tenancy;
namespace Infrastructure.Tenancy.Provisioning;

// TODO(SAAS-06): Inject allocator, migrator, catalog writer, and retryable cache publication.
// Activate only after validation. Tier changes require data transfer and fenced cutover.
public sealed class TenantProvisioner : ITenantProvisioner
{
    public Task ProvisionAsync(Guid tenantId, TenantIsolation isolation, CancellationToken cancellationToken)
        => throw new NotImplementedException("TODO(SAAS-06): Tenant provisioning.");
}
