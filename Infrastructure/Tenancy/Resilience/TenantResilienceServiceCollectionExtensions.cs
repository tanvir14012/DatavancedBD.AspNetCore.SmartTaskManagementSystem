using Application.Tenancy;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace Infrastructure.Tenancy.Resilience;

public static class TenantResilienceServiceCollectionExtensions
{
    /// <summary>Registers bounded local admission; queue, quota and breaker adapters remain explicit.</summary>
    public static IServiceCollection AddTenantResilience(this IServiceCollection services, IConfiguration? configuration = null)
    {
        if (configuration is not null)
            services.Configure<TenantAdmissionOptions>(configuration.GetSection(TenantAdmissionOptions.SectionName));

        services.TryAddSingleton<TenantAdmissionPolicy>();
        services.TryAddSingleton<ITenantAdmissionPolicy>(sp => sp.GetRequiredService<TenantAdmissionPolicy>());
        services.TryAddSingleton<ITenantWorkAdmission>(sp => sp.GetRequiredService<TenantAdmissionPolicy>());
        services.TryAddSingleton<InMemoryTenantJobDeduplicator>();
        services.TryAddSingleton<ITenantJobDeduplicator>(sp => sp.GetRequiredService<InMemoryTenantJobDeduplicator>());
        return services;
    }
}
