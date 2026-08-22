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
            await db.Database.MigrateAsync(cancellationToken);
            logger.LogInformation("Migrations for {DbContext} applied successfully.", typeof(TDbContext).Name);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to apply migrations for {DbContext}.", typeof(TDbContext).Name);
            throw;
        }
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}

