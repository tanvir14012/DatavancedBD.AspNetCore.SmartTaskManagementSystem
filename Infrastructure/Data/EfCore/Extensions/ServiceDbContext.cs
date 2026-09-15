using Domain;
using Domain.Interfaces;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace Infrastructure.Data.EfCore.Extensions;

/// <summary>
/// Base DbContext that applies schema isolation and common conventions.
/// Each service DbContext inherits from this and passes its own schema name.
/// </summary>
public abstract class ServiceDbContext(DbContextOptions options, string schema) : IdentityDbContext<AppUser, AppRole, int>(options)
{
    protected readonly string Schema = schema;
    protected virtual bool IncludeModelSeeds => true;

    protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
    {
        base.ConfigureConventions(configurationBuilder);
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        // This application uses the original Identity schema and has no passkey feature.
        // .NET 10 exposes UserPasskeys as a DbSet even when schema v1 is selected.
        if (modelBuilder.Model.FindEntityType(typeof(IdentityUserPasskey<int>))?.FindPrimaryKey() == null)
        {
            modelBuilder.Ignore<IdentityUserPasskey<int>>();
            modelBuilder.Ignore<IdentityPasskeyData>();
        }
        modelBuilder.HasDefaultSchema(Schema);
        modelBuilder.ApplyConfigurationsFromAssembly(GetType().Assembly,
            type => type != typeof(Infrastructure.Data.EfCore.Persistence.EntityTypeConfigurations.MenuItemConfig));
        modelBuilder.ApplyConfiguration(new Infrastructure.Data.EfCore.Persistence.EntityTypeConfigurations.MenuItemConfig(IncludeModelSeeds));
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
        => SaveChangesAsync(true, cancellationToken);

    public override Task<int> SaveChangesAsync(bool acceptAllChangesOnSuccess, CancellationToken cancellationToken = default)
    {
        StampAuditFields();
        return base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);
    }

    public override int SaveChanges() => SaveChanges(true);

    public override int SaveChanges(bool acceptAllChangesOnSuccess)
    {
        StampAuditFields();
        return base.SaveChanges(acceptAllChangesOnSuccess);
    }

    private void StampAuditFields()
    {
        var actorId = AuditActorContext.ActorId;
        var now = DateTime.UtcNow;

        foreach (var entry in ChangeTracker.Entries())
        {
            if (entry.Entity is IAuditable auditable)
            {
                if (entry.State == EntityState.Added)
                {
                    auditable.CreatedAt = now;
                    if (actorId.HasValue)
                        auditable.CreatedById = actorId.Value;
                }
                else if (entry.State == EntityState.Modified)
                {
                    auditable.UpdatedAt = now;
                    if (actorId.HasValue)
                        auditable.UpdatedById = actorId.Value;
                }
            }
        }
    }
}


public static class AuditActorContext
{
    private static readonly AsyncLocal<int?> CurrentActorId = new();

    public static int? ActorId => CurrentActorId.Value;

    public static IDisposable Use(int? actorId)
    {
        var previous = CurrentActorId.Value;
        CurrentActorId.Value = actorId;
        return new RestoreScope(() => CurrentActorId.Value = previous);
    }

    private sealed class RestoreScope(Action restore) : IDisposable
    {
        private readonly Action _restore = restore;
        private bool _disposed;

        public void Dispose()
        {
            if (_disposed)
                return;

            _restore();
            _disposed = true;
        }
    }
}

public static class DbContextServiceExtensions
{
    public static IServiceCollection AddServiceDbContext<TContext>(
        this IServiceCollection services,
        string connectionString,
        string schema)
        where TContext : ServiceDbContext
    {
        services.AddEntityFrameworkCaching();

        services.AddDbContext<TContext>((serviceProvider, options) =>
        {
            options.UseSqlServer(connectionString, sql =>
            {
                sql.MigrationsHistoryTable("__EFMigrationsHistory", schema);
                sql.EnableRetryOnFailure(3);

                var env = serviceProvider.GetRequiredService<IHostEnvironment>();
                if (env.IsDevelopment())
                {
                    options.EnableSensitiveDataLogging();
                    options.EnableDetailedErrors();
                }
            });

            var interceptors = serviceProvider.GetServices<IInterceptor>().ToArray();
            if (interceptors.Length > 0)
                options.AddInterceptors(interceptors);
        });

        return services;
    }
}
