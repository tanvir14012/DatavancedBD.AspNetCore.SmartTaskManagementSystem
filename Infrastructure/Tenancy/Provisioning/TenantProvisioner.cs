using System.Collections.Concurrent;
using Application.Tenancy;

namespace Infrastructure.Tenancy.Provisioning;

/// <summary>
/// Provisions an organization through a non-active placement and publishes Active only after
/// migration and validation succeed. The catalog compare-and-set is the cutover fence.
/// </summary>
public sealed class TenantProvisioner : ITenantProvisioner
{
    private readonly ITenantPlacementAllocator _allocator;
    private readonly ITenantProvisioningExecutor _executor;
    private readonly ITenantCatalogWriter _catalogWriter;
    private readonly ITenantPlacementCache _cache;
    private readonly ITenantProvisioningLockProvider _locks;

    public TenantProvisioner(
        ITenantPlacementAllocator allocator,
        ITenantProvisioningExecutor executor,
        ITenantCatalogWriter catalogWriter,
        ITenantPlacementCache cache,
        ITenantProvisioningLockProvider locks)
    {
        _allocator = allocator ?? throw new ArgumentNullException(nameof(allocator));
        _executor = executor ?? throw new ArgumentNullException(nameof(executor));
        _catalogWriter = catalogWriter ?? throw new ArgumentNullException(nameof(catalogWriter));
        _cache = cache ?? throw new ArgumentNullException(nameof(cache));
        _locks = locks ?? throw new ArgumentNullException(nameof(locks));
    }

    public async Task ProvisionAsync(Guid tenantId, TenantIsolation isolation, CancellationToken cancellationToken)
    {
        if (tenantId == Guid.Empty)
            throw new ArgumentException("Organization identity must not be empty.", nameof(tenantId));
        if (!Enum.IsDefined(isolation))
            throw new ArgumentOutOfRangeException(nameof(isolation));

        cancellationToken.ThrowIfCancellationRequested();
        await using var lease = await _locks.AcquireAsync(tenantId, cancellationToken).ConfigureAwait(false);
        cancellationToken.ThrowIfCancellationRequested();

        var provisioning = await _allocator.AllocateAsync(tenantId, isolation, cancellationToken).ConfigureAwait(false);
        cancellationToken.ThrowIfCancellationRequested();
        if (provisioning.TenantId != tenantId || provisioning.Isolation != isolation ||
            provisioning.Lifecycle != TenantLifecycle.Provisioning)
            throw new InvalidDataException("Placement allocator returned an invalid provisioning snapshot.");

        if (!await _catalogWriter.TrySaveAsync(provisioning, expectedVersion: 0, cancellationToken).ConfigureAwait(false))
            throw new TenantProvisioningException("TENANT_ALREADY_PROVISIONING", "The organization already has a placement.");

        await _executor.ExecuteAsync(provisioning, cancellationToken).ConfigureAwait(false);
        cancellationToken.ThrowIfCancellationRequested();
        await _executor.ValidateAsync(provisioning, cancellationToken).ConfigureAwait(false);
        cancellationToken.ThrowIfCancellationRequested();

        if (provisioning.Version == long.MaxValue)
            throw new InvalidDataException("Placement revision cannot be advanced.");

        var active = new TenantPlacement(
            provisioning.TenantId,
            provisioning.Isolation,
            provisioning.TargetId,
            provisioning.Schema,
            provisioning.Region,
            provisioning.Version + 1,
            TenantLifecycle.Active);

        if (!await _catalogWriter.TrySaveAsync(active, provisioning.Version, cancellationToken).ConfigureAwait(false))
            throw new TenantProvisioningException("PLACEMENT_CHANGED", "The placement changed during provisioning.");

        // Activation is durable. A cache outage must not make a successfully provisioned tenant
        // appear failed; the next authoritative lookup repopulates the cache.
        try
        {
            await _cache.SetAsync(active, cancellationToken).ConfigureAwait(false);
        }
        catch (TenantPlacementCacheUnavailableException) when (!cancellationToken.IsCancellationRequested)
        {
            // Intentionally ignored: Redis is not authoritative.
        }
    }
}

public sealed class TenantProvisioningException(string code, string message) : Exception(message)
{
    public string Code { get; } = code;
}

/// <summary>Process-local provisioning lock for single-process administration and tests.</summary>
public sealed class InProcessTenantProvisioningLockProvider : ITenantProvisioningLockProvider
{
    private readonly ConcurrentDictionary<Guid, SemaphoreSlim> _locks = new();

    public async Task<IAsyncDisposable> AcquireAsync(Guid tenantId, CancellationToken cancellationToken)
    {
        var gate = _locks.GetOrAdd(tenantId, static _ => new SemaphoreSlim(1, 1));
        await gate.WaitAsync(cancellationToken).ConfigureAwait(false);
        return new Lease(gate);
    }

    private sealed class Lease(SemaphoreSlim gate) : IAsyncDisposable
    {
        public ValueTask DisposeAsync()
        {
            gate.Release();
            return ValueTask.CompletedTask;
        }
    }
}
