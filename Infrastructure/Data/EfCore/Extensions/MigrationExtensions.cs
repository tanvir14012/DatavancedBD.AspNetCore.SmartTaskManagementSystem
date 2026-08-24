using Infrastructure.Data.EfCore.Persistence.Seeding;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Infrastructure.Data.EfCore.Extensions;

public static class MigrationExtensions
{
    public static async Task ApplyMigrationsAsync<TDbContext>(
        this IServiceProvider serviceProvider,
        CancellationToken cancellationToken = default)
        where TDbContext : DbContext
    {
        using var scope = serviceProvider.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<TDbContext>();
        await dbContext.Database.MigrateAsync(cancellationToken).ConfigureAwait(false);
    }

    /// <summary>
    /// Registers a hosted service that automatically applies EF Core migrations at startup.
    /// </summary>
    public static IServiceCollection AddAutoMigrations<TDbContext>(this IServiceCollection services)
        where TDbContext : DbContext
    {
        services.AddHostedService<MigrationHostedService<TDbContext>>();
        return services;
    }
}

public sealed class MigrationHostedService<TDbContext>(
    IServiceScopeFactory scopeFactory,
    ILogger<MigrationHostedService<TDbContext>> logger)
    : IHostedService
    where TDbContext : DbContext
{
    public async Task StartAsync(CancellationToken cancellationToken)
    {
        logger.LogInformation("Applying EF Core migrations for {DbContext}…", typeof(TDbContext).Name);
        try
        {
            using var scope = scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<TDbContext>();
            var pendingMigrations = await db.Database.GetPendingMigrationsAsync(cancellationToken);
            if (pendingMigrations.Any())
            {
                logger.LogInformation("Applying {MigrationCount} pending migrations for {DbContext}...", pendingMigrations.Count(), typeof(TDbContext).Name);
                await db.Database.MigrateAsync(cancellationToken);
                logger.LogInformation("Migrations for {DbContext} applied successfully.", typeof(TDbContext).Name);
            }
            else
            {
                logger.LogInformation("No pending migrations for {DbContext}.", typeof(TDbContext).Name);
            }

            int retries = 5;
            while (retries > 0 && !await db.Database.CanConnectAsync(cancellationToken))
            {
                await Task.Delay(1000, cancellationToken);
                retries--;
            }

            // 3. Call Seed Extensions directly
            logger.LogInformation("Starting database seeding for {DbContext}...", typeof(TDbContext).Name);
            await scope.ServiceProvider.SeedRolesAndAdminAsync();
            await scope.ServiceProvider.SeedProjectsAndTasksAsync();
            logger.LogInformation("Database seeding completed successfully.");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to apply migrations for {DbContext}.", typeof(TDbContext).Name);
            throw;
        }
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}

