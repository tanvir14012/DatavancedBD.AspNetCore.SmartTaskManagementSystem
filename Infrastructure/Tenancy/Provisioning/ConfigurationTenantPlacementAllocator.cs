using Application.Tenancy;
using Microsoft.Extensions.Configuration;

namespace Infrastructure.Tenancy.Provisioning;

/// <summary>Reads an administrator-selected placement template from deployment configuration.</summary>
public sealed class ConfigurationTenantPlacementAllocator(IConfiguration configuration) : ITenantPlacementAllocator
{
    public Task<TenantPlacement> AllocateAsync(Guid tenantId, TenantIsolation isolation, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var section = configuration.GetSection($"Saas:Provisioning:Defaults:{isolation}");
        var targetId = section["TargetId"] ?? throw new InvalidOperationException("Provisioning target is not configured.");
        var region = section["Region"] ?? throw new InvalidOperationException("Provisioning region is not configured.");
        var schema = isolation == TenantIsolation.Schema
            ? section["Schema"] ?? throw new InvalidOperationException("Provisioning schema is not configured.")
            : null;
        var placement = new TenantPlacement(tenantId, isolation, targetId, schema, region, 1,
            TenantLifecycle.Provisioning);
        return Task.FromResult(placement);
    }
}
