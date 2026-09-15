using Application.Tenancy;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace Infrastructure.Tenancy.Migrations;

public static class TenantMigrationServiceCollectionExtensions
{
    public static IServiceCollection AddTenantMigrations(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<TenantMigrationOptions>(configuration.GetSection(TenantMigrationOptions.SectionName));
        services.TryAddSingleton<IMigrationTargetSource, ConfigurationMigrationTargetSource>();
        services.TryAddSingleton<IMigrationTargetLockProvider, SqlMigrationTargetLockProvider>();
        services.TryAddSingleton<IMigrationTargetExecutor, SqlMigrationTargetExecutor>();
        services.TryAddSingleton<IMigrationLedger, SqlMigrationLedger>();
        services.TryAddSingleton<ITenantMigrationRunner, TenantMigrationRunner>();
        return services;
    }
}
