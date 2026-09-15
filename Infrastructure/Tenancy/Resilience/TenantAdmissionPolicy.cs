using System.Collections.Concurrent;
using Application.Tenancy;
using Microsoft.Extensions.Options;

namespace Infrastructure.Tenancy.Resilience;

/// <summary>
/// Bounds global, per-target and per-organization work with shared gates. It does not create a
/// thread pool per organization; callers receive a short-lived lease or a capacity miss.
/// </summary>
public sealed class TenantAdmissionPolicy : ITenantAdmissionPolicy, ITenantWorkAdmission, IDisposable
{
    private readonly SemaphoreSlim _global;
    private readonly ConcurrentDictionary<Guid, SemaphoreSlim> _tenants = new();
    private readonly ConcurrentDictionary<string, SemaphoreSlim> _targets = new(StringComparer.Ordinal);
    private readonly TenantAdmissionOptions _options;

    public TenantAdmissionPolicy(IOptions<TenantAdmissionOptions>? options = null)
    {
        _options = options?.Value ?? new TenantAdmissionOptions();
        _options.Validate();
        _global = new SemaphoreSlim(_options.MaxConcurrentWork, _options.MaxConcurrentWork);
    }

    public async Task<bool> CanAdmitAsync(Guid tenantId, CancellationToken cancellationToken)
    {
        if (tenantId == Guid.Empty) return false;
        cancellationToken.ThrowIfCancellationRequested();
        var gate = _tenants.GetOrAdd(tenantId, _ => new SemaphoreSlim(_options.MaxConcurrentPerTenant, _options.MaxConcurrentPerTenant));
        var globalAvailable = await _global.WaitAsync(0, cancellationToken).ConfigureAwait(false);
        if (!globalAvailable) return false;
        var tenantAvailable = await gate.WaitAsync(0, cancellationToken).ConfigureAwait(false);
        _global.Release();
        if (tenantAvailable) gate.Release();
        return tenantAvailable;
    }

    public async Task<IAsyncDisposable?> AcquireAsync(Guid tenantId, string targetId, CancellationToken cancellationToken)
    {
        if (tenantId == Guid.Empty) throw new ArgumentException("Organization identity is required.", nameof(tenantId));
        ArgumentException.ThrowIfNullOrWhiteSpace(targetId);
        cancellationToken.ThrowIfCancellationRequested();

        var tenantGate = _tenants.GetOrAdd(tenantId, _ => new SemaphoreSlim(_options.MaxConcurrentPerTenant));
        var targetGate = _targets.GetOrAdd(targetId, _ => new SemaphoreSlim(_options.MaxConcurrentPerTarget));
        if (!await WaitAsync(_global, cancellationToken).ConfigureAwait(false)) return null;
        if (!await WaitAsync(targetGate, cancellationToken).ConfigureAwait(false))
        {
            _global.Release();
            return null;
        }
        if (!await WaitAsync(tenantGate, cancellationToken).ConfigureAwait(false))
        {
            targetGate.Release();
            _global.Release();
            return null;
        }

        return new Lease(_global, targetGate, tenantGate);
    }

    public void Dispose()
    {
        _global.Dispose();
        foreach (var gate in _tenants.Values) gate.Dispose();
        foreach (var gate in _targets.Values) gate.Dispose();
    }

    private async Task<bool> WaitAsync(SemaphoreSlim gate, CancellationToken callerToken)
        => await gate.WaitAsync(_options.WaitMilliseconds, callerToken).ConfigureAwait(false);

    private sealed class Lease(SemaphoreSlim global, SemaphoreSlim target, SemaphoreSlim tenant) : IAsyncDisposable
    {
        private int _released;

        public ValueTask DisposeAsync()
        {
            if (Interlocked.Exchange(ref _released, 1) == 0)
            {
                tenant.Release();
                target.Release();
                global.Release();
            }
            return ValueTask.CompletedTask;
        }
    }
}

/// <summary>In-memory idempotency store for one worker process; replace with a durable queue store.</summary>
public sealed class InMemoryTenantJobDeduplicator : ITenantJobDeduplicator
{
    private readonly ConcurrentDictionary<string, byte> _active = new(StringComparer.Ordinal);

    public Task<bool> TryBeginAsync(string jobId, CancellationToken cancellationToken)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(jobId);
        cancellationToken.ThrowIfCancellationRequested();
        return Task.FromResult(_active.TryAdd(jobId, 0));
    }

    public Task CompleteAsync(string jobId, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        _active.TryRemove(jobId, out _);
        return Task.CompletedTask;
    }

    public Task AbandonAsync(string jobId, CancellationToken cancellationToken)
        => CompleteAsync(jobId, cancellationToken);
}
