using Application.Tenancy;
using Application.Tenancy.Authorization;
using Infrastructure.Tenancy.Authorization;
using Infrastructure.Tenancy.Catalog;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace Infrastructure.Tenancy.Resilience;

public static class TenantWorkerServiceCollectionExtensions
{
    public static IServiceCollection AddTenantWorker(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddTenantCatalog(configuration);
        services.AddTenantResilience(configuration);
        services.TryAddSingleton<ChannelTenantJobQueue>();
        services.TryAddSingleton<ITenantJobQueue>(sp => sp.GetRequiredService<ChannelTenantJobQueue>());
        services.TryAddScoped<TenantContextScope>();
        services.TryAddScoped<ITenantContextAccessor>(sp => sp.GetRequiredService<TenantContextScope>());
        services.TryAddScoped<ITenantContextInitializer>(sp => sp.GetRequiredService<TenantContextScope>());
        services.TryAddScoped<ITenantMembershipReader, SqlTenantMembershipReader>();
        services.TryAddScoped<ITenantAccessValidator, TenantAccessValidator>();
        services.TryAddScoped<TenantContextAuthorizer>();
        services.TryAddSingleton<TenantWorker>();
        return services;
    }
}
