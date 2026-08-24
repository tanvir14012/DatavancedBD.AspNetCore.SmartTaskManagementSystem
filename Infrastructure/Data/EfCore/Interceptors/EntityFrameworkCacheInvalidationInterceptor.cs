using Application.Interfaces;
using Infrastructure.Data.EfCore.Options;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Infrastructure.Data.EfCore.Interceptors;

public sealed class EntityFrameworkCacheInvalidationInterceptor(
    ICacheService cacheService,
    IOptions<EntityFrameworkCachingOptions> options,
    ILogger<EntityFrameworkCacheInvalidationInterceptor> logger) : SaveChangesInterceptor
{
    private readonly ICacheService _cacheService = cacheService;
    private readonly EntityFrameworkCachingOptions _options = options.Value;
    private readonly ILogger<EntityFrameworkCacheInvalidationInterceptor> _logger = logger;
    private readonly Dictionary<Guid, HashSet<string>> _pendingInvalidations = new();
    private readonly Lock _lock = new();

    public override InterceptionResult<int> SavingChanges(
        DbContextEventData eventData,
        InterceptionResult<int> result)
    {
        CaptureEntities(eventData.Context);
        return base.SavingChanges(eventData, result);
    }

    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
        DbContextEventData eventData,
        InterceptionResult<int> result,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        CaptureEntities(eventData.Context);
        return base.SavingChangesAsync(eventData, result, cancellationToken);
    }

    public override int SavedChanges(SaveChangesCompletedEventData eventData, int result)
    {
        InvalidateCapturedPatterns(eventData.Context, CancellationToken.None).GetAwaiter().GetResult();
        return base.SavedChanges(eventData, result);
    }

    public override async ValueTask<int> SavedChangesAsync(
        SaveChangesCompletedEventData eventData,
        int result,
        CancellationToken cancellationToken = default)
    {
        await InvalidateCapturedPatterns(eventData.Context, cancellationToken).ConfigureAwait(false);
        return await base.SavedChangesAsync(eventData, result, cancellationToken).ConfigureAwait(false);
    }

    public override void SaveChangesFailed(DbContextErrorEventData eventData)
    {
        ClearContext(eventData.Context);
        base.SaveChangesFailed(eventData);
    }

    public override Task SaveChangesFailedAsync(
        DbContextErrorEventData eventData,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        ClearContext(eventData.Context);
        return base.SaveChangesFailedAsync(eventData, cancellationToken);
    }

    private void CaptureEntities(DbContext? dbContext)
    {
        if (dbContext is null)
            return;

        var changedEntities = dbContext.ChangeTracker
            .Entries()
            .Where(static entry =>
                entry.State is EntityState.Added or EntityState.Modified or EntityState.Deleted)
            .Select(static entry => entry.Entity.GetType().Name)
            .ToHashSet(StringComparer.Ordinal);

        if (changedEntities.Count == 0)
            return;

        lock (_lock)
        {
            _pendingInvalidations[dbContext.ContextId.InstanceId] = changedEntities;
        }
    }

    private async Task InvalidateCapturedPatterns(DbContext? dbContext, CancellationToken cancellationToken)
    {
        if (dbContext is null)
            return;

        HashSet<string>? entityNames;
        lock (_lock)
        {
            _pendingInvalidations.Remove(dbContext.ContextId.InstanceId, out entityNames);
        }

        if (entityNames is null || entityNames.Count == 0)
            return;

        foreach (var entityName in entityNames)
        {
            try
            {
                await _cacheService.RemoveByPatternAsync(
                    $"{_options.KeyNamespace}:{entityName}:*",
                    cancellationToken).ConfigureAwait(false);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to invalidate EF cache for entity {EntityName}.", entityName);
            }
        }
    }

    private void ClearContext(DbContext? dbContext)
    {
        if (dbContext is null)
            return;

        lock (_lock)
        {
            _pendingInvalidations.Remove(dbContext.ContextId.InstanceId);
        }
    }
}
