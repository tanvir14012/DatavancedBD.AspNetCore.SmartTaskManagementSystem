using Application.Tenancy;
using Infrastructure.Data.EfCore.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace Infrastructure.Tenancy.Persistence;

/// <summary>Creates fresh unpooled EF contexts while SQL Client pools connections by backing target.</summary>
public sealed class TenantStorageContextFactory(ITenantStorageTargetProvider targets)
{
    public async Task<AppDbContext> CreateAsync(TenantContext context, TenantIsolation expectedIsolation,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(context);
        cancellationToken.ThrowIfCancellationRequested();
        var placement = context.Placement;
        if (placement.Isolation != expectedIsolation)
            throw new InvalidOperationException("Storage strategy does not match the authorized placement.");
        var target = await targets.ResolveAsync(placement.TargetId, cancellationToken).ConfigureAwait(false);
        cancellationToken.ThrowIfCancellationRequested();
        if (target.TargetId != placement.TargetId || target.Region != placement.Region || target.Isolation != placement.Isolation)
            throw new InvalidOperationException("Backing target does not match the authorized placement.");
        var schema = placement.Isolation == TenantIsolation.Schema ? placement.Schema! : target.Schema;
        var optionsBuilder = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlServer(target.ConnectionString, sql =>
            {
                sql.CommandTimeout(target.CommandTimeoutSeconds);
                sql.MigrationsHistoryTable("__EFMigrationsHistory", schema);
            })
            .ReplaceService<IModelCacheKeyFactory, TenantModelCacheKeyFactory>();
        // Database and schema isolation are enforced by the backing boundary itself. RLS is
        // required only for the shared-row tier; installing the session interceptor elsewhere
        // would incorrectly reject a healthy dedicated target with no policy objects.
        if (placement.Isolation == TenantIsolation.Row)
            optionsBuilder.AddInterceptors(new TenantSqlSessionInterceptor(
                placement.TenantId, schema, target.CommandTimeoutSeconds));
        return new AppDbContext(optionsBuilder.Options, context, schema);
    }
}

/// <summary>Uses only the immutable context already authorized for this DI scope.</summary>
public sealed class TenantDbContextFactory(ITenantContextAccessor context, TenantStorageContextFactory factory)
{
    public Task<AppDbContext> CreateAsync(CancellationToken cancellationToken = default)
        => factory.CreateAsync(context.Current, context.Current.Placement.Isolation, cancellationToken);
}

public static class TenantStorageRegistration
{
    /// <summary>Registers explicit factories; legacy Identity and endpoints require a separate cutover.</summary>
    public static IServiceCollection AddTenantStorage(this IServiceCollection services)
    {
        services.TryAddSingleton<ITenantStorageTargetProvider, ConfigurationTenantStorageTargetProvider>();
        services.TryAddScoped<TenantStorageContextFactory>();
        services.TryAddScoped<TenantDbContextFactory>();
        services.TryAddEnumerable(ServiceDescriptor.Scoped<ITenantStorageStrategy, DatabaseTenantStorageStrategy>());
        services.TryAddEnumerable(ServiceDescriptor.Scoped<ITenantStorageStrategy, SchemaTenantStorageStrategy>());
        services.TryAddEnumerable(ServiceDescriptor.Scoped<ITenantStorageStrategy, DiscriminatorTenantStorageStrategy>());
        return services;
    }
}
