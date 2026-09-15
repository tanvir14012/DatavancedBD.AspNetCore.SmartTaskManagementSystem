using Application.Tenancy;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Infrastructure.Tenancy.Resilience;

public sealed class TenantWorkerOptions
{
    public int MaxInFlightJobs { get; set; } = 32;

    public void Validate()
    {
        if (MaxInFlightJobs is < 1 or > 512)
            throw new ArgumentOutOfRangeException(nameof(MaxInFlightJobs));
    }
}

/// <summary>
/// Consumes tenant jobs with bounded in-flight work, fresh DI scopes, duplicate suppression and
/// placement-version fencing. A stale job is acknowledged as non-retryable and never writes.
/// </summary>
public sealed class TenantWorker
{
    private readonly ITenantJobQueue _queue;
    private readonly ITenantJobDeduplicator _deduplicator;
    private readonly ITenantWorkAdmission _admission;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IAuthoritativeTenantCatalog _catalog;
    private readonly TenantWorkerOptions _options;
    private readonly ILogger<TenantWorker> _logger;

    public TenantWorker(
        ITenantJobQueue queue,
        ITenantJobDeduplicator deduplicator,
        ITenantWorkAdmission admission,
        IServiceScopeFactory scopeFactory,
        IAuthoritativeTenantCatalog catalog,
        IOptions<TenantWorkerOptions>? options = null,
        ILogger<TenantWorker>? logger = null)
    {
        _queue = queue ?? throw new ArgumentNullException(nameof(queue));
        _deduplicator = deduplicator ?? throw new ArgumentNullException(nameof(deduplicator));
        _admission = admission ?? throw new ArgumentNullException(nameof(admission));
        _scopeFactory = scopeFactory ?? throw new ArgumentNullException(nameof(scopeFactory));
        _catalog = catalog ?? throw new ArgumentNullException(nameof(catalog));
        _options = options?.Value ?? new TenantWorkerOptions();
        _options.Validate();
        _logger = logger ?? Microsoft.Extensions.Logging.Abstractions.NullLogger<TenantWorker>.Instance;
    }

    public async Task RunAsync(CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var inFlight = new List<Task>();

        await foreach (var item in _queue.ReadAsync(cancellationToken).WithCancellation(cancellationToken))
        {
            cancellationToken.ThrowIfCancellationRequested();
            if (!await _deduplicator.TryBeginAsync(item.JobId, cancellationToken).ConfigureAwait(false))
            {
                await _queue.CompleteAsync(item, cancellationToken).ConfigureAwait(false);
                continue;
            }

            inFlight.Add(ExecuteAsync(item, cancellationToken));
            if (inFlight.Count >= _options.MaxInFlightJobs)
                await DrainOneAsync(inFlight).ConfigureAwait(false);
        }

        while (inFlight.Count > 0)
            await DrainOneAsync(inFlight).ConfigureAwait(false);
    }

    private async Task ExecuteAsync(TenantWorkItem item, CancellationToken cancellationToken)
    {
        await using var lease = await _admission.AcquireAsync(item.TenantId, item.TargetId, cancellationToken)
            .ConfigureAwait(false);
        if (lease is null)
        {
            await _deduplicator.AbandonAsync(item.JobId, cancellationToken).ConfigureAwait(false);
            await _queue.AbandonAsync(item, retryable: true, cancellationToken).ConfigureAwait(false);
            return;
        }

        try
        {
            var current = await _catalog.FindAsync(item.TenantId, cancellationToken).ConfigureAwait(false);
            cancellationToken.ThrowIfCancellationRequested();
            if (current is null || current.Lifecycle != TenantLifecycle.Active ||
                current.Version != item.PlacementVersion || current.TargetId != item.TargetId ||
                current.Isolation != item.Isolation)
            {
                await _deduplicator.CompleteAsync(item.JobId, cancellationToken).ConfigureAwait(false);
                await _queue.CompleteAsync(item, cancellationToken).ConfigureAwait(false);
                _logger.LogInformation("Rejected stale tenant job {JobId} for organization {TenantId}.",
                    item.JobId, item.TenantId);
                return;
            }

            using var scope = _scopeFactory.CreateScope();
            var authorizer = scope.ServiceProvider.GetRequiredService<Application.Tenancy.Authorization.TenantContextAuthorizer>();
            var context = await authorizer.AuthorizeAsync(item.Access, cancellationToken).ConfigureAwait(false);
            if (context.Placement.Version != item.PlacementVersion || context.Placement.TargetId != item.TargetId)
                throw new InvalidOperationException("Tenant placement changed while the job was starting.");
            scope.ServiceProvider.GetRequiredService<ITenantContextInitializer>().Initialize(context);
            await scope.ServiceProvider.GetRequiredService<ITenantWorkHandler>()
                .HandleAsync(item, cancellationToken).ConfigureAwait(false);

            await _deduplicator.CompleteAsync(item.JobId, cancellationToken).ConfigureAwait(false);
            await _queue.CompleteAsync(item, cancellationToken).ConfigureAwait(false);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            await _deduplicator.AbandonAsync(item.JobId, CancellationToken.None).ConfigureAwait(false);
            await _queue.AbandonAsync(item, retryable: true, CancellationToken.None).ConfigureAwait(false);
            throw;
        }
        catch (Exception error)
        {
            await _deduplicator.AbandonAsync(item.JobId, CancellationToken.None).ConfigureAwait(false);
            try
            {
                await _queue.AbandonAsync(item, retryable: true, CancellationToken.None).ConfigureAwait(false);
            }
            catch (Exception queueError)
            {
                _logger.LogError(queueError, "Failed to return tenant job {JobId} to the queue.", item.JobId);
            }
            _logger.LogError(error, "Tenant job {JobId} failed.", item.JobId);
        }
    }

    private static async Task DrainOneAsync(List<Task> inFlight)
    {
        var completed = await Task.WhenAny(inFlight).ConfigureAwait(false);
        inFlight.Remove(completed);
        await completed.ConfigureAwait(false);
    }
}
