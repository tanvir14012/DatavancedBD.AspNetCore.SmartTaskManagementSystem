using Application.Tenancy;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace Infrastructure.Tenancy.Provisioning;

public static class TenantProvisioningServiceCollectionExtensions
{
    public static IServiceCollection AddTenantProvisioning(this IServiceCollection services)
    {
        services.TryAddSingleton<ITenantPlacementAllocator, ConfigurationTenantPlacementAllocator>();
        services.TryAddSingleton<ITenantProvisioningLockProvider, InProcessTenantProvisioningLockProvider>();
        services.TryAddSingleton<ITenantProvisioningExecutor, SqlTenantProvisioningExecutor>();
        services.TryAddSingleton<ITenantProvisioner, TenantProvisioner>();
        return services;
    }
}
